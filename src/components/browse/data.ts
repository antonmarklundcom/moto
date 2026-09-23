// Datos de las páginas de listado (T-103, T-106): una sola función para
// `/motos` y las programáticas de B1. Usa sólo el contrato de A2: consulta
// facetada, umbral de indexación, canonical/robots y rutas. Todo conteo y
// rango de precios sale de la base.
import "server-only";

import { and, asc, count, eq, isNotNull, max, min } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { brands, categories, cities, listings, models } from "@/db/schema";
import { formatGuaranies, groupThousands } from "@/lib/format";
import {
  FILTER_PARAMS,
  PAGE_PARAM,
  type FacetSlugs,
  type ListingCondition,
  type ListingFilters,
  parseSearchParams,
  type ParsedSearchParams,
  type SearchParamsInput,
} from "@/lib/listings/filters";
import {
  countLiveListings,
  facetsToFilters,
  groupLiveCounts,
  type ListingSearchResult,
  listingWhere,
  type ResolvedFacets,
  resolveFacetSlugs,
  searchListings,
} from "@/lib/listings/query";
import { countWords, isIndexable, isMotosIndexIndexable, type ProgrammaticPageType } from "@/lib/seo/indexability";
import { type ListingPageSeo, resolveListingPageSeo } from "@/lib/seo/meta";
import { facetRoute, listingPageHref, type MotosRoute, motosRoutePath, paths, withQuery } from "@/lib/seo/routes";
import { toQueryEntries } from "@/lib/listings/filters";
import { type BrowseCopy, browseCopy, type BrowseKind, type BrowseNames } from "./copy";

export type BrowseRoute =
  | { kind: "motos" }
  | { kind: "brand"; brand: string }
  | { kind: "category"; category: string }
  | { kind: "city"; city: string }
  | { kind: "brand_city"; brand: string; city: string }
  | { kind: "category_city"; category: string; city: string }
  | { kind: "condition"; condition: ListingCondition };

export type Option = { value: string; label: string };
export type LinkItem = { name: string; href: string; count: number };
export type Removal = { label: string; href: string };
export type PriceRange = { min: string; max: string; n: number };
export type Related = { title: string; items: LinkItem[] };

export type BrowseData =
  | { status: "not_found" }
  | { status: "redirect"; location: string }
  | {
      status: "ok";
      kind: BrowseKind;
      basePath: string;
      names: BrowseNames;
      copy: BrowseCopy;
      parsed: ParsedSearchParams;
      search: ListingSearchResult;
      seo: Extract<ListingPageSeo, { status: "ok" }>;
      liveCount: number;
      indexable: boolean;
      introHtml: string | null;
      priceRange: PriceRange | null;
      /** Facetas efectivas (ruta + query), para prellenar el formulario. */
      facets: FacetSlugs & { condition?: ListingCondition };
      /** Facetas que fija la ruta (no se cambian desde el formulario de esta página). */
      fixed: { brand: boolean; category: boolean; city: boolean; condition: boolean };
      options: { brands: Option[]; models: Option[]; categories: Option[]; cities: Option[] };
      removals: Removal[];
      related: Related | null;
      alternatives: LinkItem[];
    };

/** Precio mínimo y máximo sólo con al menos 5 motos con precio (B1 §4: nada de rangos con 1 o 2 datos). */
export const MIN_PRICE_RANGE_N = 5;

function routeFacets(route: BrowseRoute): FacetSlugs {
  switch (route.kind) {
    case "brand":
      return { brand: route.brand };
    case "category":
      return { category: route.category };
    case "city":
      return { city: route.city };
    case "brand_city":
      return { brand: route.brand, city: route.city };
    case "category_city":
      return { category: route.category, city: route.city };
    default:
      return {};
  }
}

function routePath(route: BrowseRoute): string {
  return motosRoutePath(route as MotosRoute);
}

