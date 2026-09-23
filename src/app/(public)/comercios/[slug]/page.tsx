import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dealerBySlug, VERIFIED_EXPLANATION } from "@/components/lead-forms/dealers";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { EmptyState } from "@/components/public/empty-state";
import { JsonLd } from "@/components/public/json-ld";
import { ListingCard } from "@/components/public/listing-card";
import { Pagination } from "@/components/public/pagination";
import { container, primaryButton } from "@/components/public/styles";
import { env } from "@/lib/env";
import { groupThousands } from "@/lib/format";
import { parseSearchParams } from "@/lib/listings/filters";
import { countLiveListings, searchListings } from "@/lib/listings/query";
import { isDealerPageIndexable } from "@/lib/seo/indexability";
import { autoDealerJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata, resolveListingPageSeo, withPageSuffix } from "@/lib/seo/meta";
import { absoluteUrl, paths } from "@/lib/seo/routes";
import { isReservedSlug } from "@/lib/slug";

// /comercios/:slug (PRODUCT_SPEC §3.4). Sin logo (ADR-12: no se muestra sin
// autorización escrita) y sin teléfono en texto: el contacto va por /ir/wa.
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function data({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || isReservedSlug(slug)) return null;
  const dealer = await dealerBySlug(slug);
  if (!dealer) return null;
  const sp = await searchParams;
  const parsed = parseSearchParams(
    new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string])))),
  );
  if (parsed.page === null) return null;
  const [live, search] = await Promise.all([
    countLiveListings({ dealerId: dealer.id }),
    searchListings({ filters: { dealerId: dealer.id, ...parsed.filters }, sort: parsed.sort, page: parsed.page }),
  ]);
  const basePath = paths.dealer(dealer.slug);
  const seo = resolveListingPageSeo({ basePath, parsed, baseIndexable: isDealerPageIndexable(dealer.status, live), pageCount: search.pageCount });
  if (seo.status === "not_found") return null;
  return { dealer, live, search, seo, basePath };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await data(props);
  if (!d) return {};
  return pageMetadata({
    title: withPageSuffix(`${d.dealer.name}: motos en ${d.dealer.cityName}`, d.seo.page),
    description: `Motos de ${d.dealer.name} en ${d.dealer.cityName}: precios en guaraníes, entrega y cuotas informadas por el comercio, y contacto directo por WhatsApp.`,
    canonical: d.seo.canonical,
    robots: d.seo.robots,
  });
}

export default async function Page(props: Props) {
  const d = await data(props);
  if (!d) notFound();
  const { dealer, search, seo } = d;
  const siteUrl = env.siteUrl();
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Comercios", href: paths.dealers }, { name: dealer.name, href: d.basePath }]} />
      <JsonLd
        data={autoDealerJsonLd({
          url: absoluteUrl(d.basePath, siteUrl),
          name: dealer.name,
          description: dealer.description,
          streetAddress: dealer.address,
          cityName: dealer.cityName,
          department: dealer.department,
        })}
      />
      <h1 className="mt-2 text-2xl font-bold">{dealer.name}</h1>
      <p className="mt-1 text-neutral-800">
        {dealer.address ? `${dealer.address}, ` : ""}
        {dealer.cityName} · {d.live === 1 ? "1 moto publicada" : `${groupThousands(d.live)} motos publicadas`}
      </p>
      {dealer.isVerified ? (
        <p className="mt-2 rounded border border-blue-800 bg-blue-50 p-2 text-sm text-blue-950">
          <strong>Comercio verificado.</strong> {VERIFIED_EXPLANATION}
        </p>
      ) : null}
      {dealer.description ? <p className="mt-3 max-w-prose whitespace-pre-line">{dealer.description}</p> : null}
      <p className="mt-4">
        <a href={paths.whatsappDealer(dealer.id)} rel="nofollow" className={primaryButton}>
          Escribir por WhatsApp
        </a>
      </p>
      <section aria-labelledby="stock" className="mt-8">
        <h2 id="stock" className="text-lg font-semibold">
          Motos de {dealer.name}
        </h2>
        {search.items.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {search.items.map((l) => (
              <li key={l.id} className="flex">
                <ListingCard listing={l} headingLevel={3} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <EmptyState title="Este comercio no tiene motos publicadas ahora." searchText={`una moto de ${dealer.name}`} headingLevel={3} showPublish={false} />
          </div>
        )}
        <Pagination page={seo.page} pageCount={search.pageCount} prevHref={seo.prevHref} nextHref={seo.nextHref} />
      </section>
    </div>
  );
}
