// Job: fin de destacados (B9, ADMIN_SPEC.md §8). Apaga `is_featured` de las
// publicaciones cuyo `featured_until` pasó y pasa a `expired` las compras
// activas vencidas. No toca el estado de la publicación ni `updated_at`.
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { featuredPurchases, listings } from "@/db/schema";
import type { JobFn } from "../runner";

export const expireFeatured: JobFn = async ({ now }) => {
  const [off] = await db
    .update(listings)
    .set({ isFeatured: false, updatedAt: sql`${listings.updatedAt}` })
    .where(and(eq(listings.isFeatured, true), lte(listings.featuredUntil, now)));
  const [done] = await db
    .update(featuredPurchases)
    .set({ status: "expired" })
    .where(and(eq(featuredPurchases.status, "active"), lte(featuredPurchases.endsAt, now)));
  return { listingsUnfeatured: off.affectedRows, purchasesExpired: done.affectedRows };
};
