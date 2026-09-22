// Límite de frecuencia en memoria (ventana deslizante por clave), para frenar
// ráfagas en formularios públicos y en el login antes de tocar la base.
//
// Un solo proceso Node en el slot de Hostinger (ADR-04, sin Redis): la memoria
// del proceso alcanza. Se pierde al reiniciar, por eso el bloqueo de login que
// importa es el persistente de `auth_attempts` (src/lib/auth/lockout.ts); éste
// es la primera barrera, barata.

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    /** Tope de claves en memoria; al pasarlo se descartan las más viejas. */
    private readonly maxKeys = 10_000,
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterMs: recent[0] + this.windowMs - now };
    }
    recent.push(now);
    this.hits.delete(key); // reinsertar = mover al final (orden de uso)
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    return { allowed: true, remaining: this.limit - recent.length, retryAfterMs: 0 };
  }

  reset(key?: string): void {
    if (key === undefined) this.hits.clear();
    else this.hits.delete(key);
  }
}

/**
 * IP del cliente detrás del proxy de Hostinger: primer valor de
 * `X-Forwarded-For`, si no `X-Real-IP`. `null` si no hay ninguna. Sólo se usa
 * hasheada (hashWithSalt) o como clave de memoria, nunca se guarda en claro.
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : null;
}
