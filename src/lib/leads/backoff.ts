// Calendario de reintentos al CRM (INTEGRATIONS.md §2.8). Puro.

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
