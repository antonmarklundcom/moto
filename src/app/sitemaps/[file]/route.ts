// GET /sitemaps/<segmento>.xml — hijos del índice (SEO_ARCHITECTURE.md §7).
// Un segmento sin URLs indexables en el modo actual responde 404.
import { env } from "@/lib/env";
import { parseSegment, segmentEntries, urlsetXml } from "../_lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const segment = parseSegment((await params).file);
  if (!segment) return new Response("No existe este sitemap.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const entries = await segmentEntries(segment, env.siteUrl());
  if (!entries.length) return new Response("Este sitemap no tiene páginas indexables.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(urlsetXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
