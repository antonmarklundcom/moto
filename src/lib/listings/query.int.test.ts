// T-101 contra MySQL real (TEST_PLAN.md §3): cada combinación de filtros
// devuelve sólo publicaciones vivas, paginación sin duplicados ni saltos,
// texto libre por FULLTEXT y por LIKE (F-11).
//
// Todo queda acotado a un comercio de prueba (filtro dealerId) para no
// depender de otras filas de la base de pruebas.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { brands, categories, cities, dealers, listingImages, listings, models } from "@/db/schema";
import { publicRef } from "@/lib/slug";
import type { ListingFilters, ListingSort } from "./filters";
import { SORTS } from "./filters";
import { countLiveListings, groupLiveCounts, resolveFacetSlugs, searchListings, SOLD_LIVE_DAYS } from "./query";

const TAG = `a2q${Date.now().toString(36)}`;
const NOW = new Date("2026-09-22T12:00:00Z");
const DAY = 86_400_000;

type Row = typeof listings.$inferInsert & { id: number };
const rows: Row[] = [];
let dealerId = 0;
let catalog: {
  brands: { id: number; slug: string }[];
  models: { id: number; brandId: number; slug: string; name: string }[];
  cities: { id: number; slug: string }[];
  categories: { id: number; slug: string }[];
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function isLive(r: Row): boolean {
  if (r.deletedAt) return false;
  if (r.status === "published") return true;
  return r.status === "sold" && !!r.soldAt && r.soldAt.getTime() >= NOW.getTime() - SOLD_LIVE_DAYS * DAY;
}

/** Oráculo en JS de la misma regla que listingWhere (sin texto libre). */
function matches(r: Row, f: ListingFilters): boolean {
  const le = (v: number | null | undefined, max?: number) => max === undefined || (v !== null && v !== undefined && v <= max);
  const ge = (v: number | null | undefined, min?: number) => min === undefined || (v !== null && v !== undefined && v >= min);
  return (
    isLive(r) &&
    (f.brandId === undefined || r.brandId === f.brandId) &&
    (f.modelId === undefined || r.modelId === f.modelId) &&
    (f.categoryId === undefined || r.categoryId === f.categoryId) &&
    (f.cityId === undefined || r.cityId === f.cityId) &&
    (f.condition === undefined || r.condition === f.condition) &&
    ge(r.priceGs, f.priceMin) &&
    le(r.priceGs, f.priceMax) &&
    ge(r.year, f.yearMin) &&
    le(r.mileageKm, f.kmMax) &&
    ge(r.engineCc, f.ccMin) &&
    le(r.engineCc, f.ccMax) &&
    le(r.downPaymentGs, f.downPaymentMax) &&
    le(r.installmentGs, f.installmentMax) &&
    (!f.withFinancing || (r.installmentGs != null && r.installmentCount != null))
  );
}

async function insert(values: Omit<typeof listings.$inferInsert, "slug" | "publicRef" | "contactPhoneE164" | "contactPhoneRaw">) {
  const n = rows.length + 1;
  const full = {
    slug: `${TAG}-${n}`,
    publicRef: publicRef(),
    contactPhoneE164: "+595981123456",
    contactPhoneRaw: "0981 123 456",
    dealerId,
    ...values,
  };
  const [res] = await db.insert(listings).values(full);
  rows.push({ ...full, id: res.insertId });
  return res.insertId;
}

beforeAll(async () => {
  const bs = await db.select({ id: brands.id, slug: brands.slug }).from(brands).where(eq(brands.isActive, true)).limit(3);
  const ms = await db
    .select({ id: models.id, brandId: models.brandId, slug: models.slug, name: models.name })
    .from(models)
    .where(and(eq(models.isActive, true), inArray(models.brandId, bs.map((b) => b.id))));
  const cs = await db.select({ id: cities.id, slug: cities.slug }).from(cities).where(eq(cities.isActive, true)).limit(3);
  const cats = await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(eq(categories.isActive, true)).limit(3);
  if (bs.length < 2 || ms.length < 2 || cs.length < 2 || cats.length < 2) throw new Error("Falta catálogo en la base de pruebas");
  catalog = { brands: bs, models: ms, cities: cs, categories: cats };

  const [d] = await db.insert(dealers).values({
    name: `[DEV] Comercio ${TAG}`,
    slug: `dev-${TAG}`,
    cityId: cs[0].id,
    phoneE164: "+595981000000",
    phoneRaw: "0981 000 000",
    isVerified: true,
  });
  dealerId = d.insertId;

  // 60 publicaciones con atributos pseudoaleatorios y todos los estados.
  const rand = rng(42);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const statuses = ["published", "published", "published", "sold", "sold", "expired", "paused", "draft", "pending_review", "rejected"] as const;
  for (let i = 0; i < 60; i += 1) {
    const model = pick(ms);
    const status = pick(statuses);
    const financing = rand() < 0.5;
    const financingOnly = financing && rand() < 0.3;
    await insert({
      title: `[DEV] ${TAG} unidad ${i}`,
      brandId: model.brandId,
      modelId: model.id,
      categoryId: pick(cats).id,
      cityId: pick(cs).id,
      condition: rand() < 0.4 ? "new" : "used",
      year: rand() < 0.1 ? null : 2015 + Math.floor(rand() * 11),
      mileageKm: rand() < 0.1 ? null : Math.floor(rand() * 60) * 1000,
      engineCc: pick([110, 125, 150, 200, 250, null]),
      priceGs: financingOnly ? null : 5_000_000 + Math.floor(rand() * 20) * 1_000_000,
      hasFinancingOnly: financingOnly,
      downPaymentGs: financing ? pick([1_000_000, 2_000_000, 3_000_000]) : null,
      installmentGs: financing ? pick([450_000, 650_000, 900_000]) : null,
      installmentCount: financing ? pick([12, 24, 36]) : null,
      status,
      // Empates a propósito: varias con la misma fecha de publicación.
      publishedAt: new Date(NOW.getTime() - Math.floor(rand() * 10) * DAY),
      soldAt: status === "sold" ? new Date(NOW.getTime() - pick([5, 60, 89, 91, 200]) * DAY) : null,
      deletedAt: status === "published" && rand() < 0.1 ? NOW : null,
    });
  }
  // Bordes exactos de "viva": vendida justo a 90 días (viva) y un ms antes (no).
  await insert({ title: `[DEV] ${TAG} borde viva`, brandId: ms[0].brandId, modelId: ms[0].id, categoryId: cats[0].id, cityId: cs[0].id, condition: "used", status: "sold", soldAt: new Date(NOW.getTime() - SOLD_LIVE_DAYS * DAY), publishedAt: NOW });
  await insert({ title: `[DEV] ${TAG} borde muerta`, brandId: ms[0].brandId, modelId: ms[0].id, categoryId: cats[0].id, cityId: cs[0].id, condition: "used", status: "sold", soldAt: new Date(NOW.getTime() - SOLD_LIVE_DAYS * DAY - 1000), publishedAt: NOW });
  // Texto libre.
  await insert({ title: `[DEV] ${TAG} Zorbatrix Especial`, description: "Moto de prueba con palabra única.", brandId: ms[0].brandId, modelId: ms[0].id, categoryId: cats[0].id, cityId: cs[0].id, condition: "used", status: "published", publishedAt: NOW, priceGs: 9_000_000 });
  await insert({ title: `[DEV] ${TAG} Qx 100% original`, brandId: ms[1].brandId, modelId: ms[1].id, modelRaw: "QX-9 Zorbatrix", categoryId: cats[0].id, cityId: cs[0].id, condition: "used", status: "published", publishedAt: NOW, priceGs: 8_000_000 });
  const withPhotos = rows[rows.length - 2].id; // "Zorbatrix Especial", published
  await db.insert(listingImages).values([
    { listingId: withPhotos, storagePath: `dev/${TAG}/b.webp`, contentHash: "0".repeat(64), sortOrder: 2 },
    { listingId: withPhotos, storagePath: `dev/${TAG}/a.webp`, contentHash: "0".repeat(64), sortOrder: 1, width: 800, height: 600, altText: "alt real" },
  ]);
});

afterAll(async () => {
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await db.delete(listingImages).where(inArray(listingImages.listingId, ids));
    await db.delete(listings).where(inArray(listings.id, ids));
  }
  if (dealerId) await db.delete(dealers).where(eq(dealers.id, dealerId));
  await closeDb();
});

