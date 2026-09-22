import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as upload } from "@/app/api/uploads/route";
import { GET as media } from "@/app/media/[...path]/route";
import { closeDb, db } from "@/db";
import { jobRuns, listingImages, pendingUploads } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { purgeUploads } from "@/lib/cron/jobs/purge-uploads";
import { runJob } from "@/lib/cron/runner";
import { draftTokenHash, MAX_UPLOADS_PER_DRAFT, claimUploads, newDraftToken, storeDraftUpload } from "./uploads";
import { uploadLimiter } from "./upload-limiter";
import { jpegWithGps, png } from "./test-images";

const TAG = `a3up${Date.now()}`;
const JOB = `test-purge-${TAG}`;
let base: string;
let fx: Awaited<ReturnType<typeof createFixtures>>;
const tokens: string[] = [];

function token(): string {
  const t = newDraftToken();
  tokens.push(t);
  return t;
}

async function files(): Promise<string[]> {
  return (await readdir(base, { recursive: true })).filter((f) => f.endsWith(".webp")).sort();
}

function form(file: Buffer | null, draftToken?: string, name = "foto.jpg"): FormData {
  const fd = new FormData();
  if (file) fd.set("file", new Blob([new Uint8Array(file)], { type: "image/jpeg" }), name);
  if (draftToken !== undefined) fd.set("draftToken", draftToken);
  return fd;
}

function post(fd: FormData, ip = "203.0.113.7"): Promise<Response> {
  return upload(new Request("http://localhost/api/uploads", { method: "POST", body: fd, headers: { "x-forwarded-for": ip } }));
}

function get(path: string): Promise<Response> {
  const segs = path.replace(/^\/media\//, "").split("/").map(decodeURIComponent);
  return media(new Request(`http://localhost${path}`), { params: Promise.resolve({ path: segs }) });
}

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "moto-a3-"));
  process.env.STORAGE_LOCAL_PATH = base; // antes del primer getStorage()
  fx = await createFixtures(TAG);
});
beforeEach(() => uploadLimiter.reset());
afterAll(async () => {
  const hashes = tokens.map(draftTokenHash);
  if (hashes.length) await db.delete(pendingUploads).where(inArray(pendingUploads.draftTokenHash, hashes));
  await db.delete(jobRuns).where(eq(jobRuns.job, JOB));
  await fx.cleanup();
  await closeDb();
  await rm(base, { recursive: true, force: true });
});

