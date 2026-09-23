import type { Metadata } from "next";
import Link from "next/link";
import { dealers as dealerCopy } from "@/components/lead-forms/copy";
import { activeDealers, VERIFIED_EXPLANATION } from "@/components/lead-forms/dealers";
import { errorsFromQuery } from "@/components/lead-forms/errors";
import { LeadForm } from "@/components/lead-forms/lead-form";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container, linkClass } from "@/components/public/styles";
import { groupThousands } from "@/lib/format";
import { readFormFlash } from "@/lib/leads/form-flash";
import { THANKS_PATH } from "@/lib/leads/handler";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// /comercios (PRODUCT_SPEC §3.4): sólo comercios reales y activos, con su
// conteo real de publicaciones vivas. Abajo, la consulta de comercios (`dealer_plan`).
export function generateMetadata(): Metadata {
  return contentPageMetadata({ title: dealerCopy.title, description: dealerCopy.description, canonical: paths.dealers });
}

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  // Sin JS, un error devuelve lo escrito en una cookie cifrada de 5 min (nunca en la URL).
  const returned = q.error ? await readFormFlash("dealer_plan") : {};
  const list = await activeDealers();
  const anyVerified = list.some((d) => d.isVerified);
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Comercios", href: paths.dealers }]} />
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Comercios de motos</h1>
      {list.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {list.map((d) => (
            <li key={d.id} className="rounded-lg border border-neutral-300 p-3">
              <Link href={paths.dealer(d.slug)} className={`${linkClass} text-lg font-semibold`}>
                {d.name}
              </Link>
              <p className="text-sm text-neutral-800">
                {d.city} · {d.live === 1 ? "1 moto publicada" : `${groupThousands(d.live)} motos publicadas`}
                {d.isVerified ? " · Comercio verificado" : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3">Todavía no hay comercios publicando. Estamos sumando los primeros.</p>
      )}
      {anyVerified ? <p className="mt-3 text-sm text-neutral-700">Comercio verificado: {VERIFIED_EXPLANATION}</p> : null}

      <section aria-labelledby="tu-comercio" className="mt-10 max-w-prose">
        <h2 id="tu-comercio" className="text-xl font-semibold">
          ¿Tenés un comercio de motos?
        </h2>
        <p className="mt-1">{dealerCopy.pitch}</p>
        <div className="mt-3">
          <LeadForm type="dealer_plan" pagePath={paths.dealers} notice={null} defaults={returned} initialErrors={errorsFromQuery(q.error)} thanksPath={`${THANKS_PATH}?tipo=plan_comercio`} />
        </div>
      </section>
    </div>
  );
}
