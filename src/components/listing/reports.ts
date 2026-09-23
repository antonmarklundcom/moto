// Denuncias (T-118 lado público, TRUST_AND_SAFETY.md §5). Sin registro,
// teléfono opcional, 5 por IP por día; 3 denuncias independientes (IP
// distintas) de `estafa`/`robada` pausan la publicación por la máquina de
// estados con actor sistema. Nunca se revela quién denunció.
import "server-only";

import { and, count, countDistinct, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { listings, reports } from "@/db/schema";
import { hashWithSalt } from "@/lib/hash";
import { normalizePhone } from "@/lib/phone";
import { RateLimiter } from "@/lib/rate-limit";
import { parsePublicRef } from "@/lib/slug";
import { TransitionError, TransitionForbiddenError, transition } from "@/lib/listings/state";
import { AUTO_PAUSE_REASONS, AUTO_PAUSE_THRESHOLD, isReportReason, REPORTS_PER_IP_PER_DAY, type ReportReason } from "./rules";

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
  | { ok: true; paused: boolean; autoPause: "not_needed" | "paused" | "blocked" }
  | { ok: false; status: 400 | 404 | 429; error: string; field?: string };

export type AutoPauseOutcome = "not_needed" | "paused" | "blocked";

/** Cuenta denuncias independientes de estafa/robada y, al llegar a 3, intenta pausar. */
export async function applyAutoPause(listingId: number): Promise<AutoPauseOutcome> {
  const [{ n }] = await db
    .select({ n: countDistinct(reports.reporterIpHash) })
    .from(reports)
    .where(
      and(
        eq(reports.listingId, listingId),
        inArray(reports.reasonCode, [...AUTO_PAUSE_REASONS]),
        ne(reports.status, "dismissed"),
      ),
    );
  if (Number(n) < AUTO_PAUSE_THRESHOLD) return "not_needed";
  try {
    await transition({ listingId, action: "pause", actor: { kind: "system", job: "reports_auto_pause" } });
    return "paused";
  } catch (error) {
    if (error instanceof TransitionError && error.code === "invalid_state") return "not_needed"; // ya no está publicada
    if (error instanceof TransitionForbiddenError) {
      // La matriz de DATABASE_SCHEMA.md §3 no le da `pause` al sistema:
      // decisión del propietario pendiente (docs/decisions-needed.md, B3).
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

  await db.insert(reports).values({
    listingId: listing.id,
    reasonCode: reason,
    detail,
    reporterPhoneE164: phone,
    reporterIpHash: ipHash,
    createdAt: now,
  });

  const autoPause = AUTO_PAUSE_REASONS.includes(reason) && listing.status === "published" ? await applyAutoPause(listing.id) : "not_needed";
  return { ok: true, paused: autoPause === "paused", autoPause };
}

/** Sólo pruebas. */
export function resetReportLimiterForTests(): void {
  memoryLimiter.reset();
}
