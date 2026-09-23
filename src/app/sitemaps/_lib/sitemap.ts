// Sitemaps (T-112, SEO_ARCHITECTURE.md §7). Una URL entra sólo si la página
// que la sirve la declararía indexable: se usan las MISMAS funciones de A2
// (`isIndexable`, `isListingIndexable`, `isDealerPageIndexable`,
// `isContentPageIndexable`, `isMotosIndexIndexable`) con el mismo modo global
// (ADR-26). Con `SITE_NOINDEX=true` no hay hijos; con `content`, sólo
// `content.xml`. `lastmod` sale de `updated_at` reales o se omite; nunca "hoy".
import "server-only";

import { and, asc, count, desc, eq, gt, inArray, isNull, max } from "drizzle-orm";
import { publishedGuides } from "@/app/(public)/guias/data";
import { db } from "@/db";
import { brands, categories, cities, dealers, listings, models } from "@/db/schema";
import { globalIndexingAllows, siteIndexingMode, type SiteIndexingMode } from "@/lib/env";
import { liveCondition, listingWhere } from "@/lib/listings/query";
import { editorialKeys, editorialText } from "@/lib/seo/editorial";
import {
  countWords,
  isContentPageIndexable,
  isDealerPageIndexable,
  isIndexable,
  isListingIndexable,
  isMotosIndexIndexable,
} from "@/lib/seo/indexability";
import { absoluteUrl, paths } from "@/lib/seo/routes";

export const URLS_PER_SITEMAP = 5_000;

export type SitemapEntry = { loc: string; lastmod?: Date | null };

export const HUB_SEGMENTS = ["pages", "brands", "models", "categories", "cities", "dealers"] as const;
export type Segment = (typeof HUB_SEGMENTS)[number] | "content" | `listings-${number}`;

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** `YYYY-MM-DDTHH:MM:SSZ` (W3C datetime). */
function w3c(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function urlsetXml(entries: SitemapEntry[]): string {
  const rows = entries.map((e) => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${w3c(e.lastmod)}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}${rows.length ? "\n" : ""}</urlset>\n`;
}

export function sitemapIndexXml(children: SitemapEntry[]): string {
  const rows = children.map((e) => `  <sitemap><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${w3c(e.lastmod)}</lastmod>` : ""}</sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}${rows.length ? "\n" : ""}</sitemapindex>\n`;
}

function latest(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  return valid.length ? new Date(Math.max(...valid.map((d) => d.getTime()))) : null;
}

// ---------------------------------------------------------------------------
// Segmentos (rutas relativas; el llamador las vuelve absolutas)
// ---------------------------------------------------------------------------

type Rel = { path: string; lastmod?: Date | null };

/** Fichas vivas indexables (published + sold < 90 días), por orden de id. */
async function listingEntries(page: number, now: Date, mode: SiteIndexingMode): Promise<Rel[]> {
  const rows = await db
    .select({ slug: listings.slug, publicRef: listings.publicRef, status: listings.status, soldAt: listings.soldAt, updatedAt: listings.updatedAt })
    .from(listings)
    .where(liveCondition(now, "live"))
    .orderBy(asc(listings.id))
    .limit(URLS_PER_SITEMAP)
    .offset((page - 1) * URLS_PER_SITEMAP);
  return rows
    .filter((r) => isListingIndexable({ status: r.status, soldAt: r.soldAt }, now, mode))
    .map((r) => ({ path: paths.listing(r), lastmod: r.updatedAt }));
}

async function listingPageCount(now: Date): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(listings).where(liveCondition(now, "live"));
  return Math.ceil(Number(n) / URLS_PER_SITEMAP);
}

type Group = { id: number | null; n: number; last: Date | null };

async function groupBy(column: typeof listings.brandId | typeof listings.modelId | typeof listings.categoryId | typeof listings.cityId | typeof listings.dealerId, now: Date): Promise<Map<number, Group>> {
  const rows = await db
    .select({ id: column, n: count(), last: max(listings.updatedAt) })
    .from(listings)
    .where(liveCondition(now, "live"))
    .groupBy(column);
  return new Map(rows.filter((r) => r.id !== null).map((r) => [r.id as number, { id: r.id as number, n: Number(r.n), last: r.last }]));
}

async function brandEntries(now: Date, mode: SiteIndexingMode): Promise<Rel[]> {
  const counts = await groupBy(listings.brandId, now);
  const rows = await db.select({ id: brands.id, slug: brands.slug, introHtml: brands.introHtml, updatedAt: brands.updatedAt }).from(brands).where(eq(brands.isActive, true));
  return rows
    .filter((b) => isIndexable("brand", counts.get(b.id)?.n ?? 0, countWords(b.introHtml), mode))
    .map((b) => ({ path: paths.brand(b.slug), lastmod: latest(b.updatedAt, counts.get(b.id)?.last) }));
}

