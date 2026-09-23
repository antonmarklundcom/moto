// Comercios públicos (PRODUCT_SPEC §3.4): sólo `active` y no borrados.
import "server-only";

import { and, asc, count, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { cities, dealers, listings } from "@/db/schema";
import { liveCondition } from "@/lib/listings/query";

export const VERIFIED_EXPLANATION = "Verificamos que este comercio existe y que su contacto es real. No verificamos las motos ni garantizamos las operaciones.";

export async function activeDealers() {
  const rows = await db
    .select({ id: dealers.id, name: dealers.name, slug: dealers.slug, isVerified: dealers.isVerified, city: cities.name })
    .from(dealers)
    .innerJoin(cities, eq(cities.id, dealers.cityId))
    .where(and(eq(dealers.status, "active"), isNull(dealers.deletedAt)))
    .orderBy(asc(dealers.name));
  const counts = await db
    .select({ dealerId: listings.dealerId, n: count() })
    .from(listings)
    .where(liveCondition(new Date(), "live"))
    .groupBy(listings.dealerId);
  const byDealer = new Map(counts.map((c) => [c.dealerId, Number(c.n)]));
  return rows.map((r) => ({ ...r, live: byDealer.get(r.id) ?? 0 }));
}

export const dealerBySlug = cache(async (slug: string) => {
  const [row] = await db
    .select({
      id: dealers.id,
      name: dealers.name,
      slug: dealers.slug,
      description: dealers.description,
      address: dealers.address,
      isVerified: dealers.isVerified,
      status: dealers.status,
      cityName: cities.name,
      department: cities.department,
    })
    .from(dealers)
    .innerJoin(cities, eq(cities.id, dealers.cityId))
    .where(and(eq(dealers.slug, slug), eq(dealers.status, "active"), isNull(dealers.deletedAt)))
    .limit(1);
  return row ?? null;
});
