import type { Metadata } from "next";
import { env, globalIndexingAllows } from "@/lib/env";
import "./globals.css";

// Indexación global (ADR-26, CLAUDE.md §3.4). Por defecto toda página hereda
// `noindex` salvo que SITE_NOINDEX=false; con SITE_NOINDEX=content, las guías y
// páginas estáticas lo sobrescriben en su propia metadata usando
// globalIndexingAllows("content"). Falla cerrado: sin la variable, noindex.
//
// Ojo: en páginas prerenderadas el valor se fija en el build. Cambiar
// SITE_NOINDEX en el panel exige un rebuild (DEPLOY.md).
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(env.siteUrl()),
    title: "moto.com.py",
    // F-4: neutral. El sitio no otorga crédito (LEGAL_AND_COMPLIANCE.md §3.1).
    description:
      "Motos nuevas y usadas en Paraguay, con precios en guaraníes y cuotas informadas por cada comercio.",
    ...(globalIndexingAllows("inventory") ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-PY">
      <body className="antialiased">{children}</body>
    </html>
  );
}
