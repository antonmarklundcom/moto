// B1 contra MySQL: umbral exacto (N−1 / N) y palabras, SITE_NOINDEX, 404 y
// redirecciones del formulario de filtros, rango de precios sólo con N ≥ 5.
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { brands, categories, cities, listings, models } from "@/db/schema";
import { publicRef } from "@/lib/slug";
import { loadBrowse } from "./data";

const TAG = `b1${Date.now()}`;
const ids: number[] = [];
let brand: { id: number; slug: string; introHtml: string | null };
let city: { id: number; slug: string };
let categoryId: number;
let modelId: number;
const WORDS_300 = `<p>${Array.from({ length: 300 }, (_, i) => `palabra${i}`).join(" ")}</p>`;

async function addListing(extra: Partial<typeof listings.$inferInsert> = {}) {
  const n = ids.length + 1;
  const [res] = await db.insert(listings).values({
    slug: `dev-${TAG}-${n}`,
    publicRef: publicRef(),
    title: `[DEV] ${TAG} ${n}`,
    brandId: brand.id,
    modelId,
    categoryId,
    cityId: city.id,
    condition: "used",
    priceGs: 10_000_000 + n * 100_000,
    contactPhoneE164: "+595981123456",
    contactPhoneRaw: "0981 123 456",
    status: "published",
    publishedAt: new Date(),
    ...extra,
  });
  ids.push(res.insertId);
  return res.insertId;
}

const load = (route: object, query = "") => loadBrowse(JSON.stringify(route), query);
const previousMode = process.env.SITE_NOINDEX;

beforeAll(async () => {
  // Una marca activa sin publicaciones en la base de pruebas: TVS.
  [brand] = await db.select({ id: brands.id, slug: brands.slug, introHtml: brands.introHtml }).from(brands).where(eq(brands.slug, "tvs"));
  [city] = await db.select({ id: cities.id, slug: cities.slug }).from(cities).where(eq(cities.slug, "encarnacion"));
  [{ id: categoryId }] = await db.select({ id: categories.id }).from(categories).limit(1);
  [{ id: modelId }] = await db.select({ id: models.id }).from(models).where(eq(models.brandId, brand.id)).limit(1);
  for (let i = 0; i < 4; i += 1) await addListing();
  process.env.SITE_NOINDEX = "false";
});

afterAll(async () => {
  process.env.SITE_NOINDEX = previousMode;
  await db.update(brands).set({ introHtml: brand.introHtml }).where(eq(brands.id, brand.id));
  if (ids.length) await db.delete(listings).where(inArray(listings.id, ids));
  await closeDb();
});

