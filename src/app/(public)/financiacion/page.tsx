import type { Metadata } from "next";
import Link from "next/link";
import { errorsFromQuery } from "@/components/lead-forms/errors";
import { LeadForm } from "@/components/lead-forms/lead-form";
import { listingInterest } from "@/components/lead-forms/listing-interest";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container, linkClass } from "@/components/public/styles";
import { LEAD_NOTICE } from "@/lib/leads/consent";
import { THANKS_PATH } from "@/lib/leads/handler";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// /financiacion (PRODUCT_SPEC §2.3, §3.5; ADR-03): el flujo monetizable.
// El sitio deriva; nunca aprueba, promete ni calcula crédito (LEGAL §3.1).
export function generateMetadata(): Metadata {
  return contentPageMetadata({
    title: "Comprá tu moto en cuotas",
    description:
      "Contanos qué moto querés y cuánto podés dar de entrega: te orientamos y te derivamos con el comercio o la financiera. No otorgamos créditos ni pedimos tu cédula.",
    canonical: paths.financing,
  });
}

type Props = { searchParams: Promise<{ aviso?: string; error?: string }> };

export default async function Page({ searchParams }: Props) {
  const q = await searchParams;
  const interest = await listingInterest(q.aviso);
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Financiación", href: paths.financing }]} />
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Comprá tu moto en cuotas</h1>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="formulario" className="order-1 lg:order-2">
          <h2 id="formulario" className="text-xl font-bold tracking-tight text-slate-900">
            Pedí que te orientemos
          </h2>
          {interest ? (
            <p className="mt-1 text-sm">
              Consulta por: <strong>{interest.title}</strong>
            </p>
          ) : null}
          <div className="mt-3">
            <LeadForm
              type="financing"
              pagePath={paths.financing}
              notice={LEAD_NOTICE.financing!.text}
              listingRef={interest?.ref ?? null}
              defaults={interest ? { moto_interes: interest.title } : {}}
              initialErrors={errorsFromQuery(q.error)}
              thanksPath={`${THANKS_PATH}?tipo=financiacion`}
            />
          </div>
        </section>
        <section aria-labelledby="como" className="order-2 max-w-prose lg:order-1">
          <h2 id="como" className="text-xl font-bold tracking-tight text-slate-900">
            Cómo funciona comprar en cuotas
          </h2>
          <p className="mt-2">
            Los comercios suelen pedir una entrega y financiar el resto en cuotas. Algunos financian con su propio crédito y otros trabajan con una
            financiera. Cada uno pide sus requisitos y decide si aprueba.
          </p>
          <h3 className="mt-4 font-semibold">Qué hacemos nosotros</h3>
          <ul className="mt-1 ml-5 list-disc">
            <li>Te escuchamos: qué moto querés, cuánta entrega tenés y cómo cobrás.</li>
            <li>Te derivamos con el comercio o la financiera que puede atenderte.</li>
            <li>Te mostramos la entrega y la cuota que informa cada comercio en sus publicaciones.</li>
          </ul>
          <h3 className="mt-4 font-semibold">Qué no hacemos</h3>
          <ul className="mt-1 ml-5 list-disc">
            <li>No otorgamos créditos ni aprobamos solicitudes.</li>
            <li>No calculamos tu cuota ni prometemos una tasa.</li>
            <li>No te pedimos cédula, datos de tu cuenta ni pagos por adelantado. Si alguien te los pide en nuestro nombre, no es moto.com.py.</li>
          </ul>
          <p className="mt-4">
            <Link href={paths.enCuotas} className={linkClass}>
              Ver motos con entrega y cuotas informadas
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