/** Resuelve las facetas del query string una por una: una inválida se ignora (no tumba la página). */
async function resolveQueryFacets(facets: FacetSlugs, taken: FacetSlugs): Promise<ResolvedFacets> {
  const out: ResolvedFacets = {};
  const one = async (f: FacetSlugs) => (await resolveFacetSlugs(f)) ?? {};
  if (facets.brand && !taken.brand) {
    const r = await one(facets.model ? { brand: facets.brand, model: facets.model } : { brand: facets.brand });
    if (r.brand) out.brand = r.brand;
    if (r.model) out.model = r.model;
    if (!r.brand && facets.model) {
      const b = await one({ brand: facets.brand });
      if (b.brand) out.brand = b.brand;
    }
  } else if (facets.model && taken.brand) {
    const r = await one({ brand: taken.brand, model: facets.model });
    if (r.model) out.model = r.model;
  }
  if (facets.category && !taken.category) out.category = (await one({ category: facets.category })).category;
  if (facets.city && !taken.city) out.city = (await one({ city: facets.city })).city;
  for (const key of Object.keys(out) as Array<keyof ResolvedFacets>) if (!out[key]) delete out[key];
  return out;
}

async function priceRange(filters: ListingFilters): Promise<PriceRange | null> {
  const [row] = await db
    .select({ lo: min(listings.priceGs), hi: max(listings.priceGs), n: count() })
    .from(listings)
    .where(and(listingWhere(filters, new Date(), "available"), isNotNull(listings.priceGs)));
  const n = Number(row?.n ?? 0);
  if (n < MIN_PRICE_RANGE_N || row?.lo === null || row?.hi === null) return null;
  return { min: formatGuaranies(Number(row.lo))!, max: formatGuaranies(Number(row.hi))!, n };
}

async function catalogOptions(brandId: number | undefined) {
  const [b, c, ci, m] = await Promise.all([
    db.select({ value: brands.slug, label: brands.name }).from(brands).where(eq(brands.isActive, true)).orderBy(asc(brands.sortOrder), asc(brands.name)),
    db
      .select({ value: categories.slug, label: categories.name })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ value: cities.slug, label: cities.name }).from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder), asc(cities.name)),
    brandId
      ? db
          .select({ value: models.slug, label: models.name })
          .from(models)
          .where(and(eq(models.brandId, brandId), eq(models.isActive, true)))
          .orderBy(asc(models.name))
      : Promise.resolve([] as Option[]),
  ]);
  return { brands: b, categories: c, cities: ci, models: m };
}

const CONDITION_TEXT: Record<ListingCondition, string> = { new: "0 km", used: "Usadas" };

