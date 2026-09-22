// Consulta facetada de publicaciones (T-101). Un solo constructor de WHERE
// parametrizado para todo listado, conteo y umbral de indexación: la página,
// el sitemap y el contador del encabezado ven el mismo número.
//
// "Publicación viva" (SEO_ARCHITECTURE.md §2.1, ANALYTICS_AND_KPIS.md §1):
// `status IN ('published','sold')`, `sold_at` dentro de los últimos 90 días
// para las vendidas, `deleted_at IS NULL`.
import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { brands, categories, cities, dealers, listingImages, listings, models } from "@/db/schema";
import { getStorage } from "@/lib/storage";
import {
  DEFAULT_PER_PAGE,
  MAX_PAGES,
  type FacetSlugs,
  type ListingFilters,
  type ListingSort,
} from "./filters";

export const SOLD_LIVE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * - `live`: la definición de publicación viva (published + sold < 90 días).
 *   Es la que cuentan los umbrales y la que muestra un listado por defecto.
 * - `available`: sólo `published` (para bloques tipo "similares" o la home).
 */
export type ListingScope = "live" | "available";

/** Condición SQL de publicación viva. `now` inyectable para pruebas. */
export function liveCondition(now: Date = new Date(), scope: ListingScope = "live"): SQL {
  if (scope === "available") {
    return and(eq(listings.status, "published"), isNull(listings.deletedAt))!;
  }
  const soldSince = new Date(now.getTime() - SOLD_LIVE_DAYS * DAY_MS);
  // `status IN (...)` primero, para que MySQL pueda usar los índices que
  // empiezan por (…, status).
  return and(
    inArray(listings.status, ["published", "sold"]),
    or(eq(listings.status, "published"), gte(listings.soldAt, soldSince)),
    isNull(listings.deletedAt),
  )!;
}

// ---------------------------------------------------------------------------
// Texto libre (F-11)
// ---------------------------------------------------------------------------

/** innodb_ft_min_token_size por defecto: términos más cortos no están en el índice. */
export const FULLTEXT_MIN_TOKEN = 3;

/**
 * Parte el texto libre en términos de letras y dígitos: "CG-150 Titán" →
 * ["cg", "150", "titán"]. Así ningún operador del modo booleano (+ - < > ( ) ~ * " @)
 * llega a MATCH, y un guion no se lee como "excluir". Máximo 8 términos.
 */
