// B6 contra MySQL: aprobar, rechazar, enlace privado G-1, mapeo de modelo,
// duplicados por foto (G-12), denuncias y 403 por POST directo con otro rol.
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { activityLog, dealers, listingImages, listings, models, modelSuggestions, reports } from "@/db/schema";
import { activityFor, createFixtures, sessionCookieFor } from "@/lib/auth/int-fixtures";
import { findListingIdByManageToken } from "@/lib/manage-token";
import { POST as decisionPOST } from "@/app/admin/moderacion/decision/route";
import { POST as resolverPOST } from "@/app/admin/denuncias/resolver/route";
import { approveListing, rejectListing } from "./decide";
import { resolveReport } from "./reports-admin";
import { duplicatePhotoListings } from "./signals";
import { REJECTION_TEXT } from "./texts";

const TAG = `b6${Date.now()}`;
const SITE = "https://moto.com.py";
let fx: Awaited<ReturnType<typeof createFixtures>>;

beforeAll(async () => {
  fx = await createFixtures(TAG);
});
afterAll(async () => {
  if (fx.ids.listings.length) {
    await db.delete(reports).where(inArray(reports.listingId, fx.ids.listings));
    await db.delete(modelSuggestions).where(inArray(modelSuggestions.listingId, fx.ids.listings));
  }
  await db.delete(activityLog).where(eq(activityLog.entityType, "report"));
  await fx.cleanup();
  await closeDb();
});

const row = async (id: number) => (await db.select().from(listings).where(eq(listings.id, id)))[0];

describe("aprobar y rechazar", () => {
  it("particular: publica, crea el token del enlace privado (sólo el hash en la base) y lo pone en el mensaje", async () => {
    const mod = await fx.user("moderator");
    const id = await fx.listing({ status: "pending_review" });
    const res = await approveListing(mod, { listingId: id, siteUrl: SITE });
    if (!res.ok) throw new Error(res.error);
    expect(res.privateLink).toBe(true);
    const token = /\/mi-aviso\/([A-Za-z0-9_-]{43})/.exec(res.message)?.[1];
    expect(token).toBeDefined();
    const r = await row(id);
    expect(r.status).toBe("published");
    expect(r.manageTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.manageTokenHash).not.toBe(token);
    expect(await findListingIdByManageToken(token!)).toBe(id);
    expect(res.message).toContain(`${SITE}/aviso/`);
    expect((await activityFor(id)).map((a) => a.action)).toEqual(["approved", "manage_token_rotated"]);
  });

  it("comercio: publica sin enlace privado", async () => {
    const admin = await fx.user("admin");
    const dealerId = await fx.dealer();
    const id = await fx.listing({ status: "pending_review", dealerId });
    // ADR-12: sin bloque de autorización no se publica (guarda de B7).
    expect(await approveListing(admin, { listingId: id, siteUrl: SITE })).toMatchObject({ ok: false });
    await db.update(dealers).set({ authorizationNote: "Autorizo (prueba)", authorizationDate: "2026-09-01" }).where(eq(dealers.id, dealerId));
    const res = await approveListing(admin, { listingId: id, siteUrl: SITE });
    expect(res).toMatchObject({ ok: true, privateLink: false });
    expect((await row(id)).manageTokenHash).toBeNull();
  });

  it("rechazar: motivo obligatorio, texto por defecto del código, «otro» exige texto", async () => {
    const mod = await fx.user("moderator");
    const id = await fx.listing({ status: "pending_review" });
    expect(await rejectListing(mod, { listingId: id, code: "no-existe" })).toMatchObject({ ok: false });
    expect(await rejectListing(mod, { listingId: id, code: "otro", text: "" })).toMatchObject({ ok: false });
    const res = await rejectListing(mod, { listingId: id, code: "sin_fotos" });
    expect(res).toMatchObject({ ok: true, status: "rejected" });
    const r = await row(id);
    expect(r).toMatchObject({ status: "rejected", rejectionReasonCode: "sin_fotos", rejectionNote: REJECTION_TEXT.sin_fotos });
    // Resuelta por otra persona antes: no rompe.
    expect(await approveListing(mod, { listingId: id, siteUrl: SITE })).toMatchObject({ ok: false });
  });

  it("modelo en texto libre: se mapea en el mismo gesto y se resuelve la sugerencia", async () => {
    const mod = await fx.user("moderator");
    const id = await fx.listing({ status: "pending_review", modelId: null, modelRaw: "XR 150 rally" });
    await db.insert(modelSuggestions).values({ rawText: "XR 150 rally", brandId: fx.base.brandId, listingId: id });
    const blocked = await approveListing(mod, { listingId: id, siteUrl: SITE });
    expect(blocked).toMatchObject({ ok: false });
    expect(!blocked.ok && blocked.error).toContain("modelo");
    const [other] = await db.select({ id: models.id }).from(models).where(eq(models.brandId, fx.base.brandId + 1)).limit(1);
    if (other) expect(await approveListing(mod, { listingId: id, modelId: other.id, siteUrl: SITE })).toMatchObject({ ok: false });
    const ok = await approveListing(mod, { listingId: id, modelId: fx.base.modelId, siteUrl: SITE });
    expect(ok).toMatchObject({ ok: true });
    expect((await row(id)).modelId).toBe(fx.base.modelId);
    const [s] = await db.select().from(modelSuggestions).where(eq(modelSuggestions.listingId, id));
    expect(s).toMatchObject({ status: "mapped", mappedModelId: fx.base.modelId, resolvedBy: mod.id });
  });

  it("un dealer (o sin sesión) no puede aprobar ni rechazar, ni llamando a la función", async () => {
    const dealerId = await fx.dealer();
    const dealer = await fx.user("dealer", { dealerId });
    const id = await fx.listing({ status: "pending_review", dealerId });
    await expect(approveListing(dealer, { listingId: id, siteUrl: SITE })).rejects.toMatchObject({ status: 403 });
    await expect(rejectListing(null, { listingId: id, code: "sin_fotos" })).rejects.toMatchObject({ status: 401 });
    expect((await row(id)).status).toBe("pending_review");
  });
});

