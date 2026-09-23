import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container } from "@/components/public/styles";
import { PublishForm } from "@/components/publish/publish-form";
import { publishCatalog } from "@/components/publish/submit";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";
import { publishAction } from "./actions";

// /publicar (T-107, PRODUCT_SPEC §2.2): sin cuenta, gratis, 5 pasos.
export function generateMetadata(): Metadata {
  return contentPageMetadata({
    title: "Publicá tu moto gratis",
    description: "Publicá tu moto gratis en moto.com.py, sin registrarte: subí las fotos, poné el precio y los compradores te escriben por WhatsApp. La revisamos en menos de 24 h.",
    canonical: paths.publish,
  });
}

export default async function Page() {
  const catalog = await publishCatalog();
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Publicar", href: paths.publish }]} />
      <h1 className="mt-2 text-2xl font-bold">Publicá tu moto gratis</h1>
      <p className="mt-1 max-w-prose">Sin registrarte. La revisamos en menos de 24 h y te mandamos por WhatsApp el enlace para gestionarla.</p>
      <div className="mt-4">
        <PublishForm catalog={catalog} action={publishAction} />
      </div>
    </div>
  );
}
