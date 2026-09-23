// Envío de un lead guardado a VenderCRM (INTEGRATIONS.md §2.6–§2.8).
//
// - Una fila de `lead_deliveries` por intento, con código, cuerpo y duración.
// - `200 duplicate:true` es éxito (`crm_status = duplicate`).
// - Sin VENDERCRM_URL o key (S-6): no se intenta nada, el lead sigue
//   `pending` y queda una línea de log. El job de reintento lo manda cuando
//   la configuración exista.
// - Nunca duplica: antes de postear se "reclama" el intento con un UPDATE
//   condicionado a `crm_attempts` = el valor leído. Si otro proceso (el envío
//   inmediato y el cron a la vez) ya lo reclamó, éste no postea. Y aunque
//   posteen los dos, la misma idempotency_key hace que el CRM conteste
//   duplicate en vez de crear un segundo contacto.
import "server-only";

import { and, desc, eq, inArray, lt, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { leadDeliveries, leads } from "@/db/schema";
import { crmConfigFromEnv, postLeadToCrm, type CrmConfig, type PostOptions } from "@/lib/crm/client";
import { buildCrmPayload, CRM_SOURCE, type CrmLeadPayload } from "@/lib/crm/payload";
import { env } from "@/lib/env";
import { leadLog } from "./log";
import type { LeadPayloadJson } from "./save";

export const MAX_CRM_ATTEMPTS = 5;

/**
 * Espera después del intento N antes del N+1 (§2.8: 1 min, 5 min, 30 min,
 * 2 h, 12 h). Con 5 intentos como tope se usan las cuatro primeras; la de
 * 12 h aplica a un lead `pending` que nunca se intentó (ver `nextAttemptDue`).
 */
export const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000] as const;

/** Margen para que el envío inmediato (after()) gane antes que el cron. */
export const FIRST_ATTEMPT_GRACE_MS = 60_000;

/**
 * ¿Cuándo toca el próximo intento? `null` = nunca más (tope alcanzado).
 * Pura, para probar el backoff sin base.
 */
export function nextAttemptDue(lead: { crmAttempts: number; createdAt: Date; lastAttemptAt: Date | null }): Date | null {
  if (lead.crmAttempts >= MAX_CRM_ATTEMPTS) return null;
  if (lead.crmAttempts === 0 || lead.lastAttemptAt === null) {
    return new Date(lead.createdAt.getTime() + FIRST_ATTEMPT_GRACE_MS);
  }
  const wait = RETRY_BACKOFF_MS[Math.min(lead.crmAttempts, RETRY_BACKOFF_MS.length) - 1];
  return new Date(lead.lastAttemptAt.getTime() + wait);
}

type LeadRow = typeof leads.$inferSelect;

export function crmPayloadForLead(lead: LeadRow): CrmLeadPayload {
  const stored = (lead.payloadJson ?? {}) as Partial<LeadPayloadJson>;
  return buildCrmPayload({
    phoneE164: lead.phoneE164,
    idempotencyKey: lead.idempotencyKey,
    name: lead.name,
    email: lead.email,
    message: lead.message,
    source: stored.source ?? CRM_SOURCE,
    utmSource: lead.utmSource,
    utmMedium: lead.utmMedium,
    utmCampaign: lead.utmCampaign,
    utmTerm: lead.utmTerm,
    utmContent: lead.utmContent,
    gclid: lead.gclid,
    fbclid: lead.fbclid,
    pageUrl: lead.pageUrl,
    referrer: lead.referrer,
    fields: stored.fields ?? null,
  });
}

export type DeliveryResult =
  | { status: "sent" | "duplicate" | "failed"; leadId: number; attemptNo: number; httpStatus: number | null }
  | { status: "skipped"; leadId: number; reason: "crm_not_configured" | "not_found" | "not_eligible" | "claimed_elsewhere" };

export type DeliverOptions = PostOptions & {
  /** `undefined` = leer del entorno; `null` = sin configurar. */
  config?: CrmConfig | null;
  now?: Date;
};