async function allIds(filters: ListingFilters, sort: ListingSort = "recientes", perPage = 50) {
  const res = await searchListings({ filters: { ...filters, dealerId }, sort, perPage, now: NOW });
  return res.items.map((i) => i.id).sort((a, b) => a - b);
}
const expected = (f: ListingFilters) => rows.filter((r) => matches(r, f)).map((r) => r.id).sort((a, b) => a - b);

describe("publicaciones vivas", () => {
  it("sólo published + sold < 90 días, sin borradas; borde exacto de 90 días", async () => {
    const live = expected({});
    expect(live.length).toBeGreaterThan(10);
    expect(await allIds({})).toEqual(live);
    expect(await countLiveListings({ dealerId }, NOW)).toBe(live.length);
    const byTitle = (t: string) => rows.find((r) => r.title.endsWith(t))!.id;
    expect(live).toContain(byTitle("borde viva"));
    expect(live).not.toContain(byTitle("borde muerta"));
  });

  it("scope available = sólo published", async () => {
    const res = await searchListings({ filters: { dealerId }, scope: "available", perPage: 50, now: NOW });
    expect(res.items.every((i) => i.status === "published")).toBe(true);
    expect(res.total).toBe(rows.filter((r) => r.status === "published" && !r.deletedAt).length);
  });
});

