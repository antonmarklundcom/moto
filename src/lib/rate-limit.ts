// Límite de frecuencia en memoria (ventana deslizante por clave), para frenar
// ráfagas en formularios públicos y en el login antes de tocar la base.
//
// Un solo proceso Node en el slot de Hostinger (ADR-04, sin Redis): la memoria
// del proceso alcanza. Se pierde al reiniciar, por eso el bloqueo de login que
// importa es el persistente de `auth_attempts` (src/lib/auth/lockout.ts); éste
// es la primera barrera, barata.

import { isIP } from "node:net";

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
 * Saltos de proxy de confianza delante de la app (`TRUSTED_PROXY_HOPS`,
 * por defecto 1: el proxy de Hostinger; 2 si se agrega Cloudflare delante).
 */
export function trustedProxyHops(raw: string | undefined = process.env.TRUSTED_PROXY_HOPS): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1;
}

/**
 * IP del cliente detrás del proxy. `X-Forwarded-For` lo escribe el cliente y
 * cada proxy **agrega** al final: el primer valor es inventable (el revisor
 * de seguridad lo usó para saltar todos los topes por IP). Se toma el valor
 * que agregó el proxy de confianza más lejano: el N-ésimo desde la derecha,
 * con N = `TRUSTED_PROXY_HOPS`. Si no es una IP válida, `X-Real-IP` (que el
 * proxy pisa); si tampoco, `null`. Sólo se usa hasheada o como clave de
 * memoria, nunca se guarda en claro.
 * `[VERIFICAR: en producción, que el proxy de Hostinger agregue (no pise) X-Forwarded-For; probar con curl -H "X-Forwarded-For: 1.2.3.4" y mirar la IP del log]`
 */
export function clientIp(headers: Pick<Headers, "get">, hops = trustedProxyHops()): string | null {
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (chain.length) {
    const candidate = chain[Math.max(0, chain.length - hops)].slice(0, 64);
    if (isIP(candidate)) return candidate;
  }
  const real = headers.get("x-real-ip")?.trim().slice(0, 64);
  return real && isIP(real) ? real : null;
}
