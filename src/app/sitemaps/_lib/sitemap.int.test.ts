// Sitemaps contra MySQL (C1): en los tres modos de SITE_NOINDEX, ninguna URL
// del sitemap es una página que se sirva `noindex`. La prueba no confía en el
// generador: carga cada página programática con su propio loader (el mismo
// que usa Next) y mira su `robots`.
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadBrowse } from "@/components/browse/data";
import { loadEnCuotasPage, loadModelPage } from "@/components/financing-compare/model-data";
import { closeDb, db } from "@/db";
import { brands, listings, models } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { isListingIndexable } from "@/lib/seo/indexability";
import { parseListingParam } from "@/lib/seo/routes";
import { robotsTxt } from "../../robots.txt/robots";
import { HUB_SEGMENTS, indexChildren, parseSegment, segmentEntries, sitemapIndexXml, urlsetXml, type Segment } from "./sitemap";

const SITE = "https://moto.com.py";
const TAG = `c1sm${Date.now().toString(36)}`;
let fx: Awaited<ReturnType<typeof createFixtures>>;
let model: { id: number; brandId: number; slug: string; brandSlug: string; introHtml: string | null };
const ids = { live: [] as number[], paused: 0 };
const originalMode = process.env.SITE_NOINDEX;

const words = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ")}</p>`;

beforeAll(async () => {
  fx = await createFixtures(TAG);
  const [m] = await db
    .select({ id: models.id, brandId: models.brandId, slug: models.slug, brandSlug: brands.slug, introHtml: models.introHtml })
    .from(models)
    .innerJoin(brands, eq(brands.id, models.brandId))
    .where(and(eq(models.isActive, true), eq(brands.isActive, true)))
    .limit(1);
  model = m;
  // Modelo que pasa el umbral (3 vivas + 250 palabras) para que haya algo en models.xml.
  await db.update(models).set({ introHtml: words(260) }).where(eq(models.id, model.id));
  for (let i = 0; i < 3; i += 1) {
    ids.live.push(await fx.listing({ status: "published", publishedAt: new Date(), brandId: model.brandId, modelId: model.id }));
  }
  ids.paused = await fx.listing({ status: "paused", brandId: model.brandId, modelId: model.id });
});

afterAll(async () => {
  await db.update(models).set({ introHtml: model.introHtml }).where(eq(models.id, model.id));
  await fx.cleanup();
  if (originalMode === undefined) delete process.env.SITE_NOINDEX;
  else process.env.SITE_NOINDEX = originalMode;
  await closeDb();
});

async function allEntries(): Promise<Map<Segment, string[]>> {
  const out = new Map<Segment, string[]>();
  for (const child of await indexChildren(SITE)) {
    const seg = parseSegment(child.loc.split("/").pop()!)!;
    out.set(seg, (await segmentEntries(seg, SITE)).map((e) => e.loc));
  }
  return out;
}

/** ¿La página de esta URL se sirve indexable? Con el loader real de cada tipo. */
async function servedIndexable(loc: string): Promise<boolean> {
  const path = new URL(loc).pathname;
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "aviso") {
    const parsed = parseListingParam(parts[1]);
    const [l] = await db.select().from(listings).where(eq(listings.publicRef, parsed!.ref));
    return Boolean(l) && isListingIndexable({ status: l.status, soldAt: l.soldAt, deletedAt: l.deletedAt });
  }
  if (parts[0] !== "motos") return true; // contenido: se chequea por modo abajo
  const browse = async (route: object) => {
    const d = await loadBrowse(JSON.stringify(route), "");
    return d.status === "ok" && d.seo.robots.index === true;
  };
  if (parts.length === 1) return browse({ kind: "motos" });
  if (parts[1] === "en-cuotas") {
    const d = await loadEnCuotasPage("");
    return d.status === "ok" && d.seo.robots.index === true;
  }
  if (parts[1] === "nuevas" || parts[1] === "usadas") return browse({ kind: "condition", condition: parts[1] === "nuevas" ? "new" : "used" });
  if (parts[1] === "tipo") return parts.length === 3 ? browse({ kind: "category", category: parts[2] }) : browse({ kind: "category_city", category: parts[2], city: parts[4] });
  if (parts[1] === "ciudad") return browse({ kind: "city", city: parts[2] });
  if (parts.length === 2) return browse({ kind: "brand", brand: parts[1] });
  if (parts[2] === "ciudad") return browse({ kind: "brand_city", brand: parts[1], city: parts[3] });
  const d = await loadModelPage(parts[1], parts[2], "");
  return d.status === "ok" && d.seo.robots.index === true;
}

