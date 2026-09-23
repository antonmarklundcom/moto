// B7 contra MySQL: slug reservado, comercio sin autorización no publica, slug
// inmutable tras publicar, rol equivocado → 403, sugerencias y baja de stock.
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { activityLog, brands, cities, dealers, listings, models, modelSuggestions } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { approveListing } from "@/components/admin/moderation/decide";
import { autoPublishIfAllowed } from "@/lib/import/publish";
import { saveCatalogItem, resolveSuggestion, slugLocked } from "./catalog-admin";
import { saveDealer, withdrawDealerStock, type DealerInput } from "./dealers-admin";
import { bulkListings, listingStateAction, searchAdminListings, updateListingAdmin } from "./listings-admin";

const TAG = `b7${Date.now()}`;
let fx: Awaited<ReturnType<typeof createFixtures>>;
const createdModels: number[] = [];
const createdBrands: number[] = [];

beforeAll(async () => {
  fx = await createFixtures(TAG);
});
afterAll(async () => {
  if (fx.ids.listings.length) await db.delete(modelSuggestions).where(inArray(modelSuggestions.listingId, fx.ids.listings));
  await db.delete(modelSuggestions).where(eq(modelSuggestions.rawText, `${TAG} Rally`));
  await fx.cleanup();
  if (createdModels.length) await db.delete(models).where(inArray(models.id, createdModels));
  if (createdBrands.length) await db.delete(brands).where(inArray(brands.id, createdBrands));
  await db.delete(activityLog).where(inArray(activityLog.entityType, ["catalog_marcas", "catalog_modelos", "dealer", "model_suggestion"]));
  await closeDb();
});

const dealerInput = (over: Partial<DealerInput> = {}): DealerInput => ({
  name: `Comercio ${TAG}`,
  slug: "",
  cityId: fx.base.cityId,
  address: null,
  phone: "0981 222 333",
  email: null,
  websiteUrl: null,
  description: null,
  status: "prospect",
  isVerified: false,
  autoApprove: false,
  authorizationNote: null,
  authorizationDate: null,
  authorizationChannel: null,
  freeUntil: null,
  listingTtlDays: 30,
  ...over,
});

describe("catálogo", () => {
  it("slug reservado rechazado (G-15) en marca, modelo, categoría y ciudad", async () => {
    const admin = await fx.user("admin");
    for (const slug of ["tipo", "ciudad", "nuevas", "usadas", "en-cuotas", "page"]) {
      const r = await saveCatalogItem(admin, "marcas", null, { name: "X", slug, isActive: true, sortOrder: 0 });
      expect(r.ok, slug).toBe(false);
      expect(!r.ok && r.errors.slug).toContain("reservado");
    }
    expect((await saveCatalogItem(admin, "modelos", null, { name: "Nuevas", slug: "", isActive: true, sortOrder: 0, brandId: fx.base.brandId })).ok).toBe(false);
  });

  it("slug inmutable después de la primera publicación publicada", async () => {
    const admin = await fx.user("admin");
    const r = await saveCatalogItem(admin, "marcas", null, { name: `Marca ${TAG}`, slug: `marca-${TAG}`, isActive: true, sortOrder: 99 });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    createdBrands.push(r.id);
    // Sin publicaciones: se puede cambiar.
    expect((await saveCatalogItem(admin, "marcas", r.id, { name: `Marca ${TAG}`, slug: `marca-${TAG}-b`, isActive: true, sortOrder: 99 })).ok).toBe(true);
    const m = await saveCatalogItem(admin, "modelos", null, { name: "M1", slug: `m1-${TAG}`, isActive: true, sortOrder: 0, brandId: r.id });
    if (!m.ok) throw new Error(JSON.stringify(m.errors));
    createdModels.push(m.id);
    await fx.listing({ brandId: r.id, modelId: m.id, status: "sold", publishedAt: new Date(), soldAt: new Date() });
    expect(await slugLocked("marcas", r.id)).toBe(true);
    const locked = await saveCatalogItem(admin, "marcas", r.id, { name: `Marca ${TAG}`, slug: `marca-${TAG}-c`, isActive: true, sortOrder: 99 });
    expect(!locked.ok && locked.errors.slug).toContain("no se cambia");
    // El nombre sí.
    expect((await saveCatalogItem(admin, "marcas", r.id, { name: `Marca ${TAG} SA`, slug: `marca-${TAG}-b`, isActive: true, sortOrder: 99 })).ok).toBe(true);
  });

  it("moderador no crea ni edita catálogo (403)", async () => {
    const mod = await fx.user("moderator");
    await expect(saveCatalogItem(mod, "marcas", null, { name: "X", slug: "x-mod", isActive: true, sortOrder: 0 })).rejects.toMatchObject({ status: 403 });
  });

  it("resolver una sugerencia creando el modelo pone model_id en la publicación", async () => {
    const admin = await fx.user("admin");
    const id = await fx.listing({ status: "pending_review", modelId: null, modelRaw: `${TAG} Rally` });
    const [sug] = await db.insert(modelSuggestions).values({ rawText: `${TAG} Rally`, brandId: fx.base.brandId, listingId: id }).$returningId();
    const r = await resolveSuggestion(admin, sug.id, { action: "create", name: `${TAG} Rally` });
    expect(r).toMatchObject({ ok: true, updatedListings: 1 });
    const [l] = await db.select({ modelId: listings.modelId }).from(listings).where(eq(listings.id, id));
    expect(l.modelId).not.toBeNull();
    createdModels.push(l.modelId!);
    const [s] = await db.select().from(modelSuggestions).where(eq(modelSuggestions.id, sug.id));
    expect(s).toMatchObject({ status: "created", mappedModelId: l.modelId });
  });
});

