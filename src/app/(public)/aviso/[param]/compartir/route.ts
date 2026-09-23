// GET /aviso/<slug>-<ref>/compartir — "Compartir por WhatsApp" (B3): registra
// el evento `share` y redirige a WhatsApp con el enlace de la ficha. Pasa por
// el servidor como todo CTA de WhatsApp (ADR-07); nunca se indexa.
import { loadListing } from "@/components/listing/data";
import { env } from "@/lib/env";
import { recordListingEvent } from "@/lib/events";
import { NO_STORE_HEADERS, ownRefererPath } from "@/lib/leads/http";
import { absoluteUrl, paths } from "@/lib/seo/routes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ param: string }> }): Promise<Response> {
  const d = await loadListing((await params).param);
  if (d.status !== "ok") return new Response("No encontramos esta publicación.", { status: 404, headers: NO_STORE_HEADERS });
  const url = absoluteUrl(paths.listing(d.listing), env.siteUrl());
  await recordListingEvent({
    type: "share",
    listingId: d.listing.id,
    dealerId: d.listing.dealer?.id ?? null,
    headers: request.headers,
    pagePath: ownRefererPath(request.headers),
  });
  const text = `Mirá esta moto en moto.com.py: ${d.listing.title} ${url}`;
  return new Response(null, {
    status: 302,
    headers: { ...NO_STORE_HEADERS, Location: `https://wa.me/?text=${encodeURIComponent(text)}` },
  });
}