describe("POST /api/uploads", () => {
  it("guarda variantes sin EXIF, crea el token si falta y lo reutiliza", async () => {
    const res = await post(form(await jpegWithGps(2000, 1500)));
    expect(res.status).toBe(201);
    const body = await res.json();
    tokens.push(body.draftToken);
    expect(body.url).toMatch(/^\/media\/listings\/[0-9a-f]{2}\/[0-9a-f]{32}-1600\.webp$/);
    expect([body.width, body.height]).toEqual([1600, 1200]);

    const [row] = await db.select().from(pendingUploads).where(eq(pendingUploads.id, body.id));
    expect(row.draftTokenHash).toBe(draftTokenHash(body.draftToken));
    expect(row.draftTokenHash).not.toContain(body.draftToken);
    expect(row.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.claimedListingId).toBeNull();

    const prefix = body.url.replace(/^\/media\//, "").replace(/-1600\.webp$/, "");
    const stored = await files();
    for (const w of [320, 640, 1024, 1600]) expect(stored).toContain(`${prefix}-${w}.webp`);

    // Reintento de la misma foto → la misma fila, 200.
    const again = await post(form(await jpegWithGps(2000, 1500), body.draftToken));
    expect(again.status).toBe(200);
    expect((await again.json()).id).toBe(body.id);

    // Segunda foto en el mismo borrador.
    const second = await post(form(await png(800, 600), body.draftToken, "b.png"));
    expect(second.status).toBe(201);
    expect((await second.json()).draftToken).toBe(body.draftToken);
  });

  it("rechaza un ejecutable renombrado a .jpg y un SVG (TEST_PLAN.md §9)", async () => {
    const before = await files();
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(2048, 7)]);
    const r1 = await post(form(exe, token(), "moto.jpg"));
    expect(r1.status).toBe(415);
    expect((await r1.json()).error).toBe("unsupported_type");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const r2 = await post(form(svg, token(), "moto.svg"));
    expect(r2.status).toBe(415);
    expect(await files()).toEqual(before);
  });

  it("valida el envío: sin archivo, token raro, no multipart, demasiado grande", async () => {
    expect((await post(form(null, token()))).status).toBe(400);
    expect((await post(form(await png(400, 300), "corto"))).status).toBe(400);
    const notMultipart = await upload(new Request("http://localhost/api/uploads", { method: "POST", body: "x" }));
    expect(notMultipart.status).toBe(400);
    const big = await upload(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        body: "x",
        headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(20 * 1024 * 1024) },
      }),
    );
    expect(big.status).toBe(413);
  });

  it("límite por IP → 429 con Retry-After", async () => {
    const t = token();
    const img = await png(300, 300);
    for (let i = 0; i < 40; i++) uploadLimiter.check("upload|198.51.100.9");
    const res = await post(form(img, t), "198.51.100.9");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await post(form(img, t), "198.51.100.10")).status).toBe(201);
  });

  it(`tope de ${MAX_UPLOADS_PER_DRAFT} fotos por borrador`, async () => {
    const t = token();
    const h = draftTokenHash(t);
    const rows = Array.from({ length: MAX_UPLOADS_PER_DRAFT }, (_, i) => ({
      draftTokenHash: h,
      storagePath: `listings/00/${TAG}-${i}-320.webp`,
      contentHash: String(i).padStart(64, "0"),
    }));
    await db.insert(pendingUploads).values(rows);
    const res = await post(form(await png(300, 300), t));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("too_many");
  });
});

