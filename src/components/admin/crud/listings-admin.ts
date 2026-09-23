// Publicaciones en el admin (T-115, ADMIN_SPEC.md §4). Rol validado en cada
// función (admin, moderador; el dealer es fase 2). Cambios de estado por
// `transition()`; ediciones de campos con activity_log en la misma transacción.
import "server-only";

import { and, asc, desc, eq, gte, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { brands, cities, dealers, leads, listingEvents, listings, models, reports, activityLog, listingStatusEnum } from "@/db/schema";
import { diffFields, logActivity } from "@/lib/activity";
import { assertRole, type SessionUser } from "@/lib/auth/roles";
import { addDays, transition, TransitionError, type TransitionAction } from "@/lib/listings/state";
import { isWhatsAppCapable, normalizePhone } from "@/lib/phone";
import { parsePublicRef } from "@/lib/slug";
import { DealerNotAuthorizedError, dealerPublishProblem, listingPublishProblem } from "./authorization";

export const LISTING_ADMIN_ROLES = ["admin", "moderator"] as const;
export const PAGE_SIZE = 50;

export type AdminListingFilters = {
  status?: string;
  dealerId?: number;
  brandId?: number;
  cityId?: number;
  from?: string;
  to?: string;
  q?: string;
};

function whereFor(f: AdminListingFilters): SQL | undefined {
  const conds: SQL[] = [isNull(listings.deletedAt)];
  if (f.status && (listingStatusEnum as readonly string[]).includes(f.status)) conds.push(eq(listings.status, f.status as (typeof listingStatusEnum)[number]));
  if (f.dealerId) conds.push(eq(listings.dealerId, f.dealerId));
  if (f.brandId) conds.push(eq(listings.brandId, f.brandId));
  if (f.cityId) conds.push(eq(listings.cityId, f.cityId));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) conds.push(gte(listings.createdAt, new Date(`${f.from}T03:00:00Z`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) conds.push(lt(listings.createdAt, addDays(new Date(`${f.to}T03:00:00Z`), 1)));
  const q = f.q?.trim();
  if (q) {
    const ref = parsePublicRef(q);
    let phone: string | null = null;
    try {
      phone = normalizePhone(q, { allowLandline: true });
    } catch {
      phone = null;
    }
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    const alts: SQL[] = [like(listings.title, `%${escaped}%`), like(listings.externalRef, `%${escaped}%`)];
    if (ref) alts.push(eq(listings.publicRef, ref));
    if (phone) alts.push(eq(listings.contactPhoneE164, phone));
    conds.push(or(...alts)!);
  }
  return and(...conds);
}

export async function searchAdminListings(user: SessionUser | null, f: AdminListingFilters, page = 1) {
  assertRole(user, LISTING_ADMIN_ROLES);
  const where = whereFor(f);
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(listings).where(where),
    db
      .select({
        id: listings.id,
        publicRef: listings.publicRef,
        slug: listings.slug,
        title: listings.title,
        status: listings.status,
        priceGs: listings.priceGs,
        installmentGs: listings.installmentGs,
        contactPhoneE164: listings.contactPhoneE164,
        expiresAt: listings.expiresAt,
        createdAt: listings.createdAt,
        externalRef: listings.externalRef,
        viewCount: listings.viewCount,
        whatsappClickCount: listings.whatsappClickCount,
        brandName: brands.name,
        cityName: cities.name,
        dealerName: dealers.name,
      })
      .from(listings)
      .innerJoin(brands, eq(brands.id, listings.brandId))
      .innerJoin(cities, eq(cities.id, listings.cityId))
      .leftJoin(dealers, eq(dealers.id, listings.dealerId))
      .where(where)
      .orderBy(desc(listings.createdAt), desc(listings.id))
      .limit(PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * PAGE_SIZE),
  ]);
  return { total: Number(n), rows };
}