describe("umbral de indexación de la página de marca (§2.1: 5 vivas y 300 palabras)", () => {
  it("4 vivas → noindex aunque tenga texto; rango de precios oculto (< 5)", async () => {
    await db.update(brands).set({ introHtml: WORDS_300 }).where(eq(brands.id, brand.id));
    const d = await load({ kind: "brand", brand: "tvs" });
    if (d.status !== "ok") throw new Error(d.status);
    expect(d.liveCount).toBe(4);
    expect(d.seo.robots).toEqual({ index: false, follow: true });
    expect(d.priceRange).toBeNull();
    expect(d.copy.title).toBe("Motos TVS en Paraguay — 4 publicadas");
  });

  it("5 vivas + 300 palabras → index; sin texto → noindex; con SITE_NOINDEX=true → noindex", async () => {
    await addListing();
    let d = await load({ kind: "brand", brand: "tvs" }, "x=1");
    if (d.status !== "ok") throw new Error(d.status);
    expect(d.liveCount).toBe(5);
    expect(d.seo.robots.index).toBe(true);
    expect(d.priceRange).toMatchObject({ n: 5, min: "Gs. 10.100.000", max: "Gs. 10.500.000" });

    await db.update(brands).set({ introHtml: "<p>poco texto</p>" }).where(eq(brands.id, brand.id));
    d = await load({ kind: "brand", brand: "tvs" }, "x=2");
    expect(d.status === "ok" && d.seo.robots.index).toBe(false);

    await db.update(brands).set({ introHtml: WORDS_300 }).where(eq(brands.id, brand.id));
    process.env.SITE_NOINDEX = "true";
    d = await load({ kind: "brand", brand: "tvs" }, "x=3");
    expect(d.status === "ok" && d.seo.robots.index).toBe(false);
    process.env.SITE_NOINDEX = "false";
  });

  it("una vendida hace > 90 días, borrada o pendiente no cuenta como viva", async () => {
    await addListing({ status: "sold", soldAt: new Date(Date.now() - 100 * 86_400_000) });
    await addListing({ status: "pending_review", publishedAt: null });
    await addListing({ deletedAt: new Date() });
    const d = await load({ kind: "brand", brand: "tvs" }, "x=4");
    expect(d.status === "ok" && d.liveCount).toBe(5);
  });

  it("con filtros: noindex y canonical limpio; con ?page=2 inexistente → 404", async () => {
    const d = await load({ kind: "brand", brand: "tvs" }, "precio_max=10300000");
    if (d.status !== "ok") throw new Error(d.status);
    expect(d.seo.robots.index).toBe(false);
    expect(d.seo.canonical).toBe("/motos/tvs");
    expect(d.search.total).toBe(3);
    expect(d.removals.map((r) => r.href)).toEqual(["/motos/tvs"]);
    expect((await load({ kind: "brand", brand: "tvs" }, "page=2")).status).toBe("not_found");
  });
});

describe("rutas", () => {
  it("marca inactiva, inexistente o ciudad inexistente → 404", async () => {
    expect((await load({ kind: "brand", brand: "zanella" })).status).toBe("not_found");
    expect((await load({ kind: "brand", brand: "no-existe" })).status).toBe("not_found");
    expect((await load({ kind: "brand_city", brand: "tvs", city: "no-existe" })).status).toBe("not_found");
  });

  it("marca × ciudad: 5 vivas < 10 → noindex, con alternativas reales", async () => {
    const d = await load({ kind: "brand_city", brand: "tvs", city: city.slug });
    if (d.status !== "ok") throw new Error(d.status);
    expect(d.liveCount).toBe(5);
    expect(d.seo.robots.index).toBe(false);
    expect(d.alternatives.map((a) => a.href)).toContain("/motos/tvs");
  });

  it("el formulario de /motos redirige a la URL limpia y descarta lo vacío o inválido", async () => {
    expect(await load({ kind: "motos" }, "marca=tvs&tipo=&ciudad=&precio_max=")).toEqual({ status: "redirect", location: "/motos/tvs" });
    expect(await load({ kind: "motos" }, "marca=tvs&ciudad=encarnacion&cuota_max=500.000")).toEqual({
      status: "redirect",
      location: "/motos/tvs/ciudad/encarnacion?cuota_max=500000",
    });
    expect(await load({ kind: "motos" }, "condicion=usada")).toEqual({ status: "redirect", location: "/motos/usadas" });
    expect(await load({ kind: "motos" }, "marca=no-existe")).toEqual({ status: "redirect", location: "/motos" });
    // Parámetros ajenos (campañas) se conservan y solos no redirigen.
    expect(await load({ kind: "motos" }, "marca=tvs&utm_source=fb&gclid=abc")).toEqual({
      status: "redirect",
      location: "/motos/tvs?utm_source=fb&gclid=abc",
    });
    expect((await load({ kind: "motos" }, "utm_source=fb&gclid=abc")).status).toBe("ok");
    // Tres facetas no tienen página (§2.3): quedan como filtros en /motos, ya limpios → sin redirección.
    const three = await load({ kind: "motos" }, "marca=tvs&tipo=naked&ciudad=encarnacion");
    expect(three.status).toBe("ok");
  });
});
