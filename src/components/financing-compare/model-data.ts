// Datos de la página de modelo y de /motos/en-cuotas (B2), sobre el contrato
// de A2 (consulta, umbral, canonical/robots, rutas).
import "server-only";

import { and, asc, count, countDistinct, desc, eq, inArray, isNotNull, max, min, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { brands, listings, models } from "@/db/schema";
import { formatGuaranies } from "@/lib/format";
import { type ListingFilters, parseSearchParams, type ParsedSearchParams } from "@/lib/listings/filters";
import { countLiveListings, type ListingSearchResult, listingWhere, liveCondition, resolveFacetSlugs, searchListings } from "@/lib/listings/query";
import { countWords, isIndexable } from "@/lib/seo/indexability";
import { type ListingPageSeo, resolveListingPageSeo } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";
import { offersForModel } from "./data";
import type { OfferListing } from "./offers";

export const MIN_PRICE_RANGE_N = 5;

async function priceRange(filters: ListingFilters) {
  const [r] = await db
    .select({ lo: min(listings.priceGs), hi: max(listings.priceGs), n: count() })
    .from(listings)
    .where(and(listingWhere(filters, new Date(), "available"), isNotNull(listings.priceGs)));
  const n = Number(r?.n ?? 0);
  if (n < MIN_PRICE_RANGE_N || r?.lo === null || r?.hi === null) return null;
  return { min: formatGuaranies(Number(r.lo))!, max: formatGuaranies(Number(r.hi))!, n };
}

type Seo = Extract<ListingPageSeo, { status: "ok" }>;

export type ModelPageData =
  | { status: "not_found" }
  | {
      status: "ok";
      brand: { id: number; name: string; slug: string };
      model: { id: number; name: string; slug: string; introHtml: string | null };
      basePath: string;
      parsed: ParsedSearchParams;
      search: ListingSearchResult;
      seo: Seo;
      liveCount: number;
      priceRange: { min: string; max: string; n: number } | null;
      offers: OfferListing[];
      brandCount: number;
    };

async function loadModel(brandSlug: string, modelSlug: string, query: string): Promise<ModelPageData> {
  const parsed = parseSearchParams(new URLSearchParams(query));
  if (parsed.page === null) return { status: "not_found" };
  const resolved = await resolveFacetSlugs({ brand: brandSlug, model: modelSlug });
  if (!resolved?.brand || !resolved.model) return { status: "not_found" };
  const base: ListingFilters = { brandId: resolved.brand.id, modelId: resolved.model.id };
  const basePath = paths.model(resolved.brand.slug, resolved.model.slug);
  const [liveCount, search, range, offers, brandCount] = await Promise.all([
    countLiveListings(base),
    searchListings({ filters: { ...base, ...parsed.filters }, sort: parsed.sort, page: parsed.page }),
    priceRange(base),
    offersForModel(resolved.model.id),
    countLiveListings({ brandId: resolved.brand.id }),
  ]);
  const indexable = isIndexable("model", liveCount, countWords(resolved.model.introHtml));
  const seo = resolveListingPageSeo({ basePath, parsed, baseIndexable: indexable, pageCount: search.pageCount });
  if (seo.status === "not_found") return { status: "not_found" };
  return {
    status: "ok",
    brand: resolved.brand,
    model: resolved.model,
    basePath,
    parsed,
    search,
    seo,
    liveCount,
    priceRange: range,
    offers,
    brandCount,
  };
}

export const loadModelPage = cache(loadModel);

export type EnCuotasData =
  | { status: "not_found" }
  | {
      status: "ok";
      parsed: ParsedSearchParams;
      search: ListingSearchResult;
      seo: Seo;
      liveCount: number;
      comparisons: Array<{ brand: { name: string; slug: string }; model: { name: string; slug: string }; offers: OfferListing[] }>;
    };

/** Modelos con más comercios ofreciéndolos en cuotas, para el bloque de comparación de /motos/en-cuotas. */
async function topFinancedModels(limit: number) {
  return db
    .select({ modelId: listings.modelId, dealers: countDistinct(listings.dealerId) })
    .from(listings)
    .where(and(liveCondition(new Date(), "available"), isNotNull(listings.installmentGs), isNotNull(listings.dealerId), isNotNull(listings.modelId)))
    .groupBy(listings.modelId)
    .orderBy(desc(countDistinct(listings.dealerId)))
    .limit(limit);
}

async function loadEnCuotas(query: string): Promise<EnCuotasData> {
  const parsed = parseSearchParams(new URLSearchParams(query));
  if (parsed.page === null) return { status: "not_found" };
  const base: ListingFilters = { withFinancing: true };
  const [liveCount, search, top] = await Promise.all([
    countLiveListings(base),
    searchListings({ filters: { ...base, ...parsed.filters }, sort: parsed.sort, page: parsed.page }),
    topFinancedModels(12),
  ]);
  // Sin texto editorial propio todavía (docs/decisions-needed.md, A2): 0 palabras → noindex por regla.
  const indexable = isIndexable("en_cuotas", liveCount, 0);
  const seo = resolveListingPageSeo({ basePath: paths.enCuotas, parsed, baseIndexable: indexable, pageCount: search.pageCount });
  if (seo.status === "not_found") return { status: "not_found" };

  const ids = top.map((t) => t.modelId).filter((id): id is number => id !== null);
  const modelRows = ids.length
    ? await db
        .select({ id: models.id, name: models.name, slug: models.slug, brandName: brands.name, brandSlug: brands.slug })
        .from(models)
        .innerJoin(brands, eq(brands.id, models.brandId))
        .where(and(inArray(models.id, ids), eq(models.isActive, true), eq(brands.isActive, true)))
        .orderBy(asc(models.name))
    : [];
  const comparisons = [];
  for (const id of ids) {
    const m = modelRows.find((r) => r.id === id);
    if (!m) continue;
    const offers = (await offersForModel(id)).filter((o) => o.installmentGs !== null);
    // En esta página sólo comparaciones reales: al menos dos comercios con cuota.
    if (offers.length >= 2) comparisons.push({ brand: { name: m.brandName, slug: m.brandSlug }, model: { name: m.name, slug: m.slug }, offers });
    if (comparisons.length >= 4) break;
  }
  return { status: "ok", parsed, search, seo, liveCount, comparisons };
}

export const loadEnCuotasPage = cache(loadEnCuotas);

/** Home: publicaciones recientes reales y facetas con inventario (sin contadores visibles). */
export async function homeData() {
  const [recent, byBrand, byCity] = await Promise.all([
    searchListings({ filters: {}, scope: "available", perPage: 8 }),
    db
      .select({ slug: brands.slug, name: brands.name, n: count() })
      .from(listings)
      .innerJoin(brands, eq(brands.id, listings.brandId))
      .where(and(liveCondition(new Date(), "available"), eq(brands.isActive, true)))
      .groupBy(brands.id, brands.slug, brands.name, brands.sortOrder)
      .orderBy(asc(brands.sortOrder), asc(brands.name)),
    db.execute<{ slug: string; name: string }>(
      // Ciudades activas con al menos una publicada, en su orden.
      sql`SELECT c.slug, c.name FROM cities c WHERE c.is_active = 1 AND EXISTS (SELECT 1 FROM listings l WHERE l.city_id = c.id AND l.status = 'published' AND l.deleted_at IS NULL) ORDER BY c.sort_order, c.name`,
    ),
  ]);
  const cities = (byCity as unknown as [Array<{ slug: string; name: string }>])[0];
  return { recent: recent.items, brands: byBrand.map((b) => ({ value: b.slug, label: b.name })), cities: cities.map((c) => ({ value: c.slug, label: c.name })) };
}
