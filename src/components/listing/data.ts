// Datos de la ficha `/aviso/<slug>-<ref>` (T-104). Todo sale de la base:
// fotos, datos, contexto del modelo, rango de precios (≥ 5 unidades) y
// similares reales (si no hay, el bloque no aparece).
import "server-only";

import { and, asc, count, eq, isNotNull, max, min } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { brands, categories, cities, dealers, listingImages, listings, models } from "@/db/schema";
import { formatGuaranies } from "@/lib/format";
import { type ListingCardData, listingWhere, searchListings } from "@/lib/listings/query";
import { parseListingParam } from "@/lib/seo/routes";
import { getStorage } from "@/lib/storage";
import { type PublicState, publicState } from "./rules";

export const MIN_MODEL_PRICE_RANGE = 5;

export type ListingImage = { url: string; width: number | null; height: number | null; alt: string | null; isCatalogPhoto: boolean };

export type ListingDetail = {
  id: number;
  slug: string;
  publicRef: string;
  title: string;
  description: string | null;
  status: "published" | "sold" | "expired";
  condition: "new" | "used";
  year: number | null;
  mileageKm: number | null;
  engineCc: number | null;
  priceGs: number | null;
  hasFinancingOnly: boolean;
  downPaymentGs: number | null;
  installmentGs: number | null;
  installmentCount: number | null;
  isNegotiable: boolean;
  acceptsTradeIn: boolean;
  contactWhatsapp: boolean;
  documentationStatus: "al_dia" | "transferencia_pendiente" | "no_declara" | null;
  soldAt: Date | null;
  expiresAt: Date | null;
  publishedAt: Date | null;
  lastVerifiedAt: Date | null;
  modelRaw: string | null;
  brand: { id: number; name: string; slug: string };
  model: { id: number; name: string; slug: string; introHtml: string | null } | null;
  category: { name: string; slug: string };
  city: { name: string; slug: string };
  dealer: { id: number; name: string; slug: string; isVerified: boolean; status: string } | null;
  images: ListingImage[];
};

export type ListingLoad =
  | { status: "not_found" }
  | { status: "gone" }
  | { status: "redirect"; location: { brandSlug: string; modelSlug: string | null } }
  | { status: "wrong_slug"; listing: { slug: string; publicRef: string } }
  | {
      status: "ok";
      state: Extract<PublicState, { kind: "live" | "sold" | "expired" }>["kind"];
      listing: ListingDetail;
      priceRange: { min: string; max: string; n: number } | null;
      similar: ListingCardData[];
    };

