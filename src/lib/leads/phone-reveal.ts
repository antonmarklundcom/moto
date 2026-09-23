// POST /api/telefono/<ref>: "Ver teléfono" / "Llamar" (PRODUCT_SPEC.md §2.1).
// El número nunca está en el HTML inicial de la ficha: se pide acá, se
// registra `phone_reveal` y se devuelve en formato visible. Limitado por IP
// para que no sirva para cosechar números.
import "server-only";

import { recordListingEvent } from "@/lib/events";
import { formatPhoneDisplay } from "@/lib/phone";
import { clientIp, RateLimiter } from "@/lib/rate-limit";
import { parsePublicRef } from "@/lib/slug";
import { listingPhone } from "./contact";
import { jsonResponse, ownRefererPath, sameOriginOrAbsent } from "./http";
import { leadLog } from "./log";

export const PHONE_REVEAL_LIMIT = 20;
export const PHONE_REVEAL_WINDOW_MS = 10 * 60 * 1000;
const limiter = new RateLimiter(PHONE_REVEAL_LIMIT, PHONE_REVEAL_WINDOW_MS);

export async function handlePhoneReveal(refParam: string, request: Request): Promise<Response> {
  if (!sameOriginOrAbsent(request.headers)) return jsonResponse(403, { error: "Solicitud no válida." });

  const ip = clientIp(request.headers) ?? "sin-ip";
  const limit = limiter.check(`tel|${ip}`);
  if (!limit.allowed) {
    return jsonResponse(
      429,
      { error: "Pediste muchos teléfonos seguidos. Esperá unos minutos y probá de nuevo." },
      { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
    );
  }

  const ref = parsePublicRef(refParam);
  if (!ref) return jsonResponse(404, { error: "No encontramos esta publicación." });

  let row;
  try {
    row = await listingPhone(ref);
  } catch (error) {
    leadLog("error", "telefono: no se pudo leer la publicación", { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(503, { error: "No pudimos mostrar el teléfono. Probá de nuevo en un momento." });
  }
  if (!row) return jsonResponse(404, { error: "No encontramos esta publicación." });

  await recordListingEvent({
    type: "phone_reveal",
    listingId: row.id,
    dealerId: row.dealerId,
    headers: request.headers,
    pagePath: ownRefererPath(request.headers),
  });

  return jsonResponse(200, { telefono: formatPhoneDisplay(row.phone), href: `tel:${row.phone}` });
}

/** Sólo pruebas. */
export function resetPhoneRevealLimitForTests(): void {
  limiter.reset();
}
