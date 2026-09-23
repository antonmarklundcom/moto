import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLog, listingImages } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { getStorage } from "@/lib/storage";
import { purgeRemovedPhotos } from "./purge-removed-photos";

const TAG = `prp${Date.now().toString(36)}`;
const fx = await createFixtures(TAG);
let base = "";
const DAY = 86_400_000;
const now = new Date();
const ago = (d: number) => new Date(now.getTime() - d * DAY);
const ids: Record<string, number> = {};

async function exists(path: string) {
  try {
    await stat(join(base, path));
    return true;
  } catch {
    return false;
  }
}

async function withPhoto(key: string, path: string, extra: Parameters<typeof fx.listing>[0]) {
  const id = await fx.listing(extra, { image: false });
  await db.insert(listingImages).values({ listingId: id, storagePath: path, contentHash: "a".repeat(64) });
  await getStorage().put({ path, data: Buffer.from("x"), contentType: "image/webp" });
  ids[key] = id;
}

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "moto-prp-"));
  process.env.STORAGE_LOCAL_PATH = base; // antes del primer getStorage()
  await withPhoto("deletedOld", `dev/${TAG}/borrada.webp`, { status: "published", deletedAt: ago(40) });
  await withPhoto("rejectedOld", `dev/${TAG}/rechazada.webp`, { status: "rejected", updatedAt: ago(40) });
  await withPhoto("deletedRecent", `dev/${TAG}/reciente.webp`, { status: "published", deletedAt: ago(10) });
  await withPhoto("live", `dev/${TAG}/viva.webp`, { status: "published" });
  // Misma foto en una borrada vieja y en una viva: no se toca.
  await withPhoto("sharedOld", `dev/${TAG}/compartida.webp`, { status: "published", deletedAt: ago(40) });
  const liveShared = await fx.listing({ status: "published" }, { image: false });
  await db.insert(listingImages).values({ listingId: liveShared, storagePath: `dev/${TAG}/compartida.webp`, contentHash: "b".repeat(64) });
});

afterAll(async () => {
  await db.delete(listingImages).where(inArray(listingImages.listingId, fx.ids.listings));
  await fx.cleanup();
  await rm(base, { recursive: true, force: true });
});

describe("purge-removed-photos", () => {
  it("borra archivos de borradas/rechazadas hace > 30 días, deja las filas y no toca lo vivo ni lo compartido", async () => {
    const r = await purgeRemovedPhotos({ now, runId: 0 });
    expect(r.listings).toBeGreaterThanOrEqual(3);
    expect(await exists(`dev/${TAG}/borrada.webp`)).toBe(false);
    expect(await exists(`dev/${TAG}/rechazada.webp`)).toBe(false);
    expect(await exists(`dev/${TAG}/reciente.webp`)).toBe(true);
    expect(await exists(`dev/${TAG}/viva.webp`)).toBe(true);
    expect(await exists(`dev/${TAG}/compartida.webp`)).toBe(true);
    // La evidencia (content_hash) sigue para la señal de duplicados.
    expect(await db.select().from(listingImages).where(eq(listingImages.listingId, ids.deletedOld))).toHaveLength(1);
    const log = await db.select().from(activityLog).where(and(eq(activityLog.entityId, ids.deletedOld), eq(activityLog.action, "photos_purged")));
    expect(log).toHaveLength(1);

    // Segunda corrida: esas publicaciones ya están procesadas.
    await purgeRemovedPhotos({ now, runId: 0 });
    expect(await db.select().from(activityLog).where(and(eq(activityLog.entityId, ids.deletedOld), eq(activityLog.action, "photos_purged")))).toHaveLength(1);
  });
});