describe("sitemaps en los tres modos de SITE_NOINDEX", () => {
  it("true: índice vacío y ningún segmento con URLs", async () => {
    process.env.SITE_NOINDEX = "true";
    expect(await indexChildren(SITE)).toEqual([]);
    for (const seg of ["content", "listings-1", ...HUB_SEGMENTS] as Segment[]) expect(await segmentEntries(seg, SITE)).toEqual([]);
    expect(sitemapIndexXml([])).toContain("<sitemapindex");
  });

  it("content: sólo content.xml, sin inventario ni legales sin texto", async () => {
    process.env.SITE_NOINDEX = "content";
    const all = await allEntries();
    expect([...all.keys()]).toEqual(["content"]);
    const locs = all.get("content")!;
    expect(locs).toContain(SITE); // la home, como su canonical (sin barra final)
    expect(locs.some((l) => l.includes("/motos") || l.includes("/aviso/"))).toBe(false);
    expect(locs).not.toContain(`${SITE}/terminos`);
    expect(locs).not.toContain(`${SITE}/privacidad`);
  });

  it("false: cada URL de inventario se sirve indexable según su propio loader; pausadas fuera", async () => {
    process.env.SITE_NOINDEX = "false";
    const all = await allEntries();
    const flat = [...all.values()].flat();
    expect(flat.length).toBeGreaterThan(0);
    expect(new Set(flat).size).toBe(flat.length); // sin duplicados
    for (const loc of flat) expect(await servedIndexable(loc), loc).toBe(true);

    const refs = await db.select({ id: listings.id, ref: listings.publicRef }).from(listings).where(inArray(listings.id, [...ids.live, ids.paused]));
    const listed = (id: number) => flat.some((l) => l.endsWith(`-${refs.find((r) => r.id === id)!.ref.toLowerCase()}`));
    for (const id of ids.live) expect(listed(id)).toBe(true);
    expect(listed(ids.paused)).toBe(false);
    expect(all.get("models")).toContain(`${SITE}/motos/${model.brandSlug}/${model.slug}`);
  });

  it("XML: bien formado y con lastmod real (nunca inventado)", async () => {
    process.env.SITE_NOINDEX = "false";
    const entries = await segmentEntries("listings-1", SITE);
    const xml = urlsetXml(entries);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<url>/g)?.length).toBe(entries.length);
    expect(xml).not.toMatch(/priority|changefreq/);
    expect(urlsetXml([{ loc: `${SITE}/a?b=1&c=2` }])).toContain("&amp;");
    for (const e of entries) expect(e.lastmod).toBeInstanceOf(Date);
  });

  it("nombres de segmento: sólo los conocidos", () => {
    expect(parseSegment("listings-2.xml")).toBe("listings-2");
    expect(parseSegment("brands.xml")).toBe("brands");
    expect(parseSegment("listings.xml")).toBeNull();
    expect(parseSegment("../x.xml")).toBeNull();
    expect(parseSegment("brands-1.xml")).toBeNull();
  });

  it("robots.txt: reglas de §3.4 y Sitemap absoluto", () => {
    const txt = robotsTxt(SITE);
    for (const line of ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", "Disallow: /ir/", "Disallow: /*?orden=", "Disallow: /*?q=", "Disallow: /mi-aviso/", `Sitemap: ${SITE}/sitemap.xml`]) {
      expect(txt.split("\n")).toContain(line);
    }
    // Los filtros no se bloquean: el noindex tiene que poder verse.
    expect(txt).not.toMatch(/marca=|ciudad=|precio/);
  });
});
