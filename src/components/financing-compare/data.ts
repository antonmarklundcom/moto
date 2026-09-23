import "server-only";

import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { dealers, listings } from "@/db/schema";
import { liveCondition } from "@/lib/listings/query";
import { type OfferListing, offerRows } from "./offers";

/** Publicadas de comercio del modelo con precio o cuota, una fila por comercio. */
export async function offersForModel(modelId: number, now: Date = new Date()): Promise<OfferListing[]> {
  const rows = await db
    .select({
      listingId: listings.id,
      slug: listings.slug,
      publicRef: listings.publicRef,
      title: listings.title,
      condition: listings.condition,
      year: listings.year,
      priceGs: listings.priceGs,
      hasFinancingOnly: listings.hasFinancingOnly,
      downPaymentGs: listings.downPaymentGs,
      installmentGs: listings.installmentGs,
      installmentCount: listings.installmentCount,
      dealerId: dealers.id,
      dealerName: dealers.name,
      dealerSlug: dealers.slug,
      dealerVerified: dealers.isVerified,
      dealerStatus: dealers.status,
    })
    .from(listings)
    .innerJoin(dealers, eq(dealers.id, listings.dealerId))
    .where(
      and(
        liveCondition(now, "available"),
        eq(listings.modelId, modelId),
        isNull(dealers.deletedAt),
        or(isNotNull(listings.priceGs), isNotNull(listings.installmentGs)),
      ),
    )
    .limit(500);
  return offerRows(
    rows.map((r) => ({
      listingId: r.listingId,
      slug: r.slug,
      publicRef: r.publicRef,
      title: r.title,
      condition: r.condition,
      year: r.year,
      priceGs: r.hasFinancingOnly ? null : r.priceGs,
      hasFinancingOnly: r.hasFinancingOnly,
      downPaymentGs: r.downPaymentGs,
      installmentGs: r.installmentGs,
      installmentCount: r.installmentCount,
      dealer: { id: r.dealerId, name: r.dealerName, slug: r.dealerSlug, isVerified: r.dealerVerified, active: r.dealerStatus === "active" },
    })),
  );
}
