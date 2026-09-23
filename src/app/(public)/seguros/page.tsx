import type { Metadata } from "next";
import { errorsFromQuery } from "@/components/lead-forms/errors";
import { LeadForm } from "@/components/lead-forms/lead-form";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container } from "@/components/public/styles";
import { LEAD_NOTICE } from "@/lib/leads/consent";
import { THANKS_PATH } from "@/lib/leads/handler";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// /seguros (tipo `insurance`). Sin aviso propio en la especificación todavía
// (LEAD_NOTICE.insurance = null, [VERIFICAR con el abogado], LEGAL §3).
export function generateMetadata(): Metadata {
  return contentPageMetadata({
    title: "Seguro para tu moto",
    description:
      "Dejanos tus datos y los de tu moto y te derivamos con una aseguradora para que te cotice. No vendemos seguros ni fijamos precios: te ponemos en contacto.",
    canonical: paths.insurance,
  });
}

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Seguros", href: paths.insurance }]} />
      <h1 className="mt-2 text-2xl font-bold">Seguro para tu moto</h1>
      <p className="mt-2 max-w-prose">
        Contanos qué moto tenés y te derivamos con una aseguradora para que te cotice. Nosotros no vendemos seguros ni fijamos precios: te ponemos
        en contacto.
      </p>
      <div className="mt-4">
        <LeadForm
          type="insurance"
          pagePath={paths.insurance}
          notice={LEAD_NOTICE.insurance?.text ?? null}
          initialErrors={errorsFromQuery(q.error)}
          thanksPath={`${THANKS_PATH}?tipo=seguro`}
        />
      </div>
    </div>
  );
}
