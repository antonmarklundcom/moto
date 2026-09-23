// Operación de stock de un comercio: reconfirmar (G-6) y reporte (G-14).
import "server-only";
import { and, asc, count, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { dealers, leads, listingEvents, listings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { addDays, DEFAULT_LISTING_TTL_DAYS } from "@/lib/listings/state";
import type { DealerReport, StockLine } from "./messages";

export type DealerHeader = {
  id: number;
  name: string;
  slug: string;
  status: string;
  listingTtlDays: number | null;
  deletedAt: Date | null;
};

export async function getDealer(id: number): Promise<DealerHeader | null> {
  const [row] = await db
    .select({
      id: dealers.id,
      name: dealers.name,
      slug: dealers.slug,
      status: dealers.status,
      listingTtlDays: dealers.listingTtlDays,
      deletedAt: dealers.deletedAt,
    })
    .from(dealers)
    .where(eq(dealers.id, id));
  return row ?? null;
}

export type LiveStockRow = StockLine & { id: number; lastVerifiedAt: Date | null; expiresAt: Date | null };

/** Publicadas del comercio (las que tiene que confirmar), en orden de referencia. */
export async function publishedStock(dealerId: number): Promise<LiveStockRow[]> {
  return db
    .select({
      id: listings.id,
      externalRef: listings.externalRef,
      publicRef: listings.publicRef,
      title: listings.title,
      priceGs: listings.priceGs,
      downPaymentGs: listings.downPaymentGs,
      installmentGs: listings.installmentGs,
      installmentCount: listings.installmentCount,
      lastVerifiedAt: listings.lastVerifiedAt,
      expiresAt: listings.expiresAt,
    })
    .from(listings)
    .where(and(eq(listings.dealerId, dealerId), eq(listings.status, "published"), isNull(listings.deletedAt)))
    .orderBy(asc(listings.externalRef), asc(listings.id));
}

/**
 * G-6: el comercio confirmó que siguen disponibles. `last_verified_at` = ahora
 * y `expires_at` = ahora + TTL del comercio (NULL → 60), sin acortar uno más
 * largo. Sólo publicadas de ese comercio; lo demás se ignora. activity_log por fila.
 */
export async function reconfirmStock(input: {
  dealerId: number;
  listingIds: readonly number[];
  userId: number;
  now?: Date;
}): Promise<{ updated: number; ignored: number }> {
  const now = input.now ?? new Date();
  const ids = [...new Set(input.listingIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (ids.length === 0) return { updated: 0, ignored: 0 };
  return db.transaction(async (tx) => {
    const [dealer] = await tx
      .select({ ttl: dealers.listingTtlDays })
      .from(dealers)
      .where(eq(dealers.id, input.dealerId));
    if (!dealer) return { updated: 0, ignored: ids.length };
    const newExpiry = addDays(now, dealer.ttl ?? DEFAULT_LISTING_TTL_DAYS);
    const rows = await tx
      .select({ id: listings.id, lastVerifiedAt: listings.lastVerifiedAt, expiresAt: listings.expiresAt })
      .from(listings)
      .where(
        and(
          inArray(listings.id, ids),
          eq(listings.dealerId, input.dealerId),
          eq(listings.status, "published"),
          isNull(listings.deletedAt),
        ),
      )
      .for("update");
    for (const row of rows) {
      const expiresAt = row.expiresAt && row.expiresAt > newExpiry ? row.expiresAt : newExpiry;
      await tx
        .update(listings)
        .set({ lastVerifiedAt: now, expiresAt, updatedBy: input.userId })
        .where(eq(listings.id, row.id));
      await logActivity(tx, {
        userId: input.userId,
        entityType: "listing",
        entityId: row.id,
        action: "stock_reconfirmed",
        diff: {
          lastVerifiedAt: { from: row.lastVerifiedAt, to: now },
          expiresAt: { from: row.expiresAt, to: expiresAt },
        },
      });
    }
    return { updated: rows.length, ignored: ids.length - rows.length };
  });
}

/** Rango del reporte: `[from, to)`. Por defecto los últimos 30 días hasta ahora. */
export function reportRange(now: Date, days = 30): { from: Date; to: Date } {
  return { from: addDays(now, -days), to: now };
}

/**
 * G-14 / ANALYTICS_AND_KPIS.md §7: conteos reales de las motos del comercio en
 * el rango. Visitas y clics de WhatsApp sin bots (`is_bot = 0`); pedidos de
 * financiación sin spam. Sólo eventos y leads atados a una publicación del
 * comercio (no a su página de comercio).
 */
export async function dealerReport(dealerId: number, range: { from: Date; to: Date }): Promise<Omit<DealerReport, "dealerName">> {
  const eventCount = async (type: "view" | "whatsapp_click") => {
    const [row] = await db
      .select({ n: count() })
      .from(listingEvents)
      .innerJoin(listings, eq(listings.id, listingEvents.listingId))
      .where(
        and(
          eq(listings.dealerId, dealerId),
          eq(listingEvents.eventType, type),
          eq(listingEvents.isBot, false),
          gte(listingEvents.createdAt, range.from),
          lt(listingEvents.createdAt, range.to),
        ),
      );
    return row?.n ?? 0;
  };
  const [views, whatsappClicks, [leadRow], [liveRow]] = await Promise.all([
    eventCount("view"),
    eventCount("whatsapp_click"),
    db
      .select({ n: count() })
      .from(leads)
      .innerJoin(listings, eq(listings.id, leads.listingId))
      .where(
        and(
          eq(listings.dealerId, dealerId),
          eq(leads.type, "financing"),
          eq(leads.isSpam, false),
          gte(leads.createdAt, range.from),
          lt(leads.createdAt, range.to),
        ),
      ),
    db
      .select({ n: count() })
      .from(listings)
      .where(and(eq(listings.dealerId, dealerId), eq(listings.status, "published"), isNull(listings.deletedAt))),
  ]);
  return {
    from: range.from,
    to: range.to,
    publishedNow: liveRow?.n ?? 0,
    views,
    whatsappClicks,
    financingLeads: leadRow?.n ?? 0,
  };
}
