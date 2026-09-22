import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container, linkClass } from "@/components/public/styles";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// Placeholder de A2: prueba el shell público (un h1, canonical, robots de
// contenido según SITE_NOINDEX). B10 lo reemplaza con el contenido real.
export function generateMetadata(): Metadata {
  return contentPageMetadata({
    title: "Cómo funciona",
    description:
      "Cómo buscar motos nuevas y usadas en Paraguay, ver precios en guaraníes y cuotas informadas por cada comercio, y escribir al vendedor por WhatsApp.",
    canonical: paths.howItWorks,
  });
}

export default function ComoFuncionaPage() {
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Cómo funciona", href: paths.howItWorks }]} />
      <h1 className="mt-2 text-2xl font-bold">Cómo funciona</h1>
      <p className="mt-3 max-w-prose">
        Estamos preparando esta página. Mientras tanto, podés ver las{" "}
        <Link href={paths.motos} className={linkClass}>
          motos publicadas
        </Link>
        .
      </p>
    </div>
  );
}