describe("cada combinación de filtros devuelve sólo vivas (oráculo en JS)", () => {
  it("200 combinaciones aleatorias", async () => {
    const rand = rng(7);
    const maybe = <T,>(value: T) => (rand() < 0.35 ? value : undefined);
    for (let i = 0; i < 200; i += 1) {
      const model = catalog.models[Math.floor(rand() * catalog.models.length)];
      const f: ListingFilters = Object.fromEntries(
        Object.entries({
          brandId: maybe(model.brandId),
          modelId: rand() < 0.15 ? model.id : undefined,
          categoryId: maybe(catalog.categories[Math.floor(rand() * catalog.categories.length)].id),
          cityId: maybe(catalog.cities[Math.floor(rand() * catalog.cities.length)].id),
          condition: maybe(rand() < 0.5 ? ("new" as const) : ("used" as const)),
          priceMin: maybe(8_000_000),
          priceMax: maybe(18_000_000),
          yearMin: maybe(2019),
          kmMax: maybe(30_000),
          ccMin: maybe(125),
          ccMax: maybe(200),
          downPaymentMax: maybe(2_000_000),
          installmentMax: maybe(650_000),
          withFinancing: rand() < 0.2 ? true : undefined,
        }).filter(([, v]) => v !== undefined),
      );
      expect(await allIds(f), JSON.stringify(f)).toEqual(expected(f));
    }
  });
});

describe("paginación estable", () => {
  it.each(SORTS)("orden %s: sin duplicados ni saltos, con empates", async (sort) => {
    const live = expected({});
    const perPage = 7;
    const seen: number[] = [];
    const first = await searchListings({ filters: { dealerId }, sort, perPage, page: 1, now: NOW });
    expect(first.pageCount).toBe(Math.ceil(live.length / perPage));
    for (let page = 1; page <= first.pageCount; page += 1) {
      const res = await searchListings({ filters: { dealerId }, sort, perPage, page, now: NOW });
      seen.push(...res.items.map((i) => i.id));
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort((a, b) => a - b)).toEqual(live);
    const beyond = await searchListings({ filters: { dealerId }, sort, perPage, page: first.pageCount + 1, now: NOW });
    expect(beyond.items).toEqual([]);
  });

  it("precio_asc ordena por precio con los NULL al final", async () => {
    const res = await searchListings({ filters: { dealerId }, sort: "precio_asc", perPage: 50, now: NOW });
    const prices = res.items.map((i) => i.priceGs);
    const firstNull = prices.indexOf(null);
    const numbers = (firstNull === -1 ? prices : prices.slice(0, firstNull)) as number[];
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    if (firstNull !== -1) expect(prices.slice(firstNull).every((p) => p === null)).toBe(true);
  });
});

