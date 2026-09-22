import type { Metadata } from "next";
import { connection } from "next/server";
import { PublicShell } from "@/components/public/public-shell";
import { SITE_NAME } from "@/lib/seo/site";

// Las páginas pasan su título sin sufijo; la plantilla agrega " | moto.com.py" (§9).
// Falla cerrado (CLAUDE.md §3.4): una página pública que no declare su propio
// `robots` (vía pageMetadata/contentPageMetadata de src/lib/seo/meta.ts) queda
// `noindex, follow` en cualquier modo de SITE_NOINDEX.
export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  robots: { index: false, follow: true },
};

// Todo lo público se renderiza por request (decisión A2, docs/log/A2.md):
// SITE_NOINDEX se lee al servir, no al compilar, así que cambiar el modo en
// hPanel sólo exige reiniciar la app, no un rebuild. Las páginas de
// inventario igual consultan la base en cada request.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return <PublicShell>{children}</PublicShell>;
}