export async function deliverLead(leadId: number, options: DeliverOptions = {}): Promise<DeliveryResult> {
  const config = options.config === undefined ? crmConfigFromEnv() : options.config;
  if (!config) {
    leadLog("warn", "crm: VENDERCRM_URL o VENDERCRM_API_KEY sin definir; el lead queda pending", {
      leadId,
      hasUrl: env.vendercrmUrl() !== null,
    });
    return { status: "skipped", leadId, reason: "crm_not_configured" };
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return { status: "skipped", leadId, reason: "not_found" };
  if (lead.isSpam || lead.crmAttempts >= MAX_CRM_ATTEMPTS || (lead.crmStatus !== "pending" && lead.crmStatus !== "failed")) {
    return { status: "skipped", leadId, reason: "not_eligible" };
  }

  // Reclamo atómico del intento N+1.
  const attemptNo = lead.crmAttempts + 1;
  const [claim] = await db
    .update(leads)
    .set({ crmAttempts: attemptNo })
    .where(
      and(
        eq(leads.id, leadId),
        eq(leads.crmAttempts, lead.crmAttempts),
        inArray(leads.crmStatus, ["pending", "failed"]),
        eq(leads.isSpam, false),
      ),
    );
  if (claim.affectedRows === 0) return { status: "skipped", leadId, reason: "claimed_elsewhere" };

  let result: Awaited<ReturnType<typeof postLeadToCrm>>;
  try {
    result = await postLeadToCrm(config, crmPayloadForLead(lead), options);
  } catch (error) {
    // Sólo llega acá si el payload no se pudo armar (dato corrupto en la base).
    const message = error instanceof Error ? error.message : String(error);
    result = {
      outcome: "failed",
      contactId: null,
      dealId: null,
      error: `payload: ${message}`,
      level: "error",
      httpStatus: null,
      responseBody: `payload: ${message}`,
      durationMs: 0,
    };
  }

  const finishedAt = options.now ?? new Date();
  await db.insert(leadDeliveries).values({
    leadId,
    attemptNo,
    httpStatus: result.httpStatus,
    responseBody: result.responseBody,
    durationMs: result.durationMs,
    createdAt: finishedAt,
  });
  await db
    .update(leads)
    .set({
      crmStatus: result.outcome,
      ...(result.outcome === "failed"
        ? { crmLastError: result.error }
        : {
            crmLastError: null,
            // En un duplicate el CRM repite los ids; si no vinieran, no se pisan los guardados.
            ...(result.contactId ? { crmContactId: result.contactId } : {}),
            ...(result.dealId ? { crmDealId: result.dealId } : {}),
          }),
    })
    .where(eq(leads.id, leadId));

  leadLog(result.level, `crm: intento ${result.outcome}`, {
    leadId,
    attemptNo,
    httpStatus: result.httpStatus,
    durationMs: result.durationMs,
    ...(result.error ? { error: result.error.slice(0, 1000) } : {}),
    ...(result.outcome === "failed" && attemptNo >= MAX_CRM_ATTEMPTS ? { exhausted: true } : {}),
  });
  return { status: result.outcome, leadId, attemptNo, httpStatus: result.httpStatus };
}

export type RetryCandidate = { id: number; crmAttempts: number; createdAt: Date; lastAttemptAt: Date | null };

/**
 * Leads que toca (re)intentar ahora: `pending` o `failed`, no spam, menos de
 * 5 intentos y con el backoff cumplido. Los más viejos primero.
 */
export async function dueLeads(now: Date, limit: number): Promise<RetryCandidate[]> {
  const lastAttempt = db
    .select({ leadId: leadDeliveries.leadId, lastAt: max(leadDeliveries.createdAt).as("last_at") })
    .from(leadDeliveries)
    .groupBy(leadDeliveries.leadId)
    .as("last_attempt");
  const rows = await db
    .select({
      id: leads.id,
      crmAttempts: leads.crmAttempts,
      createdAt: leads.createdAt,
      lastAttemptAt: sql<Date | string | null>`${lastAttempt.lastAt}`,
    })
    .from(leads)
    .leftJoin(lastAttempt, eq(lastAttempt.leadId, leads.id))
    .where(
      and(
        inArray(leads.crmStatus, ["pending", "failed"]),
        eq(leads.isSpam, false),
        lt(leads.crmAttempts, MAX_CRM_ATTEMPTS),
        lt(leads.createdAt, new Date(now.getTime() - FIRST_ATTEMPT_GRACE_MS)),
      ),
    )
    .orderBy(leads.createdAt, leads.id)
    .limit(500);

  const due: RetryCandidate[] = [];
  for (const row of rows) {
    const lastAttemptAt = row.lastAttemptAt === null ? null : toUtcDate(row.lastAttemptAt);
    const candidate = { id: row.id, crmAttempts: row.crmAttempts, createdAt: row.createdAt, lastAttemptAt };
    const at = nextAttemptDue(candidate);
    if (at !== null && at.getTime() <= now.getTime()) due.push(candidate);
    if (due.length >= limit) break;
  }
  return due;
}

/** MAX() en un sql`` crudo llega como texto "YYYY-MM-DD HH:MM:SS" (UTC, pool con timezone Z). */
function toUtcDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return new Date(`${value.replace(" ", "T")}Z`);
}

/** Cantidad de leads que agotaron los 5 intentos sin llegar (alarma del admin, B9). */
export async function exhaustedLeadCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.crmStatus, "failed"), eq(leads.isSpam, false), sql`${leads.crmAttempts} >= ${MAX_CRM_ATTEMPTS}`));
  return Number(row?.n ?? 0);
}

/** Último intento de un lead (para el admin). */
export async function lastDelivery(leadId: number) {
  const [row] = await db
    .select()
    .from(leadDeliveries)
    .where(eq(leadDeliveries.leadId, leadId))
    .orderBy(desc(leadDeliveries.attemptNo))
    .limit(1);
  return row ?? null;
}