export function tokenizeQuery(q: string): string[] {
  return (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Términos de ≥ 3 caracteres → `MATCH(title, description) AGAINST('+t*' IN
 * BOOLEAN MODE)` sobre el índice FULLTEXT. Términos más cortos ("cg", "yb")
 * nunca matchean por FULLTEXT → `LIKE` sobre título, modelo del catálogo y
 * modelo escrito por el vendedor. Todos los términos son obligatorios (AND).
 */
export function freeTextCondition(q: string): SQL | undefined {
  const tokens = tokenizeQuery(q);
  if (tokens.length === 0) return undefined;
  const long = tokens.filter((t) => [...t].length >= FULLTEXT_MIN_TOKEN);
  const short = tokens.filter((t) => [...t].length < FULLTEXT_MIN_TOKEN);
  const parts: SQL[] = [];
  if (long.length > 0) {
    const against = long.map((t) => `+${t}*`).join(" ");
    parts.push(sql`MATCH (${listings.title}, ${listings.description}) AGAINST (${against} IN BOOLEAN MODE)`);
  }
  for (const term of short) {
    const pattern = `%${escapeLike(term)}%`;
    parts.push(
      or(
        sql`${listings.title} LIKE ${pattern}`,
        sql`${models.name} LIKE ${pattern}`,
        sql`${listings.modelRaw} LIKE ${pattern}`,
      )!,
    );
  }
  return and(...parts);
}

function needsModelJoin(filters: ListingFilters): boolean {
  return filters.q !== undefined && tokenizeQuery(filters.q).some((t) => [...t].length < FULLTEXT_MIN_TOKEN);
}

// ---------------------------------------------------------------------------
// WHERE
// ---------------------------------------------------------------------------

/** El WHERE completo de un listado: vivas + cada filtro presente. */
export function listingWhere(filters: ListingFilters, now: Date = new Date(), scope: ListingScope = "live"): SQL {
  const f = filters;
  const conditions: Array<SQL | undefined> = [
    liveCondition(now, scope),
    f.brandId !== undefined ? eq(listings.brandId, f.brandId) : undefined,
    f.modelId !== undefined ? eq(listings.modelId, f.modelId) : undefined,
    f.categoryId !== undefined ? eq(listings.categoryId, f.categoryId) : undefined,
    f.cityId !== undefined ? eq(listings.cityId, f.cityId) : undefined,
    f.dealerId !== undefined ? eq(listings.dealerId, f.dealerId) : undefined,
    f.condition !== undefined ? eq(listings.condition, f.condition) : undefined,
    f.priceMin !== undefined ? gte(listings.priceGs, f.priceMin) : undefined,
    f.priceMax !== undefined ? lte(listings.priceGs, f.priceMax) : undefined,
    f.yearMin !== undefined ? gte(listings.year, f.yearMin) : undefined,
    f.kmMax !== undefined ? lte(listings.mileageKm, f.kmMax) : undefined,
    f.ccMin !== undefined ? gte(listings.engineCc, f.ccMin) : undefined,
    f.ccMax !== undefined ? lte(listings.engineCc, f.ccMax) : undefined,
    f.downPaymentMax !== undefined ? lte(listings.downPaymentGs, f.downPaymentMax) : undefined,
    f.installmentMax !== undefined ? lte(listings.installmentGs, f.installmentMax) : undefined,
    f.withFinancing ? and(isNotNull(listings.installmentGs), isNotNull(listings.installmentCount)) : undefined,
    f.q !== undefined ? freeTextCondition(f.q) : undefined,
  ];
  return and(...conditions.filter((c): c is SQL => c !== undefined))!;
}

/**
 * Orden estable: cada criterio termina en `id` (único), así la paginación no
 * repite ni saltea filas aunque haya empates. Los montos NULL (financiación
 * sola, km no informado) van al final. Sin prioridad pagada: los destacados
 * se etiquetan, no se suben (MONETIZATION.md §4, tope del 20 % pendiente).
 */
export function listingOrderBy(sort: ListingSort): SQL[] {
  switch (sort) {
    case "precio_asc":
      return [sql`${listings.priceGs} IS NULL`, asc(listings.priceGs), desc(listings.id)];
    case "precio_desc":
      return [sql`${listings.priceGs} IS NULL`, desc(listings.priceGs), desc(listings.id)];
    case "km_asc":
      return [sql`${listings.mileageKm} IS NULL`, asc(listings.mileageKm), desc(listings.id)];
    case "anio_desc":
      return [sql`${listings.year} IS NULL`, desc(listings.year), desc(listings.id)];
    case "recientes":
    default:
      return [desc(listings.publishedAt), desc(listings.id)];
  }
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export type ListingCardImage = {
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  isCatalogPhoto: boolean;
};

/** Lo que necesita `ListingCard` y la ficha resumida. Todo de la base, nada calculado a mano. */
export type ListingCardData = {
  id: number;
  slug: string;
  publicRef: string;
  title: string;
  status: "published" | "sold";
  condition: "new" | "used";
  year: number | null;
  mileageKm: number | null;
  engineCc: number | null;
  priceGs: number | null;
  hasFinancingOnly: boolean;
  downPaymentGs: number | null;
  installmentGs: number | null;
  installmentCount: number | null;
  contactWhatsapp: boolean;
  isFeatured: boolean;
  publishedAt: Date | null;
  soldAt: Date | null;
  brand: { name: string; slug: string };
  model: { name: string; slug: string } | null;
  city: { name: string; slug: string };
  dealer: { id: number; name: string; slug: string; isVerified: boolean } | null;
  image: ListingCardImage | null;
};

export type ListingSearchResult = {
  items: ListingCardData[];
  total: number;
  page: number;
  perPage: number;
  /** Páginas con resultados, con tope MAX_PAGES (§3.2). */
  pageCount: number;
};

export type SearchInput = {
  filters: ListingFilters;
  sort?: ListingSort;
  page?: number;
  perPage?: number;
  scope?: ListingScope;
  now?: Date;
};

/** La consulta de conteo, sin ejecutar (la usan `countListings` y el EXPLAIN de tests/perf). */
export function countQuery(filters: ListingFilters, opts: { now?: Date; scope?: ListingScope } = {}) {
  const where = listingWhere(filters, opts.now, opts.scope);
  const base = db.select({ n: count() }).from(listings);
  return needsModelJoin(filters) ? base.leftJoin(models, eq(models.id, listings.modelId)).where(where) : base.where(where);
}

/** Cantidad de publicaciones que cumplen los filtros (vivas por defecto). */
export async function countListings(
  filters: ListingFilters,
  opts: { now?: Date; scope?: ListingScope } = {},
): Promise<number> {
  const [row] = await countQuery(filters, opts);
  return Number(row?.n ?? 0);
}

/** Conteo de publicaciones vivas: el número que decide la indexación (§2.2). */
export function countLiveListings(filters: ListingFilters, now?: Date): Promise<number> {
  return countListings(filters, { now, scope: "live" });
}

/**
 * Ids de una página de resultados, sin ejecutar (también para EXPLAIN).
 * "Deferred join": se ordena y pagina sólo sobre `listings` (filas angostas,
 * índices propios) y recién después se buscan los datos de 24 filas. Con el
 * JOIN completo, MySQL elegía empezar por `cities` y ordenar miles de filas
 * anchas (docs/log/A2.md, EXPLAIN).
 */
export function pageIdsQuery(input: SearchInput & { page: number; perPage: number }) {
  const where = listingWhere(input.filters, input.now, input.scope);
  const base = db.select({ id: listings.id }).from(listings);
  return (needsModelJoin(input.filters) ? base.leftJoin(models, eq(models.id, listings.modelId)).where(where) : base.where(where))
    .orderBy(...listingOrderBy(input.sort ?? "recientes"))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage);
}

/** Datos de tarjeta para ids ya elegidos (el orden lo pone quien llama). */
function cardRowsQuery(ids: number[]) {
  return db
    .select({
      id: listings.id,
      slug: listings.slug,
      publicRef: listings.publicRef,
      title: listings.title,
      status: listings.status,
      condition: listings.condition,
      year: listings.year,
      mileageKm: listings.mileageKm,
      engineCc: listings.engineCc,
      priceGs: listings.priceGs,
      hasFinancingOnly: listings.hasFinancingOnly,
      downPaymentGs: listings.downPaymentGs,
      installmentGs: listings.installmentGs,
      installmentCount: listings.installmentCount,
      contactWhatsapp: listings.contactWhatsapp,
      isFeatured: listings.isFeatured,
      publishedAt: listings.publishedAt,
      soldAt: listings.soldAt,
      brandName: brands.name,
      brandSlug: brands.slug,
      modelName: models.name,
      modelSlug: models.slug,
      cityName: cities.name,
      citySlug: cities.slug,
      dealerId: dealers.id,
      dealerName: dealers.name,
      dealerSlug: dealers.slug,
      dealerVerified: dealers.isVerified,
    })
    .from(listings)
    .innerJoin(brands, eq(brands.id, listings.brandId))
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .leftJoin(models, eq(models.id, listings.modelId))
    .leftJoin(dealers, eq(dealers.id, listings.dealerId))
    .where(inArray(listings.id, ids));
}

/** Una página de resultados + el total real. Página fuera de rango → `items` vacío. */
export async function searchListings(input: SearchInput): Promise<ListingSearchResult> {
  const perPage = input.perPage ?? DEFAULT_PER_PAGE;
  const page = Math.max(1, Math.min(input.page ?? 1, MAX_PAGES));
  const now = input.now ?? new Date();
  const scope = input.scope ?? "live";
  const total = await countListings(input.filters, { now, scope });
  const pageCount = Math.min(Math.ceil(total / perPage), MAX_PAGES);
  if (total === 0 || page > pageCount) {
    return { items: [], total, page, perPage, pageCount };
  }

  const ids = (await pageIdsQuery({ ...input, page, perPage, now, scope })).map((r) => r.id);
  if (ids.length === 0) return { items: [], total, page, perPage, pageCount };
  const byId = new Map((await cardRowsQuery(ids)).map((r) => [r.id, r]));
  const rows = ids.map((id) => byId.get(id)).filter((r) => r !== undefined);

  const images = await firstImages(rows.map((r) => r.id));
  const items: ListingCardData[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    publicRef: r.publicRef,
    title: r.title,
    status: r.status as "published" | "sold",
    condition: r.condition,
    year: r.year,
    mileageKm: r.mileageKm,
    engineCc: r.engineCc,
    priceGs: r.priceGs,
    hasFinancingOnly: r.hasFinancingOnly,
    downPaymentGs: r.downPaymentGs,
    installmentGs: r.installmentGs,
    installmentCount: r.installmentCount,
    contactWhatsapp: r.contactWhatsapp,
    isFeatured: r.isFeatured,
    publishedAt: r.publishedAt,
    soldAt: r.soldAt,
    brand: { name: r.brandName, slug: r.brandSlug },
    model: r.modelName && r.modelSlug ? { name: r.modelName, slug: r.modelSlug } : null,
    city: { name: r.cityName, slug: r.citySlug },
    dealer:
      r.dealerId !== null && r.dealerName !== null && r.dealerSlug !== null
        ? { id: r.dealerId, name: r.dealerName, slug: r.dealerSlug, isVerified: r.dealerVerified === true }
        : null,
    image: images.get(r.id) ?? null,
  }));

  return { items, total, page, perPage, pageCount };
}

