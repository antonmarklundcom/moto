import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container, linkClass } from "@/components/public/styles";
import { pageMetadata, robots } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// Marcador de posición (LEGAL_AND_COMPLIANCE §10): ninguna sesión de
// implementación escribe texto legal. noindex hasta que el propietario lo reemplace.
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Términos y condiciones",
    description: "Términos y condiciones de moto.com.py. El texto está en revisión legal.",
    canonical: paths.terms,
    robots: robots(false),
  });
}

export default function Page() {
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Términos y condiciones", href: paths.terms }]} />
      <h1 className="mt-2 text-2xl font-bold">Términos y condiciones</h1>
      <p className="mt-3 max-w-prose">Texto en revisión legal. Lo publicamos apenas esté listo.</p>
      <p className="mt-2 max-w-prose">
        Si tenés una consulta mientras tanto,{" "}
        <Link href={paths.contact} className={linkClass}>
          escribinos
        </Link>
        .
      </p>
    </div>
  );
}
