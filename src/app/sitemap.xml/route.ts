// GET /sitemap.xml — índice de sitemaps (SEO_ARCHITECTURE.md §7). Con
// SITE_NOINDEX=true queda vacío (ningún hijo tiene URLs indexables).
import { env } from "@/lib/env";
import { indexChildren, sitemapIndexXml } from "../sitemaps/_lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const children = await indexChildren(env.siteUrl());
  return new Response(sitemapIndexXml(children), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
