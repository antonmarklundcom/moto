// GET /robots.txt (SEO_ARCHITECTURE.md §3.4); contenido en ./robots.ts.
import { env } from "@/lib/env";
import { robotsTxt } from "./robots";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(robotsTxt(env.siteUrl()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
