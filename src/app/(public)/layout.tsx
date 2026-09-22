import type { Metadata } from "next";
import { connection } from "next/server";
import { JsonLd } from "@/components/public/json-ld";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SkipLink } from "@/components/public/skip-link";
import { env } from "@/lib/env";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";
import { SITE_NAME } from "@/lib/seo/site";


// Las páginas pasan su título sin sufijo; la plantilla agrega " | moto.com.py" (§9).
export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
};

// Todo lo público se renderiza por request (decisión A2, docs/log/A2.md):
// SITE_NOINDEX se lee al servir, no al compilar, así que cambiar el modo en
// hPanel sólo exige reiniciar la app, no un rebuild. Las páginas de
// inventario igual consultan la base en cada request.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const siteUrl = env.siteUrl();
  return (
    // Colores explícitos: el modo oscuro del sistema no rompe el contraste AA
    // mientras no exista el diseño final (ADR-15).
    <div className="flex min-h-dvh flex-col bg-white text-neutral-900">
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
