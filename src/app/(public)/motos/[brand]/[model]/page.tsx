import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FinancingCompare } from "@/components/financing-compare/financing-compare";
import { ListingGrid } from "@/components/financing-compare/listing-grid";
import { loadModelPage } from "@/components/financing-compare/model-data";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/public/json-ld";
import { container, linkClass } from "@/components/public/styles";
import { env } from "@/lib/env";
import { groupThousands } from "@/lib/format";
import { collectionPageJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata, withPageSuffix } from "@/lib/seo/meta";
import { absoluteUrl, classifyMotosPath, paths, withQuery } from "@/lib/seo/routes";

// Marca + modelo (T-106, ADR-20). Página B2.
type Props = { params: Promise<{ brand: string; model: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function data({ params, searchParams }: Props) {
  const { brand, model } = await params;
  const route = classifyMotosPath([brand, model]);
  if (!route || route.kind !== "model") return { status: "not_found" as const };
  const sp = await searchParams;
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string]))),
  ).toString();
  return loadModelPage(route.brand, route.model, query);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await data(props);
  if (d.status !== "ok") return {};
  const name = `${d.brand.name} ${d.model.name}`;
  return pageMetadata({
    // §9: `{Marca} {Modelo} en Paraguay — precios y unidades`.
    title: withPageSuffix(`${name} en Paraguay — precios y unidades`, d.seo.page),
    description: `${name} nuevas y usadas en Paraguay: precios en guaraníes, entrega y cuotas informadas por cada comercio, y contacto directo por WhatsApp.`,
    canonical: d.seo.canonical,
    robots: d.seo.robots,
    image: d.search.items[0]?.image ? { url: d.search.items[0].image.url, alt: d.search.items[0].image.alt ?? name } : null,
  });
}

export default async function Page(props: Props) {
  const d = await data(props);
  if (d.status !== "ok") notFound();
  const name = `${d.brand.name} ${d.model.name}`;
  const siteUrl = env.siteUrl();
  const total = d.search.total;
  return (
    <div className={container}>
      <Breadcrumbs
        items={[
          { name: "Motos", href: paths.motos },
          { name: d.brand.name, href: paths.brand(d.brand.slug) },
          { name: d.model.name, href: d.basePath },
        ]}
      />
      <JsonLd
        data={collectionPageJsonLd({
          url: absoluteUrl(d.seo.canonical, siteUrl),
          name: `${name} en Paraguay`,
          itemUrls: d.search.items.map((l) => absoluteUrl(paths.listing(l), siteUrl)),
          firstPosition: (d.search.page - 1) * d.search.perPage + 1,
        })}
      />
      <h1 className="mt-2 text-2xl font-bold">{name} en Paraguay</h1>
      <p className="mt-1">
        <strong>{total === 0 ? "Ninguna moto" : total === 1 ? "1 moto" : `${groupThousands(total)} motos`}</strong>
        {d.parsed.hasFilterParams ? " con estos filtros" : ""}.
        {d.priceRange && !d.parsed.hasFilterParams
          ? ` Precios de contado publicados: de ${d.priceRange.min} a ${d.priceRange.max} (${groupThousands(d.priceRange.n)} motos con precio).`
          : ""}
      </p>
      {d.model.introHtml && d.seo.page === 1 && !d.parsed.hasFilterParams ? (
        <div className="prose mt-3 max-w-prose" dangerouslySetInnerHTML={{ __html: d.model.introHtml }} />
      ) : null}
      {d.seo.page === 1 ? (
        <div className="mt-4">
          <FinancingCompare offers={d.offers} modelName={name} />
        </div>
      ) : null}
      <p className="mt-4">
        <Link href={withQuery(paths.motos, [["marca", d.brand.slug], ["modelo", d.model.slug]])} rel="nofollow" className={`${linkClass} inline-flex min-h-11 items-center`}>
          Filtrar la {name} por precio, cuota o ciudad
        </Link>
      </p>
      <ListingGrid search={d.search} page={d.seo.page} prevHref={d.seo.prevHref} nextHref={d.seo.nextHref} searchText={`una ${name}`} />
      {total === 0 && d.brandCount > 0 ? (
        <p className="mt-4">
          <Link href={paths.brand(d.brand.slug)} className={linkClass}>
            Ver las {groupThousands(d.brandCount)} motos {d.brand.name} publicadas
          </Link>
        </p>
      ) : null}
    </div>
  );
}