/** Un chip por filtro aplicado del query string, con la URL que lo quita (PRODUCT_SPEC §4). */
function removalsFor(basePath: string, parsed: ParsedSearchParams, names: Record<string, string>): Removal[] {
  const out: Removal[] = [];
  const without = (patch: (p: ParsedSearchParams) => void, label: string) => {
    const copy: ParsedSearchParams = { ...parsed, filters: { ...parsed.filters }, facets: { ...parsed.facets } };
    patch(copy);
    out.push({ label, href: listingPageHref(basePath, copy) });
  };
  const f = parsed.filters;
  const gs = (n: number) => formatGuaranies(n)!;
  if (parsed.facets.brand && names.brand) without((p) => (delete p.facets.brand, delete p.facets.model), `Marca: ${names.brand}`);
  if (parsed.facets.model && names.model) without((p) => delete p.facets.model, `Modelo: ${names.model}`);
  if (parsed.facets.category && names.category) without((p) => delete p.facets.category, `Tipo: ${names.category}`);
  if (parsed.facets.city && names.city) without((p) => delete p.facets.city, `Ciudad: ${names.city}`);
  if (f.condition) without((p) => delete p.filters.condition, CONDITION_TEXT[f.condition]);
  if (f.priceMin !== undefined) without((p) => delete p.filters.priceMin, `Desde ${gs(f.priceMin)}`);
  if (f.priceMax !== undefined) without((p) => delete p.filters.priceMax, `Hasta ${gs(f.priceMax)}`);
  if (f.downPaymentMax !== undefined) without((p) => delete p.filters.downPaymentMax, `Entrega hasta ${gs(f.downPaymentMax)}`);
  if (f.installmentMax !== undefined) without((p) => delete p.filters.installmentMax, `Cuota hasta ${gs(f.installmentMax)}`);
  if (f.yearMin !== undefined) without((p) => delete p.filters.yearMin, `Año ${f.yearMin} o más nuevo`);
  if (f.kmMax !== undefined) without((p) => delete p.filters.kmMax, `Hasta ${groupThousands(f.kmMax)} km`);
  if (f.ccMin !== undefined || f.ccMax !== undefined) {
    const cc = f.ccMin === f.ccMax ? `${f.ccMin} cc` : `${f.ccMin ?? ""}–${f.ccMax ?? ""} cc`;
    without((p) => (delete p.filters.ccMin, delete p.filters.ccMax), `Cilindrada ${cc}`);
  }
  if (f.q) without((p) => delete p.filters.q, `Texto: «${f.q}»`);
  if (parsed.sort !== "recientes") without((p) => (p.sort = "recientes"), "Orden elegido");
  return out;
}

/**
 * Enlaces a páginas hijas que pasan el umbral completo (§2.1: vivas y
 * palabras), sin mirar SITE_NOINDEX: §8 prohíbe enlazar en masa páginas
 * noindex por umbral, no las que sólo espera el interruptor global.
 */
async function relatedFor(kind: BrowseKind, resolved: ResolvedFacets): Promise<Related | null> {
  const passes = (type: ProgrammaticPageType, n: number, words: number) => isIndexable(type, n, words, "rules");
  if (kind === "brand" && resolved.brand) {
    const brand = resolved.brand;
    const counts = await groupLiveCounts(["model"], { brandId: brand.id });
    const modelRows = await db
      .select({ id: models.id, name: models.name, slug: models.slug, introHtml: models.introHtml })
      .from(models)
      .where(and(eq(models.brandId, brand.id), eq(models.isActive, true)));
    const items = modelRows
      .map((m) => ({ m, n: counts.find((c) => c.key.model === m.id)?.count ?? 0 }))
      .filter(({ m, n }) => passes("model", n, countWords(m.introHtml)))
      .sort((a, b) => b.n - a.n)
      .map(({ m, n }) => ({ name: `${brand.name} ${m.name}`, href: paths.model(brand.slug, m.slug), count: n }));
    return items.length ? { title: `Modelos ${brand.name}`, items } : null;
  }
  return null;
}

/**
 * Alternativas reales para el estado vacío o con poco inventario
 * (PRODUCT_SPEC §4): las páginas "padre" con su conteo y, en ciudades, otras
 * ciudades del mismo departamento con motos. Nunca motos de otra ciudad
 * presentadas como locales: son enlaces con su propio nombre y conteo.
 */
