// Bandeja de leads (T-116, ADMIN_SPEC.md §7). Admin y moderador ven todo; el
// dealer sólo los leads de sus motos (alcance de A1). Reintentar y marcar
// spam: admin. El reintento usa el payload y el cliente de A4 con la misma
// `idempotency_key` del lead: nunca un payload nuevo.
import "server-only";

import { and, count, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { dealers, leadDeliveries, leads, leadTypeEnum, listings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertRole, type SessionUser, withScope } from "@/lib/auth/roles";
import { crmConfigFromEnv, postLeadToCrm, type CrmConfig } from "@/lib/crm/client";
import { crmPayloadForLead, deliverLead, MAX_CRM_ATTEMPTS } from "@/lib/leads/deliver";

export const LEADS_VIEW_ROLES = ["admin", "moderator", "dealer"] as const;
export const PAGE_SIZE = 50;

export type LeadFilters = { type?: string; crm?: string; from?: string; to?: string; exhausted?: boolean };

function where(user: SessionUser, f: LeadFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (f.type && (leadTypeEnum as readonly string[]).includes(f.type)) conds.push(eq(leads.type, f.type as (typeof leadTypeEnum)[number]));
  if (f.crm && ["pending", "sent", "duplicate", "failed"].includes(f.crm)) conds.push(eq(leads.crmStatus, f.crm as "pending"));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) conds.push(gte(leads.createdAt, new Date(`${f.from}T03:00:00Z`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) conds.push(lt(leads.createdAt, new Date(new Date(`${f.to}T03:00:00Z`).getTime() + 86_400_000)));
  if (f.exhausted) conds.push(eq(leads.crmStatus, "failed"), sql`${leads.crmAttempts} >= ${MAX_CRM_ATTEMPTS}`);
  return withScope(user, { dealer: leads.dealerId }, conds.length ? and(...conds) : undefined);
}

export async function searchLeads(user: SessionUser | null, f: LeadFilters, page = 1) {
  const u = assertRole(user, LEADS_VIEW_ROLES);
  const w = where(u, f);
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(leads).where(w),
    db
      .select({
        id: leads.id,
        type: leads.type,
        name: leads.name,
        phoneE164: leads.phoneE164,
        email: leads.email,
        message: leads.message,
        payloadJson: leads.payloadJson,
        utmSource: leads.utmSource,
        utmMedium: leads.utmMedium,
        utmCampaign: leads.utmCampaign,
        gclid: leads.gclid,
        fbclid: leads.fbclid,
        pageUrl: leads.pageUrl,
        referrer: leads.referrer,
        crmStatus: leads.crmStatus,
        crmAttempts: leads.crmAttempts,
        crmLastError: leads.crmLastError,
        isSpam: leads.isSpam,
        createdAt: leads.createdAt,
        listingTitle: listings.title,
        listingRef: listings.publicRef,
        listingSlug: listings.slug,
        dealerName: dealers.name,
      })
      .from(leads)
      .leftJoin(listings, eq(listings.id, leads.listingId))
      .leftJoin(dealers, eq(dealers.id, leads.dealerId))
      .where(w)
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * PAGE_SIZE),
  ]);
  return { total: Number(n), rows };
}

/** Panel de salud del CRM (§7): últimas 24 h por estado, agotados y el último error con su cuerpo. */
export async function crmHealth(user: SessionUser | null, now: Date = new Date()) {
  const u = assertRole(user, LEADS_VIEW_ROLES);
  const since = new Date(now.getTime() - 86_400_000);
  const [byStatus, [ex], [lastFail]] = await Promise.all([
    db.select({ status: leads.crmStatus, n: count() }).from(leads).where(withScope(u, { dealer: leads.dealerId }, gte(leads.createdAt, since))).groupBy(leads.crmStatus),
    db.select({ n: count() }).from(leads).where(where(u, { exhausted: true })),
    db
      .select({ leadId: leadDeliveries.leadId, httpStatus: leadDeliveries.httpStatus, body: leadDeliveries.responseBody, at: leadDeliveries.createdAt, error: leads.crmLastError })
      .from(leadDeliveries)
      .innerJoin(leads, eq(leads.id, leadDeliveries.leadId))
      .where(withScope(u, { dealer: leads.dealerId }, eq(leads.crmStatus, "failed")))
      .orderBy(desc(leadDeliveries.id))
      .limit(1),
  ]);
  const counts = { pending: 0, sent: 0, duplicate: 0, failed: 0 };
  for (const r of byStatus) counts[r.status] = Number(r.n);
  return { last24h: counts, exhausted: Number(ex?.n ?? 0), lastFailure: lastFail ?? null, crmConfigured: crmConfigFromEnv() !== null };
}

