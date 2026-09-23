// GET /ir/wa/* (T-105, ADR-07, INTEGRATIONS.md §1.1). Sin render ni cliente:
// resolver → registrar `whatsapp_click` → 302 a wa.me. Si el registro falla,
// igual se redirige (perder un evento es aceptable; perder un contacto, no).
// `recordListingEvent` ya suma `whatsapp_click_count` para personas: acá no se
// vuelve a sumar (docs/log/A2.md).
//
//   /ir/wa/<listingId>            publicación publicada con WhatsApp
//   /ir/wa/comercio/<dealerId>    comercio activo
//   /ir/wa/general[?texto=…]      número del sitio (ADR-21)
import "server-only";

import { recordListingEvent } from "@/lib/events";
import { dealerWhatsAppTarget, generalWhatsAppTarget, listingWhatsAppTarget, type WhatsAppTarget } from "./contact";
import { NO_STORE_HEADERS, ownRefererPath } from "./http";
import { leadLog } from "./log";

function parseId(segment: string | undefined): number | null {
  if (!segment || !/^[1-9]\d{0,15}$/.test(segment)) return null;
  const n = Number(segment);
  return Number.isSafeInteger(n) ? n : null;
}

async function resolveTarget(segments: readonly string[], url: URL): Promise<WhatsAppTarget | null> {
  if (segments.length === 1 && segments[0] === "general") {
    const target = generalWhatsAppTarget(url.searchParams.get("texto"));
    if (!target) leadLog("error", "wa: WHATSAPP_SITE_NUMBER sin definir o no es un celular; /ir/wa/general da 404", {});
    return target;
  }
  if (segments.length === 2 && segments[0] === "comercio") {
    const id = parseId(segments[1]);
    return id === null ? null : dealerWhatsAppTarget(id);
  }
  if (segments.length === 1) {
    const id = parseId(segments[0]);
    return id === null ? null : listingWhatsAppTarget(id);
  }
  return null;
}

function notFound(): Response {
  return new Response("No encontramos este contacto. Puede que la publicación ya no esté disponible.", {
    status: 404,
    headers: { ...NO_STORE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function handleWhatsAppRedirect(segments: readonly string[], request: Request): Promise<Response> {
  let target: WhatsAppTarget | null;
  try {
    target = await resolveTarget(segments, new URL(request.url));
  } catch (error) {
    leadLog("error", "wa: no se pudo resolver el destino", {
      path: segments.join("/").slice(0, 100),
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("No pudimos abrir WhatsApp. Probá de nuevo en un momento.", {
      status: 503,
      headers: { ...NO_STORE_HEADERS, "Content-Type": "text/plain; charset=utf-8", "Retry-After": "30" },
    });
  }
  if (!target) return notFound();

  // Nunca lanza (events.ts); igual se protege: el 302 sale pase lo que pase.
  try {
    await recordListingEvent({
      type: "whatsapp_click",
      listingId: target.listingId,
      dealerId: target.dealerId,
      headers: request.headers,
      pagePath: ownRefererPath(request.headers),
    });
  } catch {
    // ya logueado por events.ts
  }

  return new Response(null, { status: 302, headers: { ...NO_STORE_HEADERS, Location: target.location } });
}
