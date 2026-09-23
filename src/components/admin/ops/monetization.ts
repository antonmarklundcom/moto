// Monetización manual (ADMIN_SPEC.md §8, ADR-13: sin pasarela). Todo lo que
// se muestra es lo registrado: nada proyectado (MONETIZATION.md §9).
import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { adPlacements, adPlacementStatusEnum, dealerPlans, dealers, featuredPurchases, listings, paymentMethodEnum } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertRole, type SessionUser, withScope } from "@/lib/auth/roles";
import { parsePublicRef } from "@/lib/slug";

const DAY = 86_400_000;
export const PLAN_ALERT_DAYS = [30, 7] as const;

export type PaymentMethod = (typeof paymentMethodEnum)[number];

/** Destacado: alta manual. `active` enciende `is_featured` hasta `ends_at`; `pending_payment` todavía no. */
export async function createFeatured(
  user: SessionUser | null,
  input: { ref: string; days: number; amountGs: number; method: string; reference: string | null; paid: boolean; now?: Date },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const actor = assertRole(user, ["admin"]);
  const ref = parsePublicRef(input.ref);
  if (!ref) return { ok: false, error: "Código de publicación inválido." };
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 365) return { ok: false, error: "Días entre 1 y 365." };
  if (!Number.isSafeInteger(input.amountGs) || input.amountGs < 0) return { ok: false, error: "Monto en guaraníes, sin decimales." };
  if (!(paymentMethodEnum as readonly string[]).includes(input.method)) return { ok: false, error: "Elegí el medio de pago." };
  if (input.method === "cortesia" && input.amountGs !== 0) return { ok: false, error: "Una cortesía va con monto 0." };
  const [l] = await db.select({ id: listings.id, dealerId: listings.dealerId, status: listings.status }).from(listings).where(and(eq(listings.publicRef, ref), isNull(listings.deletedAt)));
  if (!l) return { ok: false, error: "No existe esa publicación." };
  if (l.status !== "published") return { ok: false, error: "Sólo se destaca una publicación publicada." };
  const now = input.now ?? new Date();
  const endsAt = new Date(now.getTime() + input.days * DAY);
  return db.transaction(async (tx) => {
    const [res] = await tx.insert(featuredPurchases).values({
      listingId: l.id,
      dealerId: l.dealerId,
      amountGs: input.amountGs,
      days: input.days,
      startsAt: now,
      endsAt,
      paymentMethod: input.method as PaymentMethod,
      paymentReference: input.reference?.slice(0, 120) ?? null,
      status: input.paid ? "active" : "pending_payment",
      createdBy: actor.id,
    });
    if (input.paid) await tx.update(listings).set({ isFeatured: true, featuredUntil: endsAt, updatedAt: sql`${listings.updatedAt}` }).where(eq(listings.id, l.id));
    await logActivity(tx, { userId: actor.id, entityType: "featured_purchase", entityId: res.insertId, action: "featured_created", diff: { listingId: l.id, days: input.days, amountGs: input.amountGs, method: input.method, paid: input.paid } });
    return { ok: true as const, id: res.insertId };
  });
}

/** Cambiar estado de un destacado: cobrado (activa), reintegrado o cancelado (apaga si no queda otro activo). */
export async function setFeaturedStatus(user: SessionUser | null, id: number, status: "active" | "refunded" | "cancelled"): Promise<{ ok: boolean; error?: string }> {
  const actor = assertRole(user, ["admin"]);
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(featuredPurchases).where(eq(featuredPurchases.id, id)).for("update");
    if (!p) return { ok: false, error: "No existe." };
    await tx.update(featuredPurchases).set({ status }).where(eq(featuredPurchases.id, id));
    if (status === "active") {
      await tx.update(listings).set({ isFeatured: true, featuredUntil: p.endsAt, updatedAt: sql`${listings.updatedAt}` }).where(eq(listings.id, p.listingId));
    } else {
      const [other] = await tx
        .select({ endsAt: featuredPurchases.endsAt })
        .from(featuredPurchases)
        .where(and(eq(featuredPurchases.listingId, p.listingId), eq(featuredPurchases.status, "active"), ne(featuredPurchases.id, id)))
        .orderBy(desc(featuredPurchases.endsAt))
        .limit(1);
      await tx
        .update(listings)
        .set({ isFeatured: Boolean(other), featuredUntil: other?.endsAt ?? null, updatedAt: sql`${listings.updatedAt}` })
        .where(eq(listings.id, p.listingId));
    }
    await logActivity(tx, { userId: actor.id, entityType: "featured_purchase", entityId: id, action: `featured_${status}`, diff: { status: { from: p.status, to: status } } });
    return { ok: true };
  });
}