/** Para el CSV: todas las filas del filtro (tope 10.000). */
export async function exportAdminListings(user: SessionUser | null, f: AdminListingFilters) {
  assertRole(user, LISTING_ADMIN_ROLES);
  return db
    .select({
      referencia: listings.publicRef,
      referencia_comercio: listings.externalRef,
      titulo: listings.title,
      estado: listings.status,
      marca: brands.name,
      modelo: models.name,
      ciudad: cities.name,
      comercio: dealers.name,
      precio_gs: listings.priceGs,
      entrega_gs: listings.downPaymentGs,
      cuota_gs: listings.installmentGs,
      cantidad_cuotas: listings.installmentCount,
      publicada: listings.publishedAt,
      vence: listings.expiresAt,
      verificada: listings.lastVerifiedAt,
      vistas: listings.viewCount,
      clics_whatsapp: listings.whatsappClickCount,
    })
    .from(listings)
    .innerJoin(brands, eq(brands.id, listings.brandId))
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .leftJoin(models, eq(models.id, listings.modelId))
    .leftJoin(dealers, eq(dealers.id, listings.dealerId))
    .where(whereFor(f))
    .orderBy(asc(listings.id))
    .limit(10_000);
}

export type BulkAction = "pause" | "expire" | "extend";
export type BulkResult = { done: number; skipped: Array<{ id: number; reason: string }> };

/**
 * Acciones masivas. `expire` es del sistema en la matriz (DATABASE_SCHEMA §3):
 * se ejecuta con el actor sistema y el pedido del usuario queda en `job`.
 * `extend` corre `expires_at` N días desde el vencimiento actual (o desde hoy).
 */
export async function bulkListings(user: SessionUser | null, ids: readonly number[], action: BulkAction, days = 30): Promise<BulkResult> {
  const actor = assertRole(user, LISTING_ADMIN_ROLES);
  const out: BulkResult = { done: 0, skipped: [] };
  const clean = [...new Set(ids)].filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 500);
  for (const id of clean) {
    try {
      if (action === "extend") {
        const d = Math.min(Math.max(Math.round(days), 1), 365);
        await db.transaction(async (tx) => {
          const [row] = await tx.select({ expiresAt: listings.expiresAt, status: listings.status }).from(listings).where(eq(listings.id, id)).for("update");
          if (!row || row.status !== "published") throw new TransitionError("invalid_state", "Sólo se extienden publicadas.");
          const base = row.expiresAt && row.expiresAt > new Date() ? row.expiresAt : new Date();
          const expiresAt = addDays(base, d);
          await tx.update(listings).set({ expiresAt, updatedBy: actor.id }).where(eq(listings.id, id));
          await logActivity(tx, { userId: actor.id, entityType: "listing", entityId: id, action: "expiry_extended", diff: { expiresAt: { from: row.expiresAt, to: expiresAt }, days: d } });
        });
      } else if (action === "expire") {
        await transition({ listingId: id, action: "expire", actor: { kind: "system", job: `admin_expire_by_user_${actor.id}` } });
      } else {
        await transition({ listingId: id, action: "pause", actor: { kind: "user", user: actor } });
      }
      out.done += 1;
    } catch (error) {
      if (error instanceof TransitionError) out.skipped.push({ id, reason: error.message });
      else throw error;
    }
  }
  return out;
}

/** Cambio de estado de una publicación desde su ficha de admin. Publicar exige el bloque de autorización del comercio. */
export async function listingStateAction(user: SessionUser | null, id: number, action: TransitionAction): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = assertRole(user, LISTING_ADMIN_ROLES);
  if (!["pause", "resume", "mark_sold", "renew", "delete"].includes(action)) return { ok: false, error: "Acción no permitida acá." };
  try {
    if (action === "resume" || action === "renew") {
      const problem = await listingPublishProblem(id);
      if (problem) throw new DealerNotAuthorizedError(problem);
    }
    await transition({ listingId: id, action, actor: { kind: "user", user: actor } });
    return { ok: true };
  } catch (error) {
    if (error instanceof TransitionError || error instanceof DealerNotAuthorizedError) return { ok: false, error: error.message };
    throw error;
  }
}

export type ListingEditInput = {
  title: string;
  description: string | null;
  priceGs: number | null;
  hasFinancingOnly: boolean;
  downPaymentGs: number | null;
  installmentGs: number | null;
  installmentCount: number | null;
  year: number | null;
  mileageKm: number | null;
  isNegotiable: boolean;
  acceptsTradeIn: boolean;
  contactPhone: string;
  contactWhatsapp: boolean;
  documentationStatus: "al_dia" | "transferencia_pendiente" | "no_declara" | null;
  cityId: number;
  categoryId: number;
  modelId: number | null;
  dealerId: number | null;
  internalNote: string | null;
};