export type RetryResult = { ok: true; status: string } | { ok: false; error: string };

/**
 * Reintento manual. Pendiente o fallido con intentos disponibles → el mismo
 * `deliverLead` de A4 (reclamo atómico). Agotado (5 fallidos) → un intento
 * más con el mismo payload y la misma `idempotency_key`: si el CRM ya lo
 * había creado, contesta `duplicate` y eso es éxito (§2.6).
 */
export async function retryLead(user: SessionUser | null, leadId: number, options: { config?: CrmConfig | null; fetchImpl?: typeof fetch } = {}): Promise<RetryResult> {
  const actor = assertRole(user, ["admin"]);
  const config = options.config === undefined ? crmConfigFromEnv() : options.config;
  if (!config) return { ok: false, error: "El CRM no está configurado (VENDERCRM_URL / VENDERCRM_API_KEY)." };
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return { ok: false, error: "No existe el lead." };
  if (lead.isSpam) return { ok: false, error: "Está marcado como spam." };
  if (lead.crmStatus === "sent" || lead.crmStatus === "duplicate") return { ok: false, error: "Ya llegó al CRM." };

  let status: string;
  if (lead.crmAttempts < MAX_CRM_ATTEMPTS) {
    const r = await deliverLead(leadId, { config, fetchImpl: options.fetchImpl });
    status = r.status === "skipped" ? `skipped:${r.reason}` : r.status;
  } else {
    // Reclamo atómico del intento extra: si dos personas tocan "reintentar", sale uno solo.
    const attemptNo = lead.crmAttempts + 1;
    const [claim] = await db
      .update(leads)
      .set({ crmAttempts: attemptNo })
      .where(and(eq(leads.id, leadId), eq(leads.crmAttempts, lead.crmAttempts), eq(leads.crmStatus, "failed")));
    if (claim.affectedRows === 0) return { ok: false, error: "Otro reintento está en curso." };
    const r = await postLeadToCrm(config, crmPayloadForLead(lead), { fetchImpl: options.fetchImpl });
    await db.insert(leadDeliveries).values({ leadId, attemptNo, httpStatus: r.httpStatus, responseBody: r.responseBody, durationMs: r.durationMs });
    await db
      .update(leads)
      .set({
        crmStatus: r.outcome,
        crmLastError: r.outcome === "failed" ? r.error : null,
        ...(r.contactId ? { crmContactId: r.contactId } : {}),
        ...(r.dealId ? { crmDealId: r.dealId } : {}),
      })
      .where(eq(leads.id, leadId));
    status = r.outcome;
  }
  await logActivity(db, { userId: actor.id, entityType: "lead", entityId: leadId, action: "crm_manual_retry", diff: { result: status } });
  return { ok: true, status };
}

/** Marcar/desmarcar spam (admin). Un lead spam no se reintenta. */
export async function setLeadSpam(user: SessionUser | null, leadId: number, spam: boolean): Promise<void> {
  const actor = assertRole(user, ["admin"]);
  await db.transaction(async (tx) => {
    await tx.update(leads).set({ isSpam: spam }).where(eq(leads.id, leadId));
    await logActivity(tx, { userId: actor.id, entityType: "lead", entityId: leadId, action: spam ? "lead_marked_spam" : "lead_unmarked_spam", diff: null });
  });
}

/** CSV: todas las filas del filtro y del alcance (tope 10.000). */
export async function exportLeads(user: SessionUser | null, f: LeadFilters) {
  const u = assertRole(user, LEADS_VIEW_ROLES);
  return db
    .select({
      fecha: leads.createdAt,
      tipo: leads.type,
      nombre: leads.name,
      telefono: leads.phoneE164,
      email: leads.email,
      mensaje: leads.message,
      respuestas: leads.payloadJson,
      publicacion: listings.publicRef,
      comercio: dealers.name,
      utm_source: leads.utmSource,
      utm_medium: leads.utmMedium,
      utm_campaign: leads.utmCampaign,
      gclid: leads.gclid,
      fbclid: leads.fbclid,
      pagina: leads.pageUrl,
      crm: leads.crmStatus,
      intentos: leads.crmAttempts,
      spam: leads.isSpam,
    })
    .from(leads)
    .leftJoin(listings, eq(listings.id, leads.listingId))
    .leftJoin(dealers, eq(dealers.id, leads.dealerId))
    .where(where(u, f))
    .orderBy(desc(leads.id))
    .limit(10_000);
}

/** Celda CSV segura (anti-inyección de fórmulas). Pura. */
export function csvCell(v: unknown): string {
  const s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