export async function featuredList(user: SessionUser | null) {
  const u = assertRole(user, ["admin", "dealer"]);
  return db
    .select({
      id: featuredPurchases.id,
      amountGs: featuredPurchases.amountGs,
      days: featuredPurchases.days,
      startsAt: featuredPurchases.startsAt,
      endsAt: featuredPurchases.endsAt,
      method: featuredPurchases.paymentMethod,
      reference: featuredPurchases.paymentReference,
      status: featuredPurchases.status,
      title: listings.title,
      ref: listings.publicRef,
    })
    .from(featuredPurchases)
    .innerJoin(listings, eq(listings.id, featuredPurchases.listingId))
    .where(withScope(u, { dealer: featuredPurchases.dealerId }))
    .orderBy(desc(featuredPurchases.startsAt))
    .limit(200);
}

export function planAlert(endsAt: string | null, now: Date = new Date()): 7 | 30 | "vencido" | null {
  if (!endsAt) return null;
  const left = new Date(`${endsAt}T03:00:00Z`).getTime() - now.getTime();
  if (left < 0) return "vencido";
  if (left <= 7 * DAY) return 7;
  if (left <= 30 * DAY) return 30;
  return null;
}

export async function savePlan(
  user: SessionUser | null,
  input: { dealerId: number; planCode: string; listingLimit: number | null; monthlyPriceGs: number; startsAt: string; endsAt: string | null; notes: string | null },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const actor = assertRole(user, ["admin"]);
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  if (!input.planCode.trim()) return { ok: false, error: "Poné el código del plan." };
  if (!DATE.test(input.startsAt) || (input.endsAt && !DATE.test(input.endsAt))) return { ok: false, error: "Fechas AAAA-MM-DD." };
  if (input.endsAt && input.endsAt < input.startsAt) return { ok: false, error: "La vigencia termina antes de empezar." };
  if (!Number.isSafeInteger(input.monthlyPriceGs) || input.monthlyPriceGs < 0) return { ok: false, error: "Precio en guaraníes." };
  const [d] = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.id, input.dealerId));
  if (!d) return { ok: false, error: "Elegí el comercio." };
  const [res] = await db.insert(dealerPlans).values({ ...input, planCode: input.planCode.trim().slice(0, 50), status: "active" });
  await logActivity(db, { userId: actor.id, entityType: "dealer_plan", entityId: res.insertId, action: "plan_created", diff: input });
  return { ok: true, id: res.insertId };
}

export async function plansList(user: SessionUser | null) {
  const u = assertRole(user, ["admin", "dealer"]);
  return db
    .select({ id: dealerPlans.id, dealer: dealers.name, planCode: dealerPlans.planCode, listingLimit: dealerPlans.listingLimit, monthlyPriceGs: dealerPlans.monthlyPriceGs, startsAt: dealerPlans.startsAt, endsAt: dealerPlans.endsAt, status: dealerPlans.status, notes: dealerPlans.notes })
    .from(dealerPlans)
    .innerJoin(dealers, eq(dealers.id, dealerPlans.dealerId))
    .where(withScope(u, { dealer: dealerPlans.dealerId }))
    .orderBy(asc(dealerPlans.endsAt));
}