async function load(param: string, now: Date): Promise<ListingLoad> {
  const parsed = parseListingParam(param);
  if (!parsed) return { status: "not_found" };
  const [row] = await db
    .select({
      l: listings,
      brandName: brands.name,
      brandSlug: brands.slug,
      modelName: models.name,
      modelSlug: models.slug,
      modelIntro: models.introHtml,
      categoryName: categories.name,
      categorySlug: categories.slug,
      cityName: cities.name,
      citySlug: cities.slug,
      dealerName: dealers.name,
      dealerSlug: dealers.slug,
      dealerVerified: dealers.isVerified,
      dealerStatus: dealers.status,
    })
    .from(listings)
    .innerJoin(brands, eq(brands.id, listings.brandId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .leftJoin(models, eq(models.id, listings.modelId))
    .leftJoin(dealers, eq(dealers.id, listings.dealerId))
    .where(eq(listings.publicRef, parsed.ref))
    .limit(1);
  if (!row) return { status: "not_found" };
  const l = row.l;

  const state = publicState(l, now);
  if (state.kind === "hidden") return { status: "not_found" };
  if (state.kind === "gone") return { status: "gone" };
  if (state.kind === "retired") return { status: "redirect", location: { brandSlug: row.brandSlug, modelSlug: row.modelSlug } };
  // Mismo ref, otro slug (título viejo, URL recortada): 301 a la canónica (§1, slug inmutable).
  if (parsed.slug !== l.slug) return { status: "wrong_slug", listing: { slug: l.slug, publicRef: l.publicRef } };

  const storage = getStorage();
  const imageRows = await db
    .select()
    .from(listingImages)
    .where(eq(listingImages.listingId, l.id))
    .orderBy(asc(listingImages.sortOrder), asc(listingImages.id));

  const listing: ListingDetail = {
    id: l.id,
    slug: l.slug,
    publicRef: l.publicRef,
    title: l.title,
    description: l.description,
    status: l.status as ListingDetail["status"],
    condition: l.condition,
    year: l.year,
    mileageKm: l.mileageKm,
    engineCc: l.engineCc,
    priceGs: l.priceGs,
    hasFinancingOnly: l.hasFinancingOnly,
    downPaymentGs: l.downPaymentGs,
    installmentGs: l.installmentGs,
    installmentCount: l.installmentCount,
    isNegotiable: l.isNegotiable,
    acceptsTradeIn: l.acceptsTradeIn,
    contactWhatsapp: l.contactWhatsapp,
    documentationStatus: l.documentationStatus,
    soldAt: l.soldAt,
    expiresAt: l.expiresAt,
    publishedAt: l.publishedAt,
    lastVerifiedAt: l.lastVerifiedAt,
    modelRaw: l.modelRaw,
    brand: { id: l.brandId, name: row.brandName, slug: row.brandSlug },
    model:
      l.modelId !== null && row.modelName && row.modelSlug
        ? { id: l.modelId, name: row.modelName, slug: row.modelSlug, introHtml: row.modelIntro }
        : null,
    category: { name: row.categoryName, slug: row.categorySlug },
    city: { name: row.cityName, slug: row.citySlug },
    dealer:
      l.dealerId !== null && row.dealerName && row.dealerSlug
        ? { id: l.dealerId, name: row.dealerName, slug: row.dealerSlug, isVerified: row.dealerVerified === true, status: row.dealerStatus ?? "" }
        : null,
    images: imageRows.map((i) => ({
      url: storage.url(i.storagePath),
      width: i.width,
      height: i.height,
      alt: i.altText,
      isCatalogPhoto: i.isCatalogPhoto,
    })),
  };

  const [priceRange, similar] = await Promise.all([modelPriceRange(listing, now), similarListings(listing, now)]);
  return { status: "ok", state: state.kind, listing, priceRange, similar };
}

/** Rango de precios de contado del modelo en el sitio, sólo con ≥ 5 publicadas con precio (§5, PRODUCT_SPEC §3.3). */
async function modelPriceRange(l: ListingDetail, now: Date) {
  if (!l.model) return null;
  const [r] = await db
    .select({ lo: min(listings.priceGs), hi: max(listings.priceGs), n: count() })
    .from(listings)
    .where(and(listingWhere({ modelId: l.model.id, condition: l.condition }, now, "available"), isNotNull(listings.priceGs)));
  const n = Number(r?.n ?? 0);
  if (n < MIN_MODEL_PRICE_RANGE || r?.lo === null || r?.hi === null) return null;
  return { min: formatGuaranies(Number(r.lo))!, max: formatGuaranies(Number(r.hi))!, n };
}

/** Similares reales: mismo modelo, si no la misma marca; sólo publicadas, sin esta. */
async function similarListings(l: ListingDetail, now: Date): Promise<ListingCardData[]> {
  const pick = async (filters: Parameters<typeof searchListings>[0]["filters"]) =>
    (await searchListings({ filters, perPage: 5, scope: "available", now })).items.filter((i) => i.id !== l.id).slice(0, 4);
  let items = l.model ? await pick({ modelId: l.model.id }) : [];
  if (items.length < 2) items = await pick({ brandId: l.brand.id });
  return items;
}

/** Memoizada por request (metadata + página). */
export const loadListing = cache((param: string) => load(param, new Date()));