describe("POST directo a los route handlers", () => {
  const post = async (handler: typeof decisionPOST, url: string, body: unknown, cookie?: string) =>
    handler(
      new Request(`http://localhost:3000${url}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      }),
      undefined as never,
    );

  it("dealer → 403, sin sesión → 401, otro origen → 403; moderador → 200", async () => {
    const dealerId = await fx.dealer();
    const dealer = await fx.user("dealer", { dealerId });
    const mod = await fx.user("moderator");
    await db.update(dealers).set({ authorizationNote: "Autorizo (prueba)", authorizationDate: "2026-09-01" }).where(eq(dealers.id, dealerId));
    const id = await fx.listing({ status: "pending_review", dealerId });
    expect((await post(decisionPOST, "/admin/moderacion/decision", { action: "approve", listingId: id }, await sessionCookieFor(dealer.id))).status).toBe(403);
    expect((await post(decisionPOST, "/admin/moderacion/decision", { action: "approve", listingId: id })).status).toBe(401);
    expect((await post(resolverPOST, "/admin/denuncias/resolver", { reportId: 1, action: "dismiss", note: "x" }, await sessionCookieFor(dealer.id))).status).toBe(403);
    expect((await row(id)).status).toBe("pending_review");
    const foreign = await decisionPOST(
      new Request("http://localhost:3000/admin/moderacion/decision", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example", host: "localhost:3000", cookie: await sessionCookieFor(mod.id) },
        body: JSON.stringify({ action: "approve", listingId: id }),
      }),
      undefined as never,
    );
    expect(foreign.status).toBe(403);
    const ok = await post(decisionPOST, "/admin/moderacion/decision", { action: "approve", listingId: id }, await sessionCookieFor(mod.id));
    expect(ok.status).toBe(200);
    expect((await row(id)).status).toBe("published");
  });
});

describe("duplicados por foto (G-12)", () => {
  it("la misma foto propia en otra publicación cuenta; una foto de catálogo compartida no", async () => {
    const a = await fx.listing({ status: "pending_review" }, { image: false });
    const b = await fx.listing({ status: "published" }, { image: false });
    const c = await fx.listing({ status: "published" }, { image: false });
    const img = (listingId: number, hash: string, isCatalogPhoto: boolean) =>
      db.insert(listingImages).values({ listingId, storagePath: `dev/${TAG}/${listingId}-${hash}.webp`, contentHash: hash.repeat(64).slice(0, 64), isCatalogPhoto });
    await img(a, "c", true); // catálogo en A
    await img(b, "c", true); // la misma foto de catálogo en B
    await img(c, "c", false); // y en C como foto "propia": del lado de A es catálogo → no cuenta
    expect(await duplicatePhotoListings(a)).toEqual([]);
    await img(a, "d", false);
    await img(b, "d", false);
    expect((await duplicatePhotoListings(a)).map((r) => r.id)).toEqual([b]);
  });
});

describe("denuncias", () => {
  it("nota obligatoria; descartar resuelve una; pausar pausa y resuelve todas las pendientes de la publicación", async () => {
    const mod = await fx.user("moderator");
    const id = await fx.listing({ status: "published", publishedAt: new Date() });
    const [r1] = await db.insert(reports).values({ listingId: id, reasonCode: "estafa" }).$returningId();
    const [r2] = await db.insert(reports).values({ listingId: id, reasonCode: "robada" }).$returningId();
    const [r3] = await db.insert(reports).values({ listingId: id, reasonCode: "no_responde" }).$returningId();
    expect(await resolveReport(mod, { reportId: r3.id, action: "dismiss", note: "" })).toMatchObject({ ok: false });
    expect(await resolveReport(mod, { reportId: r3.id, action: "dismiss", note: "Respondió al comprador." })).toMatchObject({ ok: true, resolved: 1 });
    expect(await resolveReport(mod, { reportId: r1.id, action: "pause", note: "Varios compradores reportan seña." })).toMatchObject({ ok: true, resolved: 2, listingStatus: "paused" });
    expect((await row(id)).status).toBe("paused");
    const rs = await db.select().from(reports).where(eq(reports.listingId, id));
    expect(rs.find((r) => r.id === r2.id)).toMatchObject({ status: "actioned", resolvedBy: mod.id });
    expect(rs.find((r) => r.id === r3.id)).toMatchObject({ status: "dismissed", resolutionNote: "Respondió al comprador." });
    const logs = await db.select().from(activityLog).where(and(eq(activityLog.entityType, "report"), inArray(activityLog.entityId, [r1.id, r2.id, r3.id])));
    expect(logs.map((l) => l.action).sort()).toEqual(["report_actioned", "report_actioned", "report_dismissed"]);
    expect((await activityFor(id)).map((a) => a.action)).toContain("paused");
  });

  it("dar de baja: borrado lógico por transition()", async () => {
    const admin = await fx.user("admin");
    const id = await fx.listing({ status: "published", publishedAt: new Date() });
    const [r] = await db.insert(reports).values({ listingId: id, reasonCode: "estafa" }).$returningId();
    expect(await resolveReport(admin, { reportId: r.id, action: "takedown", note: "Estafa confirmada." })).toMatchObject({ ok: true, listingStatus: "deleted" });
    expect((await row(id)).deletedAt).not.toBeNull();
    expect(await resolveReport(admin, { reportId: r.id, action: "dismiss", note: "otra vez" })).toMatchObject({ ok: false });
  });
});
