import { env } from "@/lib/env";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "./json-ld";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SkipLink } from "./skip-link";

/**
 * Esqueleto de toda página pública: salto al contenido, cabecera, `<main>`,
 * pie y el JSON-LD global (Organization + WebSite con SearchAction, §6).
 * Colores explícitos: el modo oscuro del sistema no rompe el contraste AA
 * mientras no exista el diseño final (ADR-15).
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const siteUrl = env.siteUrl();
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 antialiased">
      <SkipLink />
      <SiteHeader />
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      <JsonLd data={[organizationJsonLd(siteUrl), webSiteJsonLd(siteUrl)]} />
    </div>
  );
}