/** Primera foto (menor `sort_order`) de cada publicación, en una consulta. */
async function firstImages(listingIds: number[]): Promise<Map<number, ListingCardImage>> {
  const result = new Map<number, ListingCardImage>();
  if (listingIds.length === 0) return result;
  const rows = await db
    .select({
      listingId: listingImages.listingId,
      storagePath: listingImages.storagePath,
      width: listingImages.width,
      height: listingImages.height,
      altText: listingImages.altText,
      isCatalogPhoto: listingImages.isCatalogPhoto,
    })
    .from(listingImages)
    .where(inArray(listingImages.listingId, listingIds))
    .orderBy(asc(listingImages.listingId), asc(listingImages.sortOrder), asc(listingImages.id));
  const storage = getStorage();
  for (const row of rows) {
    if (result.has(row.listingId)) continue;
    result.set(row.listingId, {
      url: storage.url(row.storagePath),
      width: row.width,
      height: row.height,
      alt: row.altText,
      isCatalogPhoto: row.isCatalogPhoto,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Conteos agrupados (umbral por página, sitemaps, "ciudades con inventario")
// ---------------------------------------------------------------------------

export type CountDimension = "brand" | "model" | "category" | "city" | "condition";

const DIMENSION_COLUMN = {
  brand: listings.brandId,
  model: listings.modelId,
  category: listings.categoryId,
  city: listings.cityId,
  condition: listings.condition,
} as const;

export type GroupedCount = { key: Partial<Record<CountDimension, number | string | null>>; count: number };

/**
 * Publicaciones vivas agrupadas por una o dos dimensiones, en una consulta.
 * Ej.: `groupLiveCounts(["brand", "city"])` → conteo por marca × ciudad, para
 * decidir qué cruces pasan el umbral sin una consulta por página.
 */
/** La consulta agrupada, sin ejecutar (también para EXPLAIN). */
export function groupCountQuery(dimensions: readonly CountDimension[], filters: ListingFilters = {}, now?: Date) {
  if (dimensions.length === 0 || dimensions.length > 2) {
    throw new Error("groupLiveCounts: una o dos dimensiones");
  }
  const selection = Object.fromEntries(dimensions.map((d) => [d, DIMENSION_COLUMN[d]]));
  const base = db.select({ ...selection, n: count() }).from(listings);
  const where = listingWhere(filters, now, "live");
  return (needsModelJoin(filters) ? base.leftJoin(models, eq(models.id, listings.modelId)).where(where) : base.where(where)).groupBy(
    ...dimensions.map((d) => DIMENSION_COLUMN[d]),
  );
}

export async function groupLiveCounts(
  dimensions: readonly CountDimension[],
  filters: ListingFilters = {},
  now?: Date,
): Promise<GroupedCount[]> {
  const rows = await groupCountQuery(dimensions, filters, now);
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      key: Object.fromEntries(dimensions.map((d) => [d, (r[d] ?? null) as number | string | null])),
      count: Number(r.n),
    };
  });
}

// ---------------------------------------------------------------------------
// Slugs → entidades del catálogo
// ---------------------------------------------------------------------------

export type ResolvedFacets = {
  brand?: { id: number; name: string; slug: string; introHtml: string | null };
  model?: { id: number; name: string; slug: string; introHtml: string | null; brandId: number };
  category?: { id: number; name: string; slug: string; introHtml: string | null };
  city?: { id: number; name: string; slug: string; introHtml: string | null; department: string };
};

/**
 * Resuelve slugs de ruta o de query string a filas activas del catálogo.
 * `null` si algún slug pedido no existe o está inactivo (→ 404 en una ruta;
 * en `/motos?marca=x` quien llama decide ignorarlo). Un modelo sólo existe
 * dentro de su marca.
 */
export async function resolveFacetSlugs(facets: FacetSlugs): Promise<ResolvedFacets | null> {
  if (facets.model && !facets.brand) return null;
  const [brand, category, city] = await Promise.all([
    facets.brand
      ? db
          .select({ id: brands.id, name: brands.name, slug: brands.slug, introHtml: brands.introHtml })
          .from(brands)
          .where(and(eq(brands.slug, facets.brand), eq(brands.isActive, true)))
          .limit(1)
          .then((r) => r[0] ?? null)
      : undefined,
    facets.category
      ? db
          .select({ id: categories.id, name: categories.name, slug: categories.slug, introHtml: categories.introHtml })
          .from(categories)
          .where(and(eq(categories.slug, facets.category), eq(categories.isActive, true)))
          .limit(1)
          .then((r) => r[0] ?? null)
      : undefined,
    facets.city
      ? db
          .select({
            id: cities.id,
            name: cities.name,
            slug: cities.slug,
            introHtml: cities.introHtml,
            department: cities.department,
          })
          .from(cities)
          .where(and(eq(cities.slug, facets.city), eq(cities.isActive, true)))
          .limit(1)
          .then((r) => r[0] ?? null)
      : undefined,
  ]);
  if (brand === null || category === null || city === null) return null;

  const resolved: ResolvedFacets = {};
  if (brand) resolved.brand = brand;
  if (category) resolved.category = category;
  if (city) resolved.city = city;

  if (facets.model && brand) {
    const [model] = await db
      .select({
        id: models.id,
        name: models.name,
        slug: models.slug,
        introHtml: models.introHtml,
        brandId: models.brandId,
      })
      .from(models)
      .where(and(eq(models.brandId, brand.id), eq(models.slug, facets.model), eq(models.isActive, true)))
      .limit(1);
    if (!model) return null;
    resolved.model = model;
  }
  return resolved;
}

/** Facetas resueltas → filtros por id. */
export function facetsToFilters(resolved: ResolvedFacets): ListingFilters {
  const filters: ListingFilters = {};
  if (resolved.brand) filters.brandId = resolved.brand.id;
  if (resolved.model) filters.modelId = resolved.model.id;
  if (resolved.category) filters.categoryId = resolved.category.id;
  if (resolved.city) filters.cityId = resolved.city.id;
  return filters;
}
