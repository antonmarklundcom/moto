// B4 contra MySQL: alta desde /publicar (límite por IP, fotos reclamadas,
// sugerencia de modelo, pending_review), acciones del enlace privado y la
// regla de re-moderación.
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { activityLog, listingImages, listings, modelSuggestions, pendingUploads } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { png } from "@/lib/images/test-images";
import { newDraftToken, storeDraftUpload } from "@/lib/images/uploads";
import { rotateManageToken } from "@/lib/manage-token";
import { manageAction, manageEdit, managedListing } from "./manage";
import { createFromPublish, publishCatalog } from "./submit";
import { validatePublish } from "./validate";

const TAG = `b4${Date.now()}`;
let fx: Awaited<ReturnType<typeof createFixtures>>;
const created: number[] = [];
const DESC = "Moto en muy buen estado, service al día, cubiertas nuevas. Papeles al día a mi nombre. La vendo porque me compré un auto y ya no la uso.";
const IP = `10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.9`;

beforeAll(async () => {
  fx = await createFixtures(TAG);
});
afterAll(async () => {
  const ids = [...created, ...fx.ids.listings];
  if (ids.length) {
    await db.delete(modelSuggestions).where(inArray(modelSuggestions.listingId, ids));
    await db.delete(pendingUploads).where(inArray(pendingUploads.claimedListingId, ids));
    await db.delete(listingImages).where(inArray(listingImages.listingId, ids));
    await db.delete(activityLog).where(inArray(activityLog.entityId, ids));
    await db.delete(listings).where(inArray(listings.id, created));
  }
  await fx.cleanup();
  await closeDb();
});

async function values(over: Record<string, string> = {}) {
  const catalog = await publishCatalog();
  const model = catalog.models[0];
  const r = validatePublish(
    {
      marca: String(model.brandId),
      modelo: String(model.id),
      categoria: String(catalog.categories[0].id),
      condicion: "used",
      anio: "2020",
      km: "20000",
      documentacion: "al_dia",
      precio: "9000000",
      ciudad: String(catalog.cities[0].id),
      telefono: "0981 123 456",
      descripcion: DESC,
      ...over,
    },
    catalog,
  );
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.values;
}

describe("/publicar", () => {
  it("con fotos: se reclaman, queda en moderación con activity_log; texto libre de modelo → sugerencia", async () => {
    const token = newDraftToken();
    const up1 = await storeDraftUpload(token, await png(800, 600));
    const up2 = await storeDraftUpload(token, await png(640, 480));
    const r = await createFromPublish({ values: await values(), draftToken: token, photoIds: [up2.id, up1.id], ip: IP, ipHash: "h".repeat(64) });
    if (!r.ok) throw new Error(r.reason);
    created.push(r.listingId);
    expect(r.photos).toBe(2);
    const [l] = await db.select().from(listings).where(eq(listings.id, r.listingId));
    expect(l).toMatchObject({ status: "pending_review", dealerId: null, ownerUserId: null });
    expect(l.submittedIp).not.toBeNull();
    const imgs = await db.select().from(listingImages).where(eq(listingImages.listingId, r.listingId));
    expect(imgs.map((i) => i.storagePath)).toEqual([up2.storagePath, up1.storagePath]);
    const acts = (await db.select({ a: activityLog.action }).from(activityLog).where(eq(activityLog.entityId, r.listingId))).map((x) => x.a);
    expect(acts).toEqual(expect.arrayContaining(["created", "submitted"]));

    const free = await createFromPublish({ values: await values({ modelo: "otro", modelo_texto: `${TAG} Especial` }), draftToken: null, photoIds: [], ip: IP, ipHash: null });
    if (!free.ok) throw new Error(free.reason);
    created.push(free.listingId);
    const [s] = await db.select().from(modelSuggestions).where(eq(modelSuggestions.listingId, free.listingId));
    expect(s).toMatchObject({ rawText: `${TAG} Especial`, status: "pending" });
  });

  it("límite: 3 por IP en 24 h; la 4.ª se rechaza sin crear nada", async () => {
    const ip = `10.250.${Math.floor(Math.random() * 250)}.7`;
    for (let i = 0; i < 3; i += 1) {
      const r = await createFromPublish({ values: await values(), draftToken: null, photoIds: [], ip, ipHash: null });
      if (!r.ok) throw new Error(`intento ${i + 1}: ${r.reason}`);
      created.push(r.listingId);
    }
    const before = (await db.select({ id: listings.id }).from(listings)).length;
    expect(await createFromPublish({ values: await values(), draftToken: null, photoIds: [], ip, ipHash: null })).toEqual({ ok: false, reason: "rate_limited" });
    expect((await db.select({ id: listings.id }).from(listings)).length).toBe(before);
    // Otra IP sigue pudiendo.
    const other = await createFromPublish({ values: await values(), draftToken: null, photoIds: [], ip: "10.251.1.1", ipHash: null });
    expect(other.ok).toBe(true);
    if (other.ok) created.push(other.listingId);
  });
});

