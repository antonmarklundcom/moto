// Cada cuánto corre cada job del programador interno (ADR-19). Puro: lo
// comparten el programador y sus pruebas. Un job que no está acá no corre solo.
export const JOB_EVERY_MS: Readonly<Record<string, number>> = {
  "retry-leads": 5 * 60_000,
  "expire-listings": 60 * 60_000,
  "expire-featured": 60 * 60_000,
  "purge-uploads": 6 * 60 * 60_000,
  "purge-auth-attempts": 24 * 60 * 60_000,
  "purge-removed-photos": 24 * 60 * 60_000,
};

/** Primer disparo escalonado (1 min + 20 s por job) para no arrancar todo junto con el servidor. */
export function firstDelayMs(index: number): number {
  return 60_000 + index * 20_000;
}

/** ¿Programador interno encendido? Sólo en producción y salvo `INTERNAL_CRON=false`. */
export function internalCronEnabled(env: Record<string, string | undefined>): boolean {
  if (env.NODE_ENV !== "production") return false;
  return (env.INTERNAL_CRON ?? "").trim().toLowerCase() !== "false";
}

/** ¿Preparación automática al arrancar? Salvo `AUTO_SETUP=false`. */
export function autoSetupEnabled(env: Record<string, string | undefined>): boolean {
  return (env.AUTO_SETUP ?? "").trim().toLowerCase() !== "false";
}