async function alternativesFor(kind: BrowseKind, resolved: ResolvedFacets): Promise<LinkItem[]> {
  const out: LinkItem[] = [];
  const add = async (name: string, href: string, filters: ListingFilters) => {
    const n = await countLiveListings(filters);
    if (n > 0) out.push({ name, href, count: n });
  };
  if ((kind === "brand_city" || kind === "category_city") && resolved.city) {
    if (resolved.brand) await add(`Motos ${resolved.brand.name} en todo el país`, paths.brand(resolved.brand.slug), { brandId: resolved.brand.id });
    if (resolved.category) {
      await add(`Motos ${resolved.category.name} en todo el país`, paths.category(resolved.category.slug), { categoryId: resolved.category.id });
    }
    await add(`Todas las motos en ${resolved.city.name}`, paths.city(resolved.city.slug), { cityId: resolved.city.id });
  }
  if (kind === "city" && resolved.city) {
    const city = resolved.city;
    const siblings = await db
      .select({ id: cities.id, name: cities.name, slug: cities.slug })
      .from(cities)
      .where(and(eq(cities.department, city.department), eq(cities.isActive, true)));
    const counts = await groupLiveCounts(["city"]);
    for (const s of siblings) {
      if (s.id === city.id) continue;
      const n = counts.find((c) => c.key.city === s.id)?.count ?? 0;
      if (n > 0) out.push({ name: `Motos en ${s.name}`, href: paths.city(s.slug), count: n });
    }
    out.sort((a, b) => b.count - a.count);
  }
  if (kind !== "motos") {
    const n = await countLiveListings({});
    if (n > 0) out.push({ name: "Todas las motos de Paraguay", href: paths.motos, count: n });
  }
  return out.slice(0, 6);
}

const INDEX_TYPE: Record<Exclude<BrowseKind, "motos">, ProgrammaticPageType> = {
  brand: "brand",
  category: "category",
  city: "city",
  brand_city: "brand_city",
  category_city: "category_city",
  condition: "condition",
};

/**
 * `/motos` recibe el formulario de filtros (GET, sin JS). Si el pedido se
 * puede expresar con una ruta propia (`?marca=honda&ciudad=luque` →
 * `/motos/honda/ciudad/luque`) o trae valores vacíos o inválidos, redirige a
 * la URL limpia equivalente. Marca × modelo queda como filtro hasta que exista
 * la página de modelo (B2).
 */
function canonicalMotosRedirect(
  parsed: ParsedSearchParams,
  resolved: ResolvedFacets,
  raw: SearchParamsInput,
): string | null {
  const facets = {
    brand: resolved.brand?.slug,
    category: resolved.category?.slug,
    city: resolved.city?.slug,
    condition: parsed.filters.condition,
  };
  const target = resolved.model ? null : facetRoute(facets);
  let path: string = paths.motos;
  const next: ParsedSearchParams = { ...parsed, filters: { ...parsed.filters }, facets: {} };
  if (resolved.brand) next.facets.brand = resolved.brand.slug;
  if (resolved.model) next.facets.model = resolved.model.slug;
  if (resolved.category) next.facets.category = resolved.category.slug;
  if (resolved.city) next.facets.city = resolved.city.slug;
  if (target && target.kind !== "motos") {
    path = motosRoutePath(target);
    next.facets = {};
    if (target.kind === "condition") delete next.filters.condition;
  }
  // Sólo se comparan los parámetros propios (filtros y página). Los ajenos
  // (utm_*, gclid, fbclid…) se conservan tal cual: la atribución de campañas
  // (A4, vc_attr) los lee de la URL de llegada.
  const rawEntries: Array<[string, string]> =
    raw instanceof URLSearchParams
      ? [...raw.entries()]
      : Object.entries(raw).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string])));
  const own = new Set<string>([...FILTER_PARAMS, PAGE_PARAM]);
  const foreign = rawEntries.filter(([k]) => !own.has(k));
  const location = withQuery(path, [...toQueryEntries({ ...next, page: parsed.page }), ...foreign]);
  const current = withQuery(paths.motos, [...rawEntries.filter(([k]) => own.has(k)), ...foreign]);
  return location === current ? null : location;
}