async function modelEntries(now: Date, mode: SiteIndexingMode): Promise<Rel[]> {
  const counts = await groupBy(listings.modelId, now);
  const ids = [...counts.keys()];
  if (!ids.length) return [];
  const rows = await db
    .select({ id: models.id, slug: models.slug, introHtml: models.introHtml, updatedAt: models.updatedAt, brandSlug: brands.slug })
    .from(models)
    .innerJoin(brands, eq(brands.id, models.brandId))
    .where(and(inArray(models.id, ids), eq(models.isActive, true), eq(brands.isActive, true)));
  return rows
    .filter((m) => isIndexable("model", counts.get(m.id)?.n ?? 0, countWords(m.introHtml), mode))
    .map((m) => ({ path: paths.model(m.brandSlug, m.slug), lastmod: latest(m.updatedAt, counts.get(m.id)?.last) }));
}

async function categoryEntries(now: Date, mode: SiteIndexingMode): Promise<Rel[]> {
  const counts = await groupBy(listings.categoryId, now);
  const rows = await db.select({ id: categories.id, slug: categories.slug, introHtml: categories.introHtml, updatedAt: categories.updatedAt }).from(categories).where(eq(categories.isActive, true));
  return rows
    .filter((c) => isIndexable("category", counts.get(c.id)?.n ?? 0, countWords(c.introHtml), mode))
    .map((c) => ({ path: paths.category(c.slug), lastmod: latest(c.updatedAt, counts.get(c.id)?.last) }));
}

async function cityEntries(now: Date, mode: SiteIndexingMode): Promise<Rel[]> {
  const counts = await groupBy(listings.cityId, now);
  const rows = await db.select({ id: cities.id, slug: cities.slug, introHtml: cities.introHtml, updatedAt: cities.updatedAt }).from(cities).where(eq(cities.isActive, true));
  return rows
    .filter((c) => isIndexable("city", counts.get(c.id)?.n ?? 0, countWords(c.introHtml), mode))
    .map((c) => ({ path: paths.city(c.slug), lastmod: latest(c.updatedAt, counts.get(c.id)?.last) }));
}

async function dealerEntries(now: Date, mode: SiteIndexingMode): Promise<Rel[]> {
  const counts = await groupBy(listings.dealerId, now);
  const ids = [...counts.keys()];
  if (!ids.length) return [];
  const rows = await db
    .select({ id: dealers.id, slug: dealers.slug, status: dealers.status, updatedAt: dealers.updatedAt })
    .from(dealers)
    .where(and(inArray(dealers.id, ids), isNull(dealers.deletedAt)));
  return rows
    .filter((d) => isDealerPageIndexable(d.status, counts.get(d.id)?.n ?? 0, mode))
    .map((d) => ({ path: paths.dealer(d.slug), lastmod: latest(d.updatedAt, counts.get(d.id)?.last) }));
}

/** `/motos`, `/motos/en-cuotas`, nuevas/usadas y los cruces (texto editorial en `content/seo/`). */
async function pageEntries(now: Date, mode: SiteIndexingMode): Promise<Rel[]> {
  const agg = (where: ReturnType<typeof listingWhere>) =>
    db
      .select({ n: count(), last: max(listings.updatedAt) })
      .from(listings)
      .where(where)
      .then((r) => ({ n: Number(r[0]?.n ?? 0), last: r[0]?.last ?? null }));
  const [all, financed, used, fresh] = await Promise.all([
    agg(listingWhere({}, now)),
    agg(listingWhere({ withFinancing: true }, now)),
    agg(listingWhere({ condition: "used" }, now)),
    agg(listingWhere({ condition: "new" }, now)),
  ]);
  const out: Rel[] = [];
  if (isMotosIndexIndexable(all.n, mode)) out.push({ path: paths.motos, lastmod: all.last });
  if (isIndexable("en_cuotas", financed.n, editorialText(editorialKeys.enCuotas)?.words ?? 0, mode)) {
    out.push({ path: paths.enCuotas, lastmod: financed.last });
  }
  for (const [condition, c] of [["new", fresh], ["used", used]] as const) {
    if (isIndexable("condition", c.n, editorialText(editorialKeys.condition(condition))?.words ?? 0, mode)) {
      out.push({ path: paths.condition(condition), lastmod: c.last });
    }
  }
  if (!globalIndexingAllows("inventory", mode)) return out;

  // Cruces: sólo los que tienen texto revisado pueden pasar el umbral; se miran los pares con inventario.
  const crosses = async (
    dim: typeof listings.brandId | typeof listings.categoryId,
    table: typeof brands | typeof categories,
    type: "brand_city" | "category_city",
  ) => {
    const rows = await db
      .select({ slug: table.slug, citySlug: cities.slug, n: count(), last: max(listings.updatedAt) })
      .from(listings)
      .innerJoin(table, eq(table.id, dim))
      .innerJoin(cities, eq(cities.id, listings.cityId))
      .where(and(liveCondition(now, "live"), eq(table.isActive, true), eq(cities.isActive, true)))
      .groupBy(table.slug, cities.slug)
      .having(gt(count(), 0))
      .orderBy(desc(count()));
    for (const r of rows) {
      const key = type === "brand_city" ? editorialKeys.brandCity(r.slug, r.citySlug) : editorialKeys.categoryCity(r.slug, r.citySlug);
      if (!isIndexable(type, Number(r.n), editorialText(key)?.words ?? 0, mode)) continue;
      out.push({ path: type === "brand_city" ? paths.brandCity(r.slug, r.citySlug) : paths.categoryCity(r.slug, r.citySlug), lastmod: r.last });
    }
  };
  await crosses(listings.brandId, brands, "brand_city");
  await crosses(listings.categoryId, categories, "category_city");
  return out;
}

