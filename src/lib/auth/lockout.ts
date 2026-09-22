// Bloqueo por fuerza bruta (ADMIN_SPEC.md §1, DATABASE_SCHEMA.md §2.16):
// 5 fallos por IP o por cuenta dentro de la ventana → bloqueado hasta que el
// quinto fallo salga de la ventana. Persistente entre reinicios, sin Redis.
//
// Ni el email ni la IP se guardan en claro: HMAC con IP_HASH_SALT (hashWithSalt).
import { and, count, eq, gt, max } from "drizzle-orm";
import { db } from "@/db";
import { authAttempts } from "@/db/schema";
import { hashWithSalt } from "@/lib/hash";
import { normalizeEmail } from "./users";

export const LOCKOUT_MAX_FAILURES = 5;
/** Ventana de 15 minutos: corta para no dejar afuera al dueño, larga para frenar un diccionario. */
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export type AttemptKeys = { emailHash: string | null; ipHash: string | null };

export function attemptKeys(email: string, ip: string | null, salt: string): AttemptKeys {
  const normalized = normalizeEmail(email);
  return {
    emailHash: normalized ? hashWithSalt(`email:${normalized}`, salt) : null,
    ipHash: ip ? hashWithSalt(ip, salt) : null,
  };
}

/**
 * Fallos recientes de una clave: dentro de la ventana y posteriores al último
 * éxito de esa misma clave (entrar bien limpia el contador).
 */
async function recentFailures(column: typeof authAttempts.emailHash | typeof authAttempts.ipHash, value: string, now: Date) {
  const windowStart = new Date(now.getTime() - LOCKOUT_WINDOW_MS);
  const [lastOk] = await db
    .select({ at: max(authAttempts.createdAt) })
    .from(authAttempts)
    .where(and(eq(column, value), eq(authAttempts.succeeded, true), gt(authAttempts.createdAt, windowStart)));
  const since = lastOk?.at && lastOk.at > windowStart ? lastOk.at : windowStart;
  const [row] = await db
    .select({ n: count() })
    .from(authAttempts)
    .where(and(eq(column, value), eq(authAttempts.succeeded, false), gt(authAttempts.createdAt, since)));
  return row?.n ?? 0;
}

export async function isLockedOut(keys: AttemptKeys, now = new Date()): Promise<boolean> {
  if (keys.emailHash && (await recentFailures(authAttempts.emailHash, keys.emailHash, now)) >= LOCKOUT_MAX_FAILURES) {
    return true;
  }
  if (keys.ipHash && (await recentFailures(authAttempts.ipHash, keys.ipHash, now)) >= LOCKOUT_MAX_FAILURES) {
    return true;
  }
  return false;
}

export async function recordAttempt(keys: AttemptKeys, succeeded: boolean, now = new Date()): Promise<void> {
  await db.insert(authAttempts).values({ emailHash: keys.emailHash, ipHash: keys.ipHash, succeeded, createdAt: now });
}
