// Utilidades HTTP compartidas por /api/leads, /ir/wa y /api/telefono.
import "server-only";

import { env } from "@/lib/env";
import { isOwnReferer } from "@/lib/events";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

/** Ruta (sin query) del Referer si es una página del sitio; si no, null. */
export function ownRefererPath(headers: Pick<Headers, "get">): string | null {
  const referer = headers.get("referer");
  if (!referer || !isOwnReferer(referer, env.siteUrl())) return null;
  try {
    return new URL(referer).pathname.slice(0, 500);
  } catch {
    return null;
  }
}

/**
 * `false` sólo si el POST trae un Origin de otro sitio. Sin Origin, o con
 * `Origin: null` (lo mandan algunos navegadores según la política de
 * referrer), se acepta: rechazar un lead real cuesta más que el spam, que ya
 * frenan el honeypot y el límite por IP.
 */
export function sameOriginOrAbsent(headers: Pick<Headers, "get">): boolean {
  const origin = headers.get("origin");
  if (!origin || origin === "null") return true;
  return isOwnReferer(origin, env.siteUrl());
}

export function jsonResponse(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE_HEADERS, ...extra } });
}

/** 303 a una ruta del sitio (URL absoluta con SITE_URL, no la del proxy). */
export function seeOther(path: string, setCookie?: string | null): Response {
  const headers = new Headers({ ...NO_STORE_HEADERS, Location: new URL(path, env.siteUrl()).toString() });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(null, { status: 303, headers });
}
