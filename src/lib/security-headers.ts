// Cabeceras de seguridad (G-26). Las usa next.config.ts; viven acá para poder
// probarlas. C2 verifica que lleguen en producción.
//
// CSP sin nonce: Next.js inyecta scripts en línea para la hidratación, así que
// script-src necesita 'unsafe-inline' mientras no haya middleware con nonces
// (eso obligaría a renderizar todo dinámico). Lo que sí se cierra: orígenes
// externos (sólo VenderCRM, para vc-attribution.js, INTEGRATIONS.md §2.7),
// frames, <object>, base-uri y form-action.

export type SecurityHeaderOptions = {
  /** VENDERCRM_URL; su origen se permite en script-src y connect-src. */
  vendercrmUrl?: string | null;
  isDev?: boolean;
};

export function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ vendercrmUrl, isDev = false }: SecurityHeaderOptions = {}): string {
  const crm = originOf(vendercrmUrl);
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(crm ? [crm] : []), ...(isDev ? ["'unsafe-eval'"] : [])];
  const connectSrc = ["'self'", ...(crm ? [crm] : []), ...(isDev ? ["ws:"] : [])];
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions = {}): Array<{ key: string; value: string }> {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  if (!options.isDev) {
    // Sin `preload`: entrar a la lista de precarga es difícil de revertir y es
    // decisión del propietario cuando el dominio esté estable en HTTPS.
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