describe("texto libre (F-11)", () => {
  const ids = (title: string) => rows.filter((r) => r.title.includes(title)).map((r) => r.id);
  it("≥ 3 caracteres: FULLTEXT sobre título y descripción, con prefijo", async () => {
    expect(await allIds({ q: "zorbatrix" })).toEqual(ids("Zorbatrix Especial"));
    expect(await allIds({ q: "Zorbat" })).toEqual(ids("Zorbatrix Especial"));
    expect(await allIds({ q: "palabra única" })).toEqual(ids("Zorbatrix Especial"));
  });
  it("< 3 caracteres: LIKE sobre título, modelo y modelo escrito", async () => {
    expect(await allIds({ q: "qx" })).toEqual(ids("Qx 100%"));
    const res = await searchListings({ filters: { dealerId, q: "qx" }, now: NOW });
    expect(res.total).toBe(1);
  });
  it("mezcla: todos los términos obligatorios", async () => {
    expect(await allIds({ q: "qx original" })).toEqual(ids("Qx 100%"));
    expect(await allIds({ q: "qx zorbatrix especial" })).toEqual([]);
  });
  it("operadores y comodines no rompen ni se interpretan", async () => {
    expect(await allIds({ q: '+zorbatrix -especial ~"(especial)" @ *' })).toEqual(ids("Zorbatrix Especial"));
    expect(await allIds({ q: "%" })).toEqual(expected({}));
    expect(await allIds({ q: "_" })).toEqual(expected({}));
  });
});

describe("tarjeta, conteos y facetas", () => {
  it("la tarjeta trae catálogo, comercio verificado y la primera foto por sort_order", async () => {
    const res = await searchListings({ filters: { dealerId }, perPage: 50, now: NOW });
    const withPhotos = res.items.find((i) => i.title.endsWith("Zorbatrix Especial"));
    expect(withPhotos?.image).toMatchObject({ url: `/media/dev/${TAG}/a.webp`, width: 800, height: 600, alt: "alt real" });
    expect(res.items.find((i) => i.title.endsWith("Qx 100% original"))?.image).toBeNull();
    const any = res.items[0];
    expect(any.brand.slug).toMatch(/^[a-z0-9-]+$/);
    expect(any.city.slug).toMatch(/^[a-z0-9-]+$/);
    expect(any.dealer).toMatchObject({ id: dealerId, isVerified: true });
  });

  it("groupLiveCounts coincide con countLiveListings por cada grupo", async () => {
    const groups = await groupLiveCounts(["brand", "city"], { dealerId }, NOW);
    let sum = 0;
    for (const g of groups) {
      sum += g.count;
      expect(g.count).toBe(await countLiveListings({ dealerId, brandId: g.key.brand as number, cityId: g.key.city as number }, NOW));
    }
    expect(sum).toBe(expected({}).length);
  });

  it("resolveFacetSlugs: slugs activos, modelo dentro de su marca", async () => {
    const model = catalog.models[0];
    const brand = catalog.brands.find((b) => b.id === model.brandId)!;
    const otherBrand = catalog.brands.find((b) => b.id !== model.brandId)!;
    const r = await resolveFacetSlugs({ brand: brand.slug, model: model.slug, city: catalog.cities[0].slug, category: catalog.categories[0].slug });
    expect(r).toMatchObject({ brand: { id: brand.id }, model: { id: model.id }, city: { id: catalog.cities[0].id }, category: { id: catalog.categories[0].id } });
    expect(await resolveFacetSlugs({ brand: "no-existe-xyz" })).toBeNull();
    expect(await resolveFacetSlugs({ model: model.slug })).toBeNull();
    expect(await resolveFacetSlugs({ brand: otherBrand.slug, model: model.slug })).toBeNull();
    expect(await resolveFacetSlugs({})).toEqual({});
  });
});