async function load(route: BrowseRoute, raw: SearchParamsInput): Promise<BrowseData> {
  const parsed = parseSearchParams(raw);
  if (parsed.page === null) return { status: "not_found" };

  const fromRoute = routeFacets(route);
  const resolvedRoute = await resolveFacetSlugs(fromRoute);
  if (!resolvedRoute) return { status: "not_found" };
  const fromQuery = await resolveQueryFacets(parsed.facets, fromRoute);

  if (route.kind === "motos") {
    const location = canonicalMotosRedirect(parsed, fromQuery, raw);
    if (location) return { status: "redirect", location };
  }

  const resolved: ResolvedFacets = { ...fromQuery, ...resolvedRoute };
  const routeCondition = route.kind === "condition" ? route.condition : undefined;
  const baseFilters: ListingFilters = { ...facetsToFilters(resolvedRoute), ...(routeCondition && { condition: routeCondition }) };
  const filters: ListingFilters = { ...facetsToFilters(resolved), ...parsed.filters, ...(routeCondition && { condition: routeCondition }) };

  const basePath = routePath(route);
  const kind: BrowseKind = route.kind;
  const introHtml =
    kind === "brand" ? resolved.brand?.introHtml ?? null : kind === "category" ? resolved.category?.introHtml ?? null : kind === "city" ? resolved.city?.introHtml ?? null : null;

  const [liveCount, search] = await Promise.all([
    countLiveListings(baseFilters),
    searchListings({ filters, sort: parsed.sort, page: parsed.page }),
  ]);
  const indexable = kind === "motos" ? isMotosIndexIndexable(liveCount) : isIndexable(INDEX_TYPE[kind], liveCount, countWords(introHtml));
  const seo = resolveListingPageSeo({ basePath, parsed, baseIndexable: indexable, pageCount: search.pageCount });
  if (seo.status === "not_found") return { status: "not_found" };

  const names: BrowseNames = {
    ...(resolvedRoute.brand && { brand: resolvedRoute.brand }),
    ...(resolvedRoute.category && { category: resolvedRoute.category }),
    ...(resolvedRoute.city && { city: resolvedRoute.city }),
    ...(routeCondition && { condition: routeCondition }),
  };
  const [range, options, related, alternatives] = await Promise.all([
    priceRange(baseFilters),
    catalogOptions(resolved.brand?.id),
    relatedFor(kind, resolved),
    search.total < 8 ? alternativesFor(kind, resolved) : Promise.resolve([]),
  ]);

  return {
    status: "ok",
    kind,
    basePath,
    names,
    copy: browseCopy(kind, names, liveCount),
    parsed,
    search,
    seo,
    liveCount,
    indexable,
    introHtml,
    priceRange: range,
    facets: {
      brand: resolved.brand?.slug,
      model: resolved.model?.slug,
      category: resolved.category?.slug,
      city: resolved.city?.slug,
      condition: routeCondition ?? parsed.filters.condition,
    },
    fixed: { brand: Boolean(fromRoute.brand), category: Boolean(fromRoute.category), city: Boolean(fromRoute.city), condition: Boolean(routeCondition) },
    options,
    removals: removalsFor(basePath, { ...parsed, facets: pickResolved(parsed.facets, fromQuery) }, {
      brand: fromQuery.brand?.name ?? "",
      model: fromQuery.model?.name ?? "",
      category: fromQuery.category?.name ?? "",
      city: fromQuery.city?.name ?? "",
    }),
    related,
    alternatives,
  };
}

function pickResolved(facets: FacetSlugs, resolved: ResolvedFacets): FacetSlugs {
  const out: FacetSlugs = {};
  if (facets.brand && resolved.brand) out.brand = facets.brand;
  if (facets.model && resolved.model) out.model = facets.model;
  if (facets.category && resolved.category) out.category = facets.category;
  if (facets.city && resolved.city) out.city = facets.city;
  return out;
}

/** Memoizada por request: `generateMetadata` y la página comparten la misma carga. */
export const loadBrowse = cache((routeKey: string, queryKey: string): Promise<BrowseData> => {
  const route = JSON.parse(routeKey) as BrowseRoute;
  return load(route, new URLSearchParams(queryKey));
});

/** Clave estable para `loadBrowse` a partir de los `searchParams` de Next. */
export function queryKeyOf(searchParams: Record<string, string | string[] | undefined>): string {
  const entries: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) entries.push([k, x]);
  }
  return new URLSearchParams(entries).toString();
}
