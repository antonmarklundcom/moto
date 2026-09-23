// Lecturas de la base para planificar una importación: catálogo, comercios y
// las publicaciones que ya existen con las referencias del archivo.
import "server-only";
import { and, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { brands, categories, cities, dealers, listings, models } from "@/db/schema";
import type { ExistingListing } from "./plan";
import { refKey } from "./plan";
import type { CatalogSnapshot } from "./validate";

export async function loadCatalog(): Promise<CatalogSnapshot> {
  const [brandRows, modelRows, cityRows, categoryRows, dealerRows] = await Promise.all([
    db.select({ id: brands.id, name: brands.name, slug: brands.slug, isActive: brands.isActive }).from(brands),
    db
      .select({
        id: models.id,
        brandId: models.brandId,
        name: models.name,
        slug: models.slug,
        isActive: models.isActive,
        categoryId: models.categoryId,
        engineCc: models.engineCc,
      })
      .from(models),
    db.select({ id: cities.id, name: cities.name, slug: cities.slug, isActive: cities.isActive }).from(cities),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug, isActive: categories.isActive }).from(categories),
    db
      .select({
        id: dealers.id,
        name: dealers.name,
        slug: dealers.slug,
        cityId: dealers.cityId,
        phoneE164: dealers.phoneE164,
        status: dealers.status,
        deletedAt: dealers.deletedAt,
        authorizationNote: dealers.authorizationNote,
        authorizationDate: dealers.authorizationDate,
        autoApprove: dealers.autoApprove,
        listingTtlDays: dealers.listingTtlDays,
      })
      .from(dealers),
  ]);
  return {
    brands: brandRows,
    models: modelRows,
    cities: cityRows,
    categories: categoryRows,
    dealers: dealerRows.map(({ deletedAt, ...d }) => ({ ...d, deleted: deletedAt !== null })),
  };
}

/** Publicaciones existentes de esos comercios, indexadas por `refKey`. */
export async function loadExisting(dealerIds: readonly number[]): Promise<Map<string, ExistingListing>> {
  const out = new Map<string, ExistingListing>();
  if (dealerIds.length === 0) return out;
  const rows = await db
    .select({
      id: listings.id,
      dealerId: listings.dealerId,
      externalRef: listings.externalRef,
      status: listings.status,
      deletedAt: listings.deletedAt,
      title: listings.title,
      description: listings.description,
      brandId: listings.brandId,
      modelId: listings.modelId,
      modelRaw: listings.modelRaw,
      categoryId: listings.categoryId,
      cityId: listings.cityId,
      condition: listings.condition,
      year: listings.year,
      mileageKm: listings.mileageKm,
      engineCc: listings.engineCc,
      priceGs: listings.priceGs,
      hasFinancingOnly: listings.hasFinancingOnly,
      downPaymentGs: listings.downPaymentGs,
      installmentGs: listings.installmentGs,
      installmentCount: listings.installmentCount,
      isNegotiable: listings.isNegotiable,
      acceptsTradeIn: listings.acceptsTradeIn,
      contactPhoneE164: listings.contactPhoneE164,
      contactPhoneRaw: listings.contactPhoneRaw,
      contactWhatsapp: listings.contactWhatsapp,
      documentationStatus: listings.documentationStatus,
    })
    .from(listings)
    .where(and(inArray(listings.dealerId, [...dealerIds]), isNotNull(listings.externalRef)));
  for (const { dealerId, externalRef, deletedAt, ...rest } of rows) {
    if (dealerId === null || externalRef === null) continue;
    out.set(refKey(dealerId, externalRef), { ...rest, deleted: deletedAt !== null });
  }
  return out;
}

/** Comercios para el selector del admin (no archivados ni borrados). */
export async function listImportDealers() {
  return db
    .select({ id: dealers.id, name: dealers.name, slug: dealers.slug, status: dealers.status })
    .from(dealers)
    .where(and(isNull(dealers.deletedAt), ne(dealers.status, "archived")))
    .orderBy(dealers.name);
}