export type AdInput = {
  advertiserName: string;
  slotCode: string;
  imagePath: string | null;
  targetUrl: string | null;
  altText: string | null;
  cityId: number | null;
  brandId: number | null;
  categoryId: number | null;
  startsAt: string;
  endsAt: string;
  amountGs: number | null;
  status: (typeof adPlacementStatusEnum)[number];
};

export async function saveAd(user: SessionUser | null, id: number | null, input: AdInput): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const actor = assertRole(user, ["admin"]);
  if (!input.advertiserName.trim() || !input.slotCode.trim()) return { ok: false, error: "Anunciante y espacio son obligatorios." };
  if (input.targetUrl && !/^https:\/\/[^\s]+$/.test(input.targetUrl)) return { ok: false, error: "El destino tiene que ser una URL https." };
  const starts = new Date(`${input.startsAt}T03:00:00Z`);
  const ends = new Date(`${input.endsAt}T03:00:00Z`);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) return { ok: false, error: "Vigencia inválida." };
  if (input.imagePath && !input.altText?.trim()) return { ok: false, error: "Una imagen lleva texto alternativo." };
  const values = { ...input, advertiserName: input.advertiserName.trim(), slotCode: input.slotCode.trim().slice(0, 50), startsAt: starts, endsAt: ends };
  if (id === null) {
    const [res] = await db.insert(adPlacements).values(values);
    await logActivity(db, { userId: actor.id, entityType: "ad_placement", entityId: res.insertId, action: "ad_created", diff: { ...input } });
    return { ok: true, id: res.insertId };
  }
  await db.update(adPlacements).set(values).where(eq(adPlacements.id, id));
  await logActivity(db, { userId: actor.id, entityType: "ad_placement", entityId: id, action: "ad_updated", diff: { ...input } });
  return { ok: true, id };
}

export async function adsList(user: SessionUser | null) {
  assertRole(user, ["admin"]);
  return db.select().from(adPlacements).orderBy(desc(adPlacements.startsAt)).limit(200);
}

/**
 * Ingresos por mes (hora de Paraguay): suma de lo cobrado y registrado —
 * destacados activos/vencidos (no pendientes, reintegrados ni cancelados) y
 * publicidad con monto (no borradores). Los planes no suman acá: su precio es
 * una condición, no un cobro registrado (no hay tabla de cobros de planes).
 */
export async function incomeByMonth(user: SessionUser | null, months = 12, now: Date = new Date()) {
  assertRole(user, ["admin"]);
  const since = new Date(now.getTime() - months * 31 * DAY);
  const month = (col: unknown) => sql<string>`DATE_FORMAT(CONVERT_TZ(${col}, '+00:00', '-03:00'), '%Y-%m')`;
  const [feat, ads] = await Promise.all([
    db
      .select({ month: month(featuredPurchases.startsAt), total: sql<string>`SUM(${featuredPurchases.amountGs})` })
      .from(featuredPurchases)
      .where(and(inArray(featuredPurchases.status, ["active", "expired"]), gte(featuredPurchases.startsAt, since)))
      .groupBy(sql`1`),
    db
      .select({ month: month(adPlacements.startsAt), total: sql<string>`SUM(${adPlacements.amountGs})` })
      .from(adPlacements)
      .where(and(ne(adPlacements.status, "draft"), gte(adPlacements.startsAt, since), lte(adPlacements.startsAt, now)))
      .groupBy(sql`1`),
  ]);
  const out = new Map<string, { featured: number; ads: number }>();
  for (const r of feat) out.set(r.month, { featured: Number(r.total ?? 0), ads: out.get(r.month)?.ads ?? 0 });
  for (const r of ads) out.set(r.month, { featured: out.get(r.month)?.featured ?? 0, ads: Number(r.total ?? 0) });
  return [...out.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([m, v]) => ({ month: m, ...v, total: v.featured + v.ads }));
}