/** Guías publicadas y páginas de contenido indexables (ADR-26: `content` y `false`). Sin fecha real → sin `lastmod`. */
async function contentEntries(mode: SiteIndexingMode): Promise<Rel[]> {
  if (!isContentPageIndexable(mode)) return [];
  const guides = await publishedGuides();
  const lastGuide = latest(...guides.map((g) => g.updatedAt));
  // /terminos y /privacidad quedan fuera: `noindex` fijo hasta que tengan texto profesional.
  const statics: Rel[] = [
    { path: paths.home },
    { path: paths.financing },
    { path: paths.insurance },
    { path: paths.dealers },
    { path: paths.publish },
    { path: paths.howItWorks },
    { path: paths.contact },
  ];
  return [
    ...statics,
    ...(guides.length ? [{ path: paths.guides, lastmod: lastGuide }] : []),
    ...guides.map((g) => ({ path: paths.guide(g.slug), lastmod: g.updatedAt })),
  ];
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Nombre de archivo → segmento, o `null` (404). */
export function parseSegment(file: string): Segment | null {
  const m = /^([a-z]+)(?:-([1-9]\d{0,4}))?\.xml$/.exec(file);
  if (!m) return null;
  if (m[1] === "listings") return m[2] ? (`listings-${Number(m[2])}` as Segment) : null;
  if (m[2]) return null;
  return m[1] === "content" || (HUB_SEGMENTS as readonly string[]).includes(m[1]) ? (m[1] as Segment) : null;
}

/** Entradas absolutas de un segmento en el modo dado. Vacío = el segmento no se publica. */
export async function segmentEntries(segment: Segment, siteUrl: string, now = new Date(), mode = siteIndexingMode()): Promise<SitemapEntry[]> {
  let rel: Rel[];
  if (segment === "content") rel = await contentEntries(mode);
  else if (!globalIndexingAllows("inventory", mode)) rel = [];
  else if (segment.startsWith("listings-")) rel = await listingEntries(Number(segment.slice(9)), now, mode);
  else if (segment === "pages") rel = await pageEntries(now, mode);
  else if (segment === "brands") rel = await brandEntries(now, mode);
  else if (segment === "models") rel = await modelEntries(now, mode);
  else if (segment === "categories") rel = await categoryEntries(now, mode);
  else if (segment === "cities") rel = await cityEntries(now, mode);
  else rel = await dealerEntries(now, mode);
  return rel.slice(0, URLS_PER_SITEMAP).map((r) => ({ loc: absoluteUrl(r.path, siteUrl), lastmod: r.lastmod ?? null }));
}

/** Hijos del índice: sólo los segmentos con al menos una URL. */
export async function indexChildren(siteUrl: string, now = new Date(), mode = siteIndexingMode()): Promise<SitemapEntry[]> {
  const names: Segment[] = ["content"];
  if (globalIndexingAllows("inventory", mode)) {
    const pages = await listingPageCount(now);
    for (let i = 1; i <= pages; i += 1) names.push(`listings-${i}`);
    names.push(...HUB_SEGMENTS);
  }
  const out: SitemapEntry[] = [];
  for (const name of names) {
    const entries = await segmentEntries(name, siteUrl, now, mode);
    if (!entries.length) continue;
    out.push({ loc: absoluteUrl(`/sitemaps/${name}.xml`, siteUrl), lastmod: latest(...entries.map((e) => e.lastmod)) });
  }
  return out;
}

