import Link from "next/link";
import { linkClass } from "@/components/public/styles";
import { formatGuaranies } from "@/lib/format";
import { paths } from "@/lib/seo/routes";
import type { OfferListing } from "./offers";

// Bloque de comparación de financiación (ADR-20, G-9). Sólo filas reales; con
// un comercio es una oferta única, nunca relleno. Cada monto es el que informó
// el comercio en su publicación: el sitio no calcula cuotas
// (LEGAL_AND_COMPLIANCE.md §3.1, CONTENT_STRATEGY.md §1.5).

const dash = "—";

function installments(o: OfferListing): string {
  return o.installmentGs && o.installmentCount ? `${o.installmentCount} × ${formatGuaranies(o.installmentGs)}` : dash;
}

function DealerName({ o }: { o: OfferListing }) {
  const name = o.dealer.active ? (
    <Link href={paths.dealer(o.dealer.slug)} className={linkClass}>
      {o.dealer.name}
    </Link>
  ) : (
    o.dealer.name
  );
  return (
    <>
      {name}
      {o.dealer.isVerified ? <span className="ml-1 text-xs text-blue-900">(verificado)</span> : null}
    </>
  );
}

export function FinancingCompare({ offers, modelName, headingLevel = 2 }: { offers: readonly OfferListing[]; modelName: string; headingLevel?: 2 | 3 }) {
  if (offers.length === 0) return null;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  if (offers.length === 1) {
    const o = offers[0];
    return (
      <section aria-label={`Oferta de ${modelName}`} className="rounded-lg border border-neutral-300 p-4">
        <Heading className="text-xl font-bold tracking-tight text-slate-900">Oferta de un comercio</Heading>
        <p className="mt-1 text-sm text-neutral-700">Por ahora un solo comercio publica la {modelName} con precio. Cuando haya más, las comparamos acá.</p>
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <dt className="text-neutral-700">Comercio</dt>
          <dd>
            <DealerName o={o} />
          </dd>
          <dt className="text-neutral-700">Contado</dt>
          <dd>{formatGuaranies(o.priceGs) ?? "No informado"}</dd>
          <dt className="text-neutral-700">Entrega</dt>
          <dd>{formatGuaranies(o.downPaymentGs) ?? dash}</dd>
          <dt className="text-neutral-700">Cuotas</dt>
          <dd>{installments(o)}</dd>
        </dl>
        <p className="mt-2 text-sm text-neutral-700">Informado por el comercio.</p>
        <Link href={paths.listing(o)} className={`${linkClass} mt-2 inline-flex min-h-11 items-center`}>
          Ver la publicación
        </Link>
      </section>
    );
  }
  return (
    <section aria-label={`Comparar ${modelName} entre comercios`} className="rounded-lg border border-neutral-300 p-4">
      <Heading className="text-xl font-bold tracking-tight text-slate-900">Comparar entre comercios</Heading>
      <p className="mt-1 text-sm text-neutral-700">
        {offers.length} comercios publican la {modelName}. Ordenado por cuota informada. Los montos los informa cada comercio: no los calculamos ni
        aprobamos créditos.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Precios y cuotas de la {modelName} por comercio</caption>
          <thead>
            <tr className="border-b border-neutral-400 text-left">
              <th scope="col" className="p-2">Comercio</th>
              <th scope="col" className="p-2">Contado</th>
              <th scope="col" className="p-2">Entrega</th>
              <th scope="col" className="p-2">Cuotas</th>
              <th scope="col" className="p-2">
                <span className="sr-only">Publicación</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.dealer.id} className="border-b border-neutral-200 align-top">
                <th scope="row" className="p-2 text-left font-normal">
                  <DealerName o={o} />
                  <span className="block text-xs text-neutral-700">
                    {o.condition === "new" ? "0 km" : `Usada${o.year ? ` ${o.year}` : ""}`} · informado por el comercio
                  </span>
                </th>
                <td className="p-2">{formatGuaranies(o.priceGs) ?? "No informado"}</td>
                <td className="p-2">{formatGuaranies(o.downPaymentGs) ?? dash}</td>
                <td className="p-2">{installments(o)}</td>
                <td className="p-2">
                  <Link href={paths.listing(o)} className={`${linkClass} inline-flex min-h-11 items-center`}>
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