describe("/mi-aviso", () => {
  it("acciones con el token: vendida, renovar, pausar, reanudar; token malo o de comercio → nada", async () => {
    const id = await fx.listing({ status: "published", publishedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), description: DESC });
    const token = await rotateManageToken(id);
    expect(await managedListing(token)).not.toBeNull();
    expect(await manageAction(token, "mark_sold", null)).toMatchObject({ ok: true });
    expect((await db.select({ s: listings.status }).from(listings).where(eq(listings.id, id)))[0].s).toBe("sold");
    expect(await manageAction(token, "renew", null)).toMatchObject({ ok: true });
    expect(await manageAction(token, "pause", null)).toMatchObject({ ok: true });
    expect(await manageAction(token, "resume", null)).toMatchObject({ ok: true });
    expect(await manageAction(token, "delete" as never, null)).toMatchObject({ ok: false });
    expect(await manageAction("x".repeat(43), "pause", null)).toMatchObject({ ok: false });
    const dealerId = await fx.dealer();
    const dl = await fx.listing({ status: "published", publishedAt: new Date(), dealerId });
    const dealerToken = await rotateManageToken(dl);
    expect(await managedListing(dealerToken)).toBeNull();
    expect(await manageAction(dealerToken, "pause", null)).toMatchObject({ ok: false });
  });

  it("re-moderación: precio sigue publicada (price_changed); descripción o foto → pending_review", async () => {
    const id = await fx.listing({ status: "published", publishedAt: new Date(), description: DESC, priceGs: 9_000_000 });
    const token = await rotateManageToken(id);
    const price = await manageEdit(token, { precio: "8.500.000", descripcion: DESC }, null);
    expect(price).toMatchObject({ ok: true });
    expect("remoderation" in price && price.remoderation).toBeFalsy();
    const [p] = await db.select().from(listings).where(eq(listings.id, id));
    expect(p).toMatchObject({ status: "published", priceGs: 8_500_000 });
    expect((await db.select({ a: activityLog.action }).from(activityLog).where(eq(activityLog.entityId, id))).map((x) => x.a)).toContain("price_changed");

    const desc = await manageEdit(token, { precio: "8500000", descripcion: `${DESC} Tiene alarma.` }, null);
    expect(desc).toMatchObject({ ok: true, remoderation: true });
    expect((await db.select({ s: listings.status }).from(listings).where(eq(listings.id, id)))[0].s).toBe("pending_review");

    const id2 = await fx.listing({ status: "published", publishedAt: new Date(), description: DESC });
    const t2 = await rotateManageToken(id2);
    const [img] = await db.select({ id: listingImages.id }).from(listingImages).where(eq(listingImages.listingId, id2));
    expect(await manageEdit(t2, { precio: "12500000", descripcion: DESC, removeImageIds: [img.id] }, null)).toMatchObject({ ok: true, remoderation: true });
    expect((await db.select({ s: listings.status }).from(listings).where(eq(listings.id, id2)))[0].s).toBe("pending_review");
    expect(await manageEdit(t2, { precio: "12500000", descripcion: "corta" }, null)).toMatchObject({ ok: false });
  });
});