describe("comercios", () => {
  it("activar exige el bloque de autorización; texto sin fecha no vale; moderador no edita (403)", async () => {
    const admin = await fx.user("admin");
    const mod = await fx.user("moderator");
    const bad = await saveDealer(admin, null, dealerInput({ status: "active" }));
    expect(!bad.ok && bad.errors.status).toContain("autorización");
    const half = await saveDealer(admin, null, dealerInput({ authorizationNote: "Autorizo" }));
    expect(!half.ok && half.errors.authorizationNote).toBeDefined();
    const reserved = await saveDealer(admin, null, dealerInput({ slug: "ciudad" }));
    expect(!reserved.ok && reserved.errors.slug).toContain("reservado");
    await expect(saveDealer(mod, null, dealerInput())).rejects.toMatchObject({ status: 403 });
    const ok = await saveDealer(admin, null, dealerInput({ name: `Con auth ${TAG}`, status: "active", authorizationNote: "Autorizo publicar", authorizationDate: "2026-09-01", authorizationChannel: "whatsapp" }));
    if (!ok.ok) throw new Error(JSON.stringify(ok.errors));
    fx.ids.dealers.push(ok.id);
  });

  it("un comercio sin autorización no llega a publicar por ningún camino (moderación, importación, reanudar)", async () => {
    const admin = await fx.user("admin");
    const noAuth = await saveDealer(admin, null, dealerInput({ name: `Sin auth ${TAG}`, autoApprove: true }));
    if (!noAuth.ok) throw new Error(JSON.stringify(noAuth.errors));
    fx.ids.dealers.push(noAuth.id);
    const pending = await fx.listing({ status: "pending_review", dealerId: noAuth.id });
    expect(await approveListing(admin, { listingId: pending, siteUrl: "https://moto.com.py" })).toMatchObject({ ok: false });
    expect(await autoPublishIfAllowed(pending)).toMatchObject({ status: "pending_review", reason: "dealer" });
    const paused = await fx.listing({ status: "paused", dealerId: noAuth.id, publishedAt: new Date() });
    expect(await listingStateAction(admin, paused, "resume")).toMatchObject({ ok: false });
    const rows = await db.select({ status: listings.status }).from(listings).where(inArray(listings.id, [pending, paused]));
    expect(rows.map((r) => r.status).sort()).toEqual(["paused", "pending_review"]);
  });

  it("slug del comercio inmutable después de publicar; baja de todo el stock pausa y quita la autorización", async () => {
    const admin = await fx.user("admin");
    const d = await saveDealer(admin, null, dealerInput({ name: `Baja ${TAG}`, status: "active", authorizationNote: "Autorizo", authorizationDate: "2026-09-01" }));
    if (!d.ok) throw new Error(JSON.stringify(d.errors));
    fx.ids.dealers.push(d.id);
    const l1 = await fx.listing({ status: "published", dealerId: d.id, publishedAt: new Date() });
    const [row] = await db.select().from(dealers).where(eq(dealers.id, d.id));
    const renamed = await saveDealer(admin, d.id, dealerInput({ name: row.name, slug: `${row.slug}-x`, status: "active", authorizationNote: "Autorizo", authorizationDate: "2026-09-01" }));
    expect(!renamed.ok && renamed.errors.slug).toContain("no se cambia");
    expect(await withdrawDealerStock(admin, d.id, "Lo pidió por WhatsApp")).toMatchObject({ ok: true, paused: 1 });
    const [after] = await db.select().from(dealers).where(eq(dealers.id, d.id));
    expect(after).toMatchObject({ status: "paused", authorizationDate: null, autoApprove: false });
    expect(after.authorizationNote).toContain("Autorización retirada");
    const [l] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, l1));
    expect(l.status).toBe("paused");
  });
});

