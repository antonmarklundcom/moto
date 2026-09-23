// Denuncias (T-118 lado público, TRUST_AND_SAFETY.md §5). Sin registro,
// teléfono opcional, 5 por IP por día; 3 denuncias independientes (IP
// distintas) de `estafa`/`robada` pausan la publicación por la máquina de
// estados con actor sistema. Nunca se revela quién denunció.
//
// Contra la mala fe (propietario 2026-09-23): una IP con denuncias
// descartadas queda silenciada sin avisarle; tras una reanudación humana,
// las denuncias viejas no cuentan y hay 30 días sin pausa automática.
import "server-only";

import { and, count, countDistinct, desc, eq, gt, gte, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, listings, reports } from "@/db/schema";
import { hashWithSalt } from "@/lib/hash";
import { normalizePhone } from "@/lib/phone";
import { RateLimiter } from "@/lib/rate-limit";
import { parsePublicRef } from "@/lib/slug";
import { REPORTS_AUTO_PAUSE_JOB, TransitionError, TransitionForbiddenError, transition } from "@/lib/listings/state";
import {
  AUTO_PAUSE_COOLDOWN_DAYS,
  AUTO_PAUSE_REASONS,
  AUTO_PAUSE_THRESHOLD,
  isReportReason,
  REPORTER_MUTE_DISMISSED,
  REPORTER_MUTE_WINDOW_DAYS,
  REPORTS_PER_IP_PER_DAY,
  type ReportReason,
} from "./rules";

const DAY_MS = 86_400_000;
// Sin IP_HASH_SALT no hay hash que guardar: el tope por IP cae a memoria.
const memoryLimiter = new RateLimiter(REPORTS_PER_IP_PER_DAY, DAY_MS);

export type ReportInput = {
  ref: string;
  reason: unknown;
  detail?: string | null;
  phone?: string | null;
  honeypot?: string | null;
  ip: string | null;
  salt: string | null;
  now?: Date;
};

export type ReportResult =
  | { ok: true; paused: boolean; autoPause: AutoPauseOutcome }
  | { ok: false; status: 400 | 404 | 429; error: string; field?: string };

/** `cooldown`: llegó al umbral pero un moderador la reanudó hace poco; queda al tope de la cola. */
export type AutoPauseOutcome = "not_needed" | "paused" | "blocked" | "cooldown";

export const MUTED_REPORT_NOTE = "Automático: quien denuncia tiene denuncias descartadas recientes (T&S §5).";

/** Última reanudación hecha por una persona (no por el propio dueño con su enlace). */
async function lastStaffResume(listingId: number): Promise<Date | null> {
  const [row] = await db
    .select({ at: activityLog.createdAt })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.entityType, "listing"),
        eq(activityLog.entityId, listingId),
        eq(activityLog.action, "resumed"),
        isNotNull(activityLog.userId),
      ),
    )
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
    .limit(1);
  return row?.at ?? null;
}

/** ¿Esta IP ya tiene denuncias descartadas por un moderador en la ventana? */
async function isMutedReporter(ipHash: string, now: Date): Promise<boolean> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(reports)
    .where(
      and(
        eq(reports.reporterIpHash, ipHash),
        eq(reports.status, "dismissed"),
        isNotNull(reports.resolvedBy),
        gte(reports.createdAt, new Date(now.getTime() - REPORTER_MUTE_WINDOW_DAYS * DAY_MS)),
      ),
    );
  return Number(n) >= REPORTER_MUTE_DISMISSED;
}