/**
 * Edición de admin. Un cambio de precio queda como `price_changed` y no vuelve
 * a moderación. La vuelta a moderación por fotos/descripción de §3 es para la
 * edición del propio vendedor (`/mi-aviso`, B4): acá edita quien modera.
 */
export async function updateListingAdmin(
  user: SessionUser | null,
  id: number,
  input: ListingEditInput,
): Promise<{ ok: true; changed: string[] } | { ok: false; errors: Record<string, string> }> {
  const actor = assertRole(user, LISTING_ADMIN_ROLES);
  const errors: Record<string, string> = {};
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < 5 || title.length > 200) errors.title = "El título va de 5 a 200 caracteres.";
  if (input.priceGs === null && !(input.installmentGs && input.installmentCount)) errors.priceGs = "Poné precio de contado o cuota y cantidad de cuotas.";
  if ((input.installmentGs === null) !== (input.installmentCount === null)) errors.installmentGs = "Cuota y cantidad de cuotas van juntas.";
  let phoneE164 = "";
  try {
    phoneE164 = normalizePhone(input.contactPhone, { allowLandline: !input.contactWhatsapp });
  } catch {
    errors.contactPhone = input.contactWhatsapp ? "Celular válido (0981 123 456); un fijo sólo con «sólo llamadas»." : "Teléfono válido.";
  }
  if (input.contactWhatsapp && phoneE164 && !isWhatsAppCapable(phoneE164)) errors.contactPhone = "Un fijo no tiene WhatsApp.";
  if (Object.keys(errors).length) return { ok: false, errors };

  type EditResult = { ok: true; changed: string[] } | { ok: false; errors: Record<string, string> };
  return db.transaction(async (tx): Promise<EditResult> => {
    const [row] = await tx.select().from(listings).where(eq(listings.id, id)).for("update");
    if (!row || row.deletedAt) return { ok: false as const, errors: { _: "La publicación no existe." } };
    if (input.dealerId !== row.dealerId) {
      // Cambiar el comercio mueve inventario y leads (revisión de seguridad): sólo admin,
      // nunca de particular a comercio (el vendedor perdería /mi-aviso) y, si está
      // publicada, el comercio nuevo tiene que tener su autorización (ADR-12).
      if (actor.role !== "admin") return { ok: false as const, errors: { dealerId: "Sólo un admin cambia el comercio de una publicación." } };
      if (row.dealerId === null) return { ok: false as const, errors: { dealerId: "Una publicación de particular no pasa a un comercio." } };
      if (input.dealerId !== null && row.status === "published") {
        const [d] = await tx
          .select({ slug: dealers.slug, status: dealers.status, authorizationNote: dealers.authorizationNote, authorizationDate: dealers.authorizationDate, deletedAt: dealers.deletedAt })
          .from(dealers)
          .where(eq(dealers.id, input.dealerId));
        const { fixturesRefusalReason } = await import("../../../../scripts/lib/dev-fixtures-core");
        const problem = d ? dealerPublishProblem(d, fixturesRefusalReason(process.env) === null) : "El comercio no existe.";
        if (problem) return { ok: false as const, errors: { dealerId: problem } };
      }
    }
    if (input.modelId !== null) {
      const [m] = await tx.select({ brandId: models.brandId }).from(models).where(eq(models.id, input.modelId));
      if (!m || m.brandId !== row.brandId) return { ok: false as const, errors: { modelId: "El modelo no es de la marca de la publicación." } };
    }
    const set = {
      title,
      description: input.description?.trim() || null,
      priceGs: input.priceGs,
      hasFinancingOnly: input.hasFinancingOnly || input.priceGs === null,
      downPaymentGs: input.downPaymentGs,
      installmentGs: input.installmentGs,
      installmentCount: input.installmentCount,
      year: input.year,
      mileageKm: input.mileageKm,
      isNegotiable: input.isNegotiable,
      acceptsTradeIn: input.acceptsTradeIn,
      contactPhoneE164: phoneE164,
      contactWhatsapp: input.contactWhatsapp,
      documentationStatus: row.condition === "new" ? null : input.documentationStatus,
      cityId: input.cityId,
      categoryId: input.categoryId,
      modelId: input.modelId ?? row.modelId,
      dealerId: input.dealerId,
    };
    const diff = diffFields(row as Record<string, unknown>, set as Record<string, unknown>);
    const changed = Object.keys(diff);
    if (changed.length === 0 && !input.internalNote) return { ok: true as const, changed };
    await tx
      .update(listings)
      .set({ ...set, ...(changed.includes("contactPhoneE164") ? { contactPhoneRaw: input.contactPhone.trim().slice(0, 30) } : {}), updatedBy: actor.id })
      .where(eq(listings.id, id));
    const priceKeys = ["priceGs", "downPaymentGs", "installmentGs", "installmentCount", "hasFinancingOnly"];
    const priceDiff = Object.fromEntries(Object.entries(diff).filter(([k]) => priceKeys.includes(k)));
    const otherDiff = Object.fromEntries(Object.entries(diff).filter(([k]) => !priceKeys.includes(k)));
    if (Object.keys(priceDiff).length) await logActivity(tx, { userId: actor.id, entityType: "listing", entityId: id, action: "price_changed", diff: priceDiff });
    if (Object.keys(otherDiff).length || input.internalNote) {
      await logActivity(tx, {
        userId: actor.id,
        entityType: "listing",
        entityId: id,
        action: "admin_edit",
        diff: { ...otherDiff, ...(input.internalNote ? { nota_interna: input.internalNote.slice(0, 1000) } : {}) },
      });
    }
    return { ok: true as const, changed };
  });
}