describe("publicaciones", () => {
  it("dealer (fase 2 sin panel) → 403 al buscar, editar o accionar", async () => {
    const dealerId = await fx.dealer();
    const dealer = await fx.user("dealer", { dealerId });
    const id = await fx.listing({ dealerId });
    await expect(searchAdminListings(dealer, {})).rejects.toMatchObject({ status: 403 });
    await expect(bulkListings(dealer, [id], "pause")).rejects.toMatchObject({ status: 403 });
    await expect(listingStateAction(null, id, "pause")).rejects.toMatchObject({ status: 401 });
  });

  it("buscar por ref pública o teléfono; editar precio → price_changed y sigue publicada; vencer y extender en masa", async () => {
    const admin = await fx.user("admin");
    const id = await fx.listing({ status: "published", publishedAt: new Date(), expiresAt: new Date(Date.now() + 5 * 86_400_000), contactPhoneE164: "+595981777888" });
    const [row] = await db.select().from(listings).where(eq(listings.id, id));
    expect((await searchAdminListings(admin, { q: row.publicRef.toLowerCase() })).rows.map((r) => r.id)).toContain(id);
    expect((await searchAdminListings(admin, { q: "0981 777 888" })).rows.map((r) => r.id)).toContain(id);
    const edit = await updateListingAdmin(admin, id, {
      title: row.title,
      description: "Nueva descripción",
      priceGs: 11_000_000,
      hasFinancingOnly: false,
      downPaymentGs: null,
      installmentGs: null,
      installmentCount: null,
      year: row.year,
      mileageKm: row.mileageKm,
      isNegotiable: false,
      acceptsTradeIn: false,
      contactPhone: "0981 777 888",
      contactWhatsapp: true,
      documentationStatus: "al_dia",
      cityId: row.cityId,
      categoryId: row.categoryId,
      modelId: row.modelId,
      dealerId: null,
      internalNote: "corrección pedida por el vendedor",
    });
    expect(edit).toMatchObject({ ok: true });
    const acts = await db.select({ action: activityLog.action }).from(activityLog).where(eq(activityLog.entityId, id));
    expect(acts.map((a) => a.action)).toEqual(expect.arrayContaining(["price_changed", "admin_edit"]));
    const [after] = await db.select().from(listings).where(eq(listings.id, id));
    expect(after).toMatchObject({ status: "published", priceGs: 11_000_000 });
    expect(await bulkListings(admin, [id], "extend", 10)).toMatchObject({ done: 1 });
    expect(await bulkListings(admin, [id], "expire")).toMatchObject({ done: 1 });
    const [expired] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, id));
    expect(expired.status).toBe("expired");
  });
});

void cities;
