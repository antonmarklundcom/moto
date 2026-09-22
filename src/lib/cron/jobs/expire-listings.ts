// Job diario: published → expired (DATABASE_SCHEMA.md §3, sólo el sistema).
//
// Vence lo que tiene `expires_at` pasado y, para filas sin `expires_at`
// (importadas o anteriores a A1), lo publicado hace más de
// `dealers.listing_ttl_days` días (NULL o particular → 60). Cada vencimiento
// pasa por transition(): misma validación y su fila de activity_log.
import { and, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { dealers, listings } from "@/db/schema";
import { DEFAULT_LISTING_TTL_DAYS, transition, TransitionError } from "@/lib/listings/state";
import type { JobFn } from "../runner";

const BATCH = 200;

export const expireListings: JobFn = async ({ now }) => {
  const ttl = sql`COALESCE(${dealers.listingTtlDays}, ${DEFAULT_LISTING_TTL_DAYS})`;
  let expired = 0;
  let skipped = 0;
  let cursor = 0;

  for (;;) {
    const due = await db
      .select({ id: listings.id })
      .from(listings)
      .leftJoin(dealers, eq(dealers.id, listings.dealerId))
      .where(
        and(
          gt(listings.id, cursor),
          eq(listings.status, "published"),
          isNull(listings.deletedAt),
          or(
            and(isNotNull(listings.expiresAt), lte(listings.expiresAt, now)),
            and(
              isNull(listings.expiresAt),
              isNotNull(listings.publishedAt),
              lte(sql`DATE_ADD(${listings.publishedAt}, INTERVAL ${ttl} DAY)`, now),
            ),
          ),
        ),
      )
      .orderBy(listings.id)
      .limit(BATCH);

    for (const { id } of due) {
      cursor = id;
      try {
        await transition({ listingId: id, action: "expire", actor: { kind: "system", job: "expire-listings" }, now });
        expired++;
      } catch (error) {
        // Cambió de estado entre la lectura y el bloqueo: no es un fallo del job.
        if (error instanceof TransitionError) skipped++;
        else throw error;
      }
    }
    if (due.length < BATCH) break;
  }

  return { expired, skipped };
};