/** Cuenta denuncias independientes de estafa/robada y, al llegar a 3, intenta pausar. */
export async function applyAutoPause(listingId: number, now: Date = new Date()): Promise<AutoPauseOutcome> {
  const resumedAt = await lastStaffResume(listingId);
  const [{ n }] = await db
    .select({ n: countDistinct(reports.reporterIpHash) })
    .from(reports)
    .where(
      and(
        eq(reports.listingId, listingId),
        inArray(reports.reasonCode, [...AUTO_PAUSE_REASONS]),
        ne(reports.status, "dismissed"),
        // DATETIME redondea al segundo: 1 s de margen para no contar denuncias de antes de la reanudación.
        ...(resumedAt ? [gt(reports.createdAt, new Date(resumedAt.getTime() + 1000))] : []),
      ),
    );
  if (Number(n) < AUTO_PAUSE_THRESHOLD) return "not_needed";
  if (resumedAt && now.getTime() - resumedAt.getTime() < AUTO_PAUSE_COOLDOWN_DAYS * DAY_MS) return "cooldown";
  try {
    await transition({ listingId, action: "pause", actor: { kind: "system", job: REPORTS_AUTO_PAUSE_JOB }, now });
    return "paused";
  } catch (error) {
    if (error instanceof TransitionError && error.code === "invalid_state") return "not_needed"; // ya no está publicada
    if (error instanceof TransitionForbiddenError) {
      // No debería pasar: la matriz le da `pause` al sistema (DATABASE_SCHEMA.md §3).
      console.error(
        JSON.stringify({ level: "warn", msg: "reportes: pausa automática bloqueada por la matriz de permisos", listingId }),
      );
      return "blocked";
    }
    throw error;
  }
}

export async function submitReport(input: ReportInput): Promise<ReportResult> {
  const now = input.now ?? new Date();
  // Honeypot: se responde como si hubiera salido bien, sin guardar nada.
  if (input.honeypot) return { ok: true, paused: false, autoPause: "not_needed" };
  if (!isReportReason(input.reason)) return { ok: false, status: 400, error: "Elegí un motivo.", field: "motivo" };
  const reason: ReportReason = input.reason;

  const detail = (input.detail ?? "").trim().slice(0, 2000) || null;
  if (reason === "otro" && !detail) {
    return { ok: false, status: 400, error: "Contanos brevemente qué pasa.", field: "detalle" };
  }
  let phone: string | null = null;
  if (input.phone && input.phone.trim()) {
    try {
      phone = normalizePhone(input.phone, { allowLandline: true });
    } catch {
      return { ok: false, status: 400, error: "El teléfono no es válido. Formato: 0981 123 456 (es opcional).", field: "telefono" };
    }
  }

  const ref = parsePublicRef(input.ref);
  if (!ref) return { ok: false, status: 404, error: "No encontramos esta publicación." };
  const [listing] = await db
    .select({ id: listings.id, status: listings.status })
    .from(listings)
    .where(and(eq(listings.publicRef, ref), isNull(listings.deletedAt)))
    .limit(1);
  // Sólo lo que el público puede ver (publicada, vendida, vencida).
  if (!listing || !["published", "sold", "expired"].includes(listing.status)) {
    return { ok: false, status: 404, error: "No encontramos esta publicación." };
  }

  const ipHash = input.ip && input.salt ? hashWithSalt(input.ip, input.salt) : null;
  if (ipHash) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(reports)
      .where(and(eq(reports.reporterIpHash, ipHash), gte(reports.createdAt, new Date(now.getTime() - DAY_MS))));
    if (n >= REPORTS_PER_IP_PER_DAY) return { ok: false, status: 429, error: "Ya enviaste varias denuncias hoy. Probá mañana." };
  } else if (!memoryLimiter.check(`report|${input.ip ?? "sin-ip"}`).allowed) {
    return { ok: false, status: 429, error: "Ya enviaste varias denuncias hoy. Probá mañana." };
  }

  // Silenciada: se guarda ya descartada (queda a la vista del moderador), no
  // cuenta para la pausa y la respuesta es la misma que siempre.
  const muted = ipHash ? await isMutedReporter(ipHash, now) : false;
  await db.insert(reports).values({
    listingId: listing.id,
    reasonCode: reason,
    detail,
    reporterPhoneE164: phone,
    reporterIpHash: ipHash,
    createdAt: now,
    ...(muted && { status: "dismissed" as const, resolvedAt: now, resolutionNote: MUTED_REPORT_NOTE }),
  });
  if (muted) return { ok: true, paused: false, autoPause: "not_needed" };

  const autoPause =
    AUTO_PAUSE_REASONS.includes(reason) && listing.status === "published" ? await applyAutoPause(listing.id, now) : "not_needed";
  return { ok: true, paused: autoPause === "paused", autoPause };
}

/** Sólo pruebas. */
export function resetReportLimiterForTests(): void {
  memoryLimiter.reset();
}
