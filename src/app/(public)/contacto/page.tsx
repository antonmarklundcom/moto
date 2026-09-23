import type { Metadata } from "next";
import { errorsFromQuery } from "@/components/lead-forms/errors";
import { LeadForm } from "@/components/lead-forms/lead-form";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container, linkClass, primaryButton } from "@/components/public/styles";
import { THANKS_PATH } from "@/lib/leads/handler";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// /contacto: consultas generales por WhatsApp (el tipo `general` no va al CRM,
// ADR-08) y el formulario de publicidad (`advertising`, sí va).
export function generateMetadata(): Metadata {
  return contentPageMetadata({
    title: "Contacto",
    description: "Escribinos por WhatsApp por cualquier consulta sobre moto.com.py, o dejanos tus datos si querés anunciar tu empresa en el sitio.",
    canonical: paths.contact,
  });
}

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Contacto", href: paths.contact }]} />
      <h1 className="mt-2 text-2xl font-bold">Contacto</h1>
      <section aria-labelledby="whatsapp" className="mt-4">
        <h2 id="whatsapp" className="text-lg font-semibold">
          ¿Tenés una consulta?
        </h2>
        <p className="mt-1">Escribinos por WhatsApp y te respondemos por ahí.</p>
        <p className="mt-3">
          <a href={paths.whatsappGeneral("Hola, tengo una consulta")} rel="nofollow" className={primaryButton}>
            Escribir por WhatsApp
          </a>
        </p>
        <p className="mt-3 text-sm">
          ¿Vendés motos? Mirá cómo publicar tu stock en{" "}
          <a href={paths.dealers} className={linkClass}>
            Comercios
          </a>
          .
        </p>
      </section>
      <section aria-labelledby="publicidad" className="mt-8">
        <h2 id="publicidad" className="text-lg font-semibold">
          Anunciá tu empresa
        </h2>
        <p className="mt-1 max-w-prose">Si tenés un taller, una casa de repuestos o una empresa que le sirve a quien anda en moto, dejanos tus datos.</p>
        <div className="mt-3">
          <LeadForm type="advertising" pagePath={paths.contact} notice={null} initialErrors={errorsFromQuery(q.error)} thanksPath={`${THANKS_PATH}?tipo=publicidad`} />
        </div>
      </section>
    </div>
  );
}