describe("GET /media/[...path]", () => {
  it("sirve la variante con caché inmutable y tipo correcto; 404 y traversal rechazado", async () => {
    const stored = await storeDraftUpload(token(), await png(700, 500));
    const res = await get(stored.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const buf = Buffer.from(await res.arrayBuffer());
    expect((await sharp(buf).metadata()).width).toBe(700);

    expect((await get(stored.url.replace(/-700\.webp$/, "-640.webp"))).status).toBe(200);
    expect((await get(stored.url.replace(/-700\.webp$/, "-1024.webp"))).status).toBe(404);
    for (const segs of [["..", "..", "etc", "passwd"], ["listings", "..", "..", "x.webp"], [".env"], ["x.svg"]]) {
      const r = await media(new Request("http://localhost/media/x"), { params: Promise.resolve({ path: segs }) });
      expect(r.status, segs.join("/")).toBe(404);
    }
  });
});

describe("claimUploads", () => {
  it("mueve las fotos a listing_images en orden, marca claimed y no duplica", async () => {
    const listingId = await fx.listing({ status: "draft" }, { image: false });
    const t = token();
    const a = await storeDraftUpload(t, await png(640, 480));
    const b = await storeDraftUpload(t, await png(641, 480));
    const c = await storeDraftUpload(t, await png(642, 480));

    expect(await claimUploads(t, listingId, { ids: [c.id, a.id] })).toBe(2);
    const imgs = await db.select().from(listingImages).where(eq(listingImages.listingId, listingId)).orderBy(listingImages.sortOrder);
    expect(imgs.map((i) => i.storagePath)).toEqual([c.storagePath, a.storagePath]);
    expect(imgs.map((i) => i.sortOrder)).toEqual([0, 1]);
    expect(imgs[0].width).toBe(642);
    expect(imgs.every((i) => !i.isCatalogPhoto && /^[0-9a-f]{64}$/.test(i.contentHash))).toBe(true);

    const pend = await db.select().from(pendingUploads).where(eq(pendingUploads.draftTokenHash, draftTokenHash(t)));
    expect(pend.find((p) => p.id === a.id)?.claimedListingId).toBe(listingId);
    expect(pend.find((p) => p.id === b.id)?.claimedListingId).toBeNull();

    // Segundo llamado: sólo queda b, va al final.
    expect(await claimUploads(t, listingId)).toBe(1);
    expect(await claimUploads(t, listingId)).toBe(0);
    const after = await db.select().from(listingImages).where(eq(listingImages.listingId, listingId));
    expect(after).toHaveLength(3);
    expect(after.find((i) => i.storagePath === b.storagePath)?.sortOrder).toBe(2);

    expect(await claimUploads("no-es-un-token", listingId)).toBe(0);
    await db.delete(pendingUploads).where(eq(pendingUploads.claimedListingId, listingId));
  });

  it("dentro de la transacción de quien llama: un rollback no reclama nada", async () => {
    const listingId = await fx.listing({ status: "draft" }, { image: false });
    const t = token();
    await storeDraftUpload(t, await png(650, 480));
    await expect(
      db.transaction(async (tx) => {
        expect(await claimUploads(t, listingId, { tx })).toBe(1);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    const [row] = await db.select().from(pendingUploads).where(eq(pendingUploads.draftTokenHash, draftTokenHash(t)));
    expect(row.claimedListingId).toBeNull();
    expect(await db.select().from(listingImages).where(eq(listingImages.listingId, listingId))).toHaveLength(0);
  });
});

describe("job purge-uploads", () => {
  it("borra filas y archivos no reclamados de más de 7 días, conserva lo compartido", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const now = new Date();
    const old = new Date(now.getTime() - 8 * DAY);

    const tOld = token();
    const stale = await storeDraftUpload(tOld, await png(660, 480));
    const tFresh = token();
    const fresh = await storeDraftUpload(tFresh, await png(661, 480));
    // La misma foto en un borrador viejo y en uno nuevo: el archivo se queda.
    const tShared = token();
    const sharedOld = await storeDraftUpload(tShared, await png(662, 480));
    const tShared2 = token();
    const sharedNew = await storeDraftUpload(tShared2, await png(662, 480));
    expect(sharedNew.storagePath).toBe(sharedOld.storagePath);
    // Reclamada y vieja: nunca se toca.
    const listingId = await fx.listing({ status: "draft" }, { image: false });
    const tClaimed = token();
    const claimed = await storeDraftUpload(tClaimed, await png(663, 480));
    await claimUploads(tClaimed, listingId);

    await db
      .update(pendingUploads)
      .set({ createdAt: old })
      .where(inArray(pendingUploads.id, [stale.id, sharedOld.id, claimed.id]));

    const result = await runJob(JOB, purgeUploads, now);
    expect(result.status).toBe("succeeded");

    const ids = (await db.select({ id: pendingUploads.id }).from(pendingUploads).where(
      inArray(pendingUploads.id, [stale.id, fresh.id, sharedOld.id, sharedNew.id, claimed.id]),
    )).map((r) => r.id);
    expect(ids.sort()).toEqual([fresh.id, sharedNew.id, claimed.id].sort());

    const stored = await files();
    const stalePrefix = stale.storagePath.replace(/-660\.webp$/, "");
    expect(stored.filter((f) => f.startsWith(stalePrefix))).toEqual([]);
    expect(stored).toContain(fresh.storagePath);
    expect(stored).toContain(sharedOld.storagePath);
    expect(stored).toContain(claimed.storagePath);

    const [run] = await db.select().from(jobRuns).where(and(eq(jobRuns.job, JOB)));
    expect(run.status).toBe("succeeded");
    await db.delete(pendingUploads).where(eq(pendingUploads.claimedListingId, listingId));
  });
});
