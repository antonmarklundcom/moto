import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FinancingCompare } from "@/components/financing-compare/financing-compare";
import { ListingGrid } from "@/components/financing-compare/listing-grid";
import { loadEnCuotasPage } from "@/components/financing-compare/model-data";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/public/json-ld";
import { container, focusRing, linkClass, primaryButton } from "@/components/public/styles";
import { env } from "@/lib/env";
import { groupThousands } from "@/lib/format";
import { collectionPageJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata, withPageSuffix } from "@/lib/seo/meta";
import { absoluteUrl, paths } from "@/lib/seo/routes";

// /motos/en-cuotas (PRODUCT_SPEC §3.5, ADR-20): la página comercial clave.
// Sin texto editorial propio todavía (decisión pendiente, docs/decisions-needed.md A2) → noindex por regla.
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function data({ searchParams }: Props) {
  const sp = await searchParams;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string]))),
  ).toString();
  return loadEnCuotasPage(query);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await data(props);
  if (d.status !== "ok") return {};
  return pageMetadata({
    // §9, literal.
    title: withPageSuffix("Motos en cuotas en Paraguay — entrega y cuota mensual", d.seo.page),
    description: "Motos en cuotas en Paraguay: compará la entrega y la cuota mensual que informa cada comercio. Precios en guaraníes y contacto por WhatsApp.",
    canonical: d.seo.canonical,
    robots: d.seo.robots,
  });
}

const field = `min-h-11 w-full rounded border border-neutral-500 bg-white px-3 ${focusRing}`;

export default async function Page(props: Props) {
  const d = await data(props);
  if (d.status !== "ok") notFound();
  const siteUrl = env.siteUrl();
  const f = d.parsed.filters;
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Motos", href: paths.motos }, { name: "En cuotas", href: paths.enCuotas }]} />
      <JsonLd
        data={collectionPageJsonLd({
          url: absoluteUrl(d.seo.canonical, siteUrl),
          name: "Motos en cuotas en Paraguay",
          itemUrls: d.search.items.map((l) => absoluteUrl(paths.listing(l), siteUrl)),
          firstPosition: (d.search.page - 1) * d.search.perPage + 1,
        })}
      />
      <h1 className="mt-2 text-2xl font-bold">Motos en cuotas en Paraguay</h1>
      <p className="mt-2 max-w-prose">
        Los comercios suelen pedir una entrega y financiar el resto en cuotas. Acá ves la entrega y la cuota que informa cada comercio en su
        publicación: nosotros no las calculamos ni aprobamos créditos.
      </p>
      <p className="mt-1">
        <strong>{d.search.total === 1 ? "1 moto" : `${groupThousands(d.search.total)} motos`}</strong> con cuotas informadas
        {d.parsed.hasFilterParams ? " con estos filtros" : ""}.
      </p>

      <form method="get" action={paths.enCuotas} className="mt-4 grid max-w-2xl grid-cols-2 items-end gap-3 rounded-lg border border-neutral-300 bg-neutral-50 p-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Cuota máxima (Gs.)
          <input name="cuota_max" inputMode="numeric" defaultValue={f.installmentMax ?? ""} placeholder="500.000" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Entrega máxima (Gs.)
          <input name="entrega_max" inputMode="numeric" defaultValue={f.downPaymentMax ?? ""} placeholder="1.500.000" className={field} />
        </label>
        <button type="submit" className={primaryButton}>
          Ver motos
        </button>
      </form>

      {d.comparisons.length && d.seo.page === 1 && !d.parsed.hasFilterParams ? (
        <section aria-labelledby="comparar" className="mt-6 flex flex-col gap-4">
          <h2 id="comparar" className="text-xl font-semibold">
            El mismo modelo en distintos comercios
          </h2>
          {d.comparisons.map((c) => (
            <div key={c.model.slug}>
              <h3 className="font-semibold">
                <Link href={paths.model(c.brand.slug, c.model.slug)} className={linkClass}>
                  {c.brand.name} {c.model.name}
                </Link>
              </h3>
              <FinancingCompare offers={c.offers} modelName={`${c.brand.name} ${c.model.name}`} headingLevel={3} />
            </div>
          ))}
        </section>
      ) : null}

      <ListingGrid search={d.search} page={d.seo.page} prevHref={d.seo.prevHref} nextHref={d.seo.nextHref} searchText="una moto en cuotas" />
      <p className="mt-6">
        <Link href={paths.financing} className={linkClass}>
          ¿Querés que te ayudemos a financiarla?
        </Link>
      </p>
    </div>
  );
}
