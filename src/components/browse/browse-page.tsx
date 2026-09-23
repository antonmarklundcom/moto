import Link from "next/link";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { EmptyState } from "@/components/public/empty-state";
import { JsonLd } from "@/components/public/json-ld";
import { ListingCard } from "@/components/public/listing-card";
import { Pagination } from "@/components/public/pagination";
import { container, focusRing, linkClass } from "@/components/public/styles";
import { env } from "@/lib/env";
import { groupThousands } from "@/lib/format";
import { collectionPageJsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl, paths } from "@/lib/seo/routes";
import { resultsLabel } from "./copy";
import type { BrowseData, LinkItem } from "./data";
import { FilterForm } from "./filter-form";

type Ok = Extract<BrowseData, { status: "ok" }>;

function LinkList({ items }: { items: readonly LinkItem[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((i) => (
        <li key={i.href}>
          <Link href={i.href} className={`inline-flex min-h-11 items-center ${linkClass}`}>
            {i.name}
          </Link>{" "}
          <span className="text-sm text-neutral-700">({groupThousands(i.count)})</span>
        </li>
      ))}
    </ul>
  );
}

/** Plantilla única de los listados de B1 (T-103, T-106). */
export function BrowsePage({ data }: { data: Ok }) {
  const { copy, search, seo, parsed } = data;
  const siteUrl = env.siteUrl();
  const firstPosition = (search.page - 1) * search.perPage + 1;
  const showIntro = data.introHtml && seo.page === 1 && !parsed.hasFilterParams;

  return (
    <div className={container}>
      <Breadcrumbs items={copy.crumbs} />
      <JsonLd
        data={collectionPageJsonLd({
          url: absoluteUrl(seo.canonical, siteUrl),
          name: copy.h1,
          description: copy.description,
          itemUrls: search.items.map((l) => absoluteUrl(paths.listing(l), siteUrl)),
          firstPosition,
        })}
      />
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{copy.h1}</h1>
      <p className="mt-1 text-neutral-800" aria-live="polite">
        <strong>{resultsLabel(search.total)}</strong>
        {parsed.hasFilterParams ? " con estos filtros" : ""}
        {seo.page > 1 ? ` · página ${seo.page} de ${search.pageCount}` : ""}.
        {data.priceRange && !parsed.hasFilterParams ? (
          <>
            {" "}
            Precios de contado publicados: de {data.priceRange.min} a {data.priceRange.max} ({groupThousands(data.priceRange.n)} motos con precio).
          </>
        ) : null}
      </p>
      {showIntro ? (
        // intro_html: texto editorial revisado por una persona en el admin (B10, `reviewed_by`).
        <div className="prose mt-3 max-w-prose" dangerouslySetInnerHTML={{ __html: data.introHtml! }} />
      ) : null}

      <div className="mt-4">
        <FilterForm facets={data.facets} parsed={parsed} options={data.options} />
      </div>

      {data.removals.length ? (
        <div className="mt-3">
          <p className="text-sm font-medium">Filtros aplicados (tocá para quitar):</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {data.removals.map((r) => (
              <li key={r.label}>
                <Link href={r.href} rel="nofollow" className={`inline-flex min-h-11 items-center rounded-full border border-neutral-500 bg-white px-3 text-sm ${focusRing}`}>
                  {r.label} <span aria-hidden="true">&nbsp;×</span>
                  <span className="sr-only"> (quitar)</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section aria-labelledby="resultados" className="mt-4">
        <h2 id="resultados" className="sr-only">
          Resultados
        </h2>
        {search.items.length ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {search.items.map((listing) => (
              <li key={listing.id} className="flex">
                <ListingCard listing={listing} headingLevel={3} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState searchText={copy.searchText} headingLevel={3}>
            {data.removals.length ? <p>Probá quitando alguno de los filtros de arriba.</p> : null}
            {data.alternatives.length ? (
              <div>
                <p>Mientras tanto, estas búsquedas sí tienen motos:</p>
                <LinkList items={data.alternatives} />
              </div>
            ) : null}
          </EmptyState>
        )}
        <Pagination page={seo.page} pageCount={search.pageCount} prevHref={seo.prevHref} nextHref={seo.nextHref} />
      </section>

      {search.items.length > 0 && data.alternatives.length ? (
        <section aria-labelledby="alternativas" className="mt-8">
          <h2 id="alternativas" className="text-xl font-bold tracking-tight text-slate-900">
            Otras búsquedas con motos
          </h2>
          <LinkList items={data.alternatives} />
        </section>
      ) : null}

      {data.related ? (
        <section aria-labelledby="relacionados" className="mt-8">
          <h2 id="relacionados" className="text-xl font-bold tracking-tight text-slate-900">
            {data.related.title}
          </h2>
          <LinkList items={data.related.items} />
        </section>
      ) : null}
    </div>
  );
}