export type TimelineItem = { at: Date; kind: "activity" | "lead" | "report"; text: string };

/** Línea de tiempo: cambios (activity_log), leads, denuncias; y eventos agregados por tipo. */
export async function listingTimeline(user: SessionUser | null, id: number) {
  assertRole(user, LISTING_ADMIN_ROLES);
  const [acts, leadRows, reportRows, eventRows] = await Promise.all([
    db
      .select({ at: activityLog.createdAt, action: activityLog.action, userId: activityLog.userId, diff: activityLog.diffJson })
      .from(activityLog)
      .where(and(eq(activityLog.entityType, "listing"), eq(activityLog.entityId, id)))
      .orderBy(desc(activityLog.id))
      .limit(200),
    db.select({ at: leads.createdAt, type: leads.type, crm: leads.crmStatus }).from(leads).where(eq(leads.listingId, id)).orderBy(desc(leads.id)).limit(100),
    db.select({ at: reports.createdAt, reason: reports.reasonCode, status: reports.status }).from(reports).where(eq(reports.listingId, id)).orderBy(desc(reports.id)).limit(100),
    db
      .select({ type: listingEvents.eventType, bots: sql<number>`SUM(${listingEvents.isBot})`, n: sql<number>`COUNT(*)` })
      .from(listingEvents)
      .where(eq(listingEvents.listingId, id))
      .groupBy(listingEvents.eventType),
  ]);
  const items: TimelineItem[] = [
    ...acts.map((a) => ({ at: a.at, kind: "activity" as const, text: `${a.action}${a.userId ? ` (usuario ${a.userId})` : " (sistema)"}${a.diff ? `: ${JSON.stringify(a.diff).slice(0, 300)}` : ""}` })),
    ...leadRows.map((l) => ({ at: l.at, kind: "lead" as const, text: `Lead ${l.type} (CRM: ${l.crm})` })),
    ...reportRows.map((r) => ({ at: r.at, kind: "report" as const, text: `Denuncia ${r.reason} (${r.status})` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const events = eventRows.map((e) => ({ type: e.type, humans: Number(e.n) - Number(e.bots ?? 0), bots: Number(e.bots ?? 0) }));
  return { items, events };
}

export async function listingForEdit(user: SessionUser | null, id: number) {
  assertRole(user, LISTING_ADMIN_ROLES);
  const [row] = await db
    .select({ l: listings, brandName: brands.name })
    .from(listings)
    .innerJoin(brands, eq(brands.id, listings.brandId))
    .where(and(eq(listings.id, id), isNull(listings.deletedAt)));
  if (!row) return null;
  const [modelOpts, dealerOpts] = await Promise.all([
    db.select({ id: models.id, name: models.name }).from(models).where(eq(models.brandId, row.l.brandId)).orderBy(asc(models.name)),
    db.select({ id: dealers.id, name: dealers.name }).from(dealers).where(isNull(dealers.deletedAt)).orderBy(asc(dealers.name)),
  ]);
  return { listing: row.l, brandName: row.brandName, modelOpts, dealerOpts };
}
