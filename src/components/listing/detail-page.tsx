import Link from "next/link";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { FinancingLine, hasFinancingData } from "@/components/public/financing-line";
import { JsonLd } from "@/components/public/json-ld";
import { ListingCard, listingAltText } from "@/components/public/listing-card";
import { Price } from "@/components/public/price";
import { container, linkClass, primaryButton, secondaryButton } from "@/components/public/styles";
import { env } from "@/lib/env";
import { groupThousands } from "@/lib/format";
import { formatDatePy } from "@/lib/import/messages";
import { listingJsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl, paths, withQuery } from "@/lib/seo/routes";
import type { ListingLoad } from "./data";
import { Gallery } from "./gallery";
import { PhoneReveal } from "./phone-reveal";
import { ReportForm } from "./report-form";
import { DOCUMENTATION_LABEL } from "./rules";

type Ok = Extract<ListingLoad, { status: "ok" }>;

/** Ficha en el orden móvil de PRODUCT_SPEC.md §3.3. */
export function DetailPage({ data, reportResult, safetyGuideHref = null }: { data: Ok; reportResult: "ok" | "error" | null; safetyGuideHref?: string | null }) {
  const { listing: l, state, similar, priceRange } = data;
  const siteUrl = env.siteUrl();
  const url = paths.listing(l);
  const live = state === "live";
  const informedBy = l.dealer ? "comercio" : "vendedor";
  const modelName = l.model?.name ?? l.modelRaw;
  const crumbs = [
    { name: "Motos", href: paths.motos },
    { name: l.brand.name, href: paths.brand(l.brand.slug) },
    { name: l.title, href: url },
  ];
  const facts: Array<[string, string]> = [
    ["Marca", l.brand.name],
    ...(modelName ? ([["Modelo", modelName]] as Array<[string, string]>) : []),
    ["Condición", l.condition === "new" ? "0 km" : "Usada"],
    ...(l.year ? ([["Año", String(l.year)]] as Array<[string, string]>) : []),
    ...(l.mileageKm !== null ? ([["Kilometraje", `${groupThousands(l.mileageKm)} km`]] as Array<[string, string]>) : []),
    ...(l.engineCc ? ([["Cilindrada", `${l.engineCc} cc`]] as Array<[string, string]>) : []),
    ["Tipo", l.category.name],
    ["Ciudad", l.city.name],
    ...(l.documentationStatus ? ([["Papeles", DOCUMENTATION_LABEL[l.documentationStatus]]] as Array<[string, string]>) : []),
    ["Acepta permuta", l.acceptsTradeIn ? "Sí" : "No"],
    ["Precio negociable", l.isNegotiable ? "Sí" : "No"],
  ];
  const images = l.images.map((i) => absoluteUrl(i.url, siteUrl));
  const alt = listingAltText({ brand: l.brand, model: l.model, year: l.year, condition: l.condition, city: l.city });

  return (
    <article className={container}>
      <Breadcrumbs items={crumbs} />
      {l.status === "published" || l.status === "sold" ? (
        <JsonLd
          data={listingJsonLd({
            url: absoluteUrl(url, siteUrl),
            title: l.title,
            description: l.description,
            images,
            brandName: l.brand.name,
            modelName: l.model?.name ?? null,
            year: l.year,
            mileageKm: l.mileageKm,
            engineCc: l.engineCc,
            condition: l.condition,
            status: l.status,
            priceGs: l.priceGs,
            hasFinancingOnly: l.hasFinancingOnly,
            cityName: l.city.name,
            sellerName: l.dealer?.name ?? null,
          })}
        />
      ) : null}

      {state === "sold" ? (
        <p role="status" className="my-2 rounded border border-neutral-800 bg-neutral-100 p-3 font-semibold">
          Esta moto ya se vendió{l.soldAt ? ` (${formatDatePy(l.soldAt)})` : ""}. Mirá{" "}
          <a href="#similares" className={linkClass}>
            motos parecidas disponibles
          </a>
          .
        </p>
      ) : null}
      {state === "expired" ? (
        <p role="status" className="my-2 rounded border border-amber-700 bg-amber-50 p-3">
          <strong>Esta publicación venció</strong> y puede que la moto ya no esté disponible. Mirá{" "}
          <a href="#similares" className={linkClass}>
            motos parecidas
          </a>
          . ¿Es tuya? Renovala desde el enlace privado que te mandamos al publicarla.
        </p>
      ) : null}

      <div className="mt-2 grid gap-6 md:grid-cols-[3fr_2fr]">
        <div>
          <Gallery images={l.images} alt={alt} />
        </div>
        <div className="flex flex-col gap-3 self-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:sticky md:top-20">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900">{l.title}</h1>
          <Price data={l} />
          {hasFinancingData(l) ? <FinancingLine financing={l} informedBy={informedBy} /> : null}
          {l.hasFinancingOnly ? <p className="text-sm text-neutral-700">El {informedBy} no informó precio de contado.</p> : null}

          {live ? (
            <div role="group" aria-label="Contacto con el vendedor" className="flex flex-col gap-2">
              {l.contactWhatsapp ? (
                <>
                  <a href={paths.whatsappListing(l.id)} rel="nofollow" className={`${primaryButton} w-full`}>
                    Escribir por WhatsApp
                  </a>
                  <PhoneReveal publicRef={l.publicRef} primary={false} label="Ver teléfono" />
                </>
              ) : (
                <>
                  <PhoneReveal publicRef={l.publicRef} primary label="Llamar" />
                  <p className="text-sm text-neutral-700">Este vendedor atiende sólo por llamada.</p>
                </>
              )}
            </div>
          ) : null}

          <aside aria-label="Antes de pagar" className="rounded-lg border-l-4 border-blue-800 bg-blue-50 p-3 text-sm text-slate-900">
            <strong>Antes de pagar:</strong> vé la moto en persona, revisá que la documentación coincida con el vendedor, no
            transfieras dinero por adelantado y desconfiá de precios muy por debajo del mercado.
            {safetyGuideHref ? (
              <>
                {" "}
                <Link href={safetyGuideHref} className={linkClass}>
                  Cómo comprar sin que te estafen
                </Link>
              </>
            ) : null}
          </aside>
        </div>
      </div>

      <section aria-labelledby="datos" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 id="datos" className="text-xl font-bold tracking-tight text-slate-900">
          Datos
        </h2>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-600">{k}</dt>
              <dd className="font-medium text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm text-neutral-700">
          Código {l.publicRef}
          {l.publishedAt ? ` · Publicada el ${formatDatePy(l.publishedAt)}` : ""}
          {l.dealer && l.lastVerifiedAt ? ` · Stock confirmado por el comercio el ${formatDatePy(l.lastVerifiedAt)}` : ""}
        </p>
      </section>

      {l.description ? (
        <section aria-labelledby="descripcion" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="descripcion" className="text-xl font-bold tracking-tight text-slate-900">
            Descripción del {informedBy}
          </h2>
          <p className="mt-2 max-w-prose whitespace-pre-line">{l.description}</p>
        </section>
      ) : null}

      {live ? (
        <section aria-labelledby="financiar" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <h2 id="financiar" className="text-xl font-bold tracking-tight text-slate-900">
            ¿La querés en cuotas?
          </h2>
          <p className="mt-1 max-w-prose">
            Dejanos tus datos y te derivamos con el comercio o una financiera. Nosotros no aprobamos créditos ni fijamos
            cuotas.
          </p>
          <Link href={withQuery(paths.financing, [["aviso", l.publicRef.toLowerCase()]])} className={`${secondaryButton} mt-3`}>
            Quiero financiarla
          </Link>
        </section>
      ) : null}

      {l.model?.introHtml || priceRange ? (
        <section aria-labelledby="modelo" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="modelo" className="text-xl font-bold tracking-tight text-slate-900">
            Sobre la {l.brand.name} {l.model?.name}
          </h2>
          <p className="text-sm text-neutral-700">Información general del modelo, no de esta unidad.</p>
          {priceRange ? (
            <p className="mt-2">
              En el sitio, las {l.condition === "new" ? "0 km" : "usadas"} publicadas de este modelo van de {priceRange.min} a{" "}
              {priceRange.max} (sobre {groupThousands(priceRange.n)} publicaciones con precio de contado).
            </p>
          ) : null}
          {l.model?.introHtml ? (
            // Texto del catálogo revisado en el admin (B10).
            <div className="prose mt-2 max-w-prose" dangerouslySetInnerHTML={{ __html: l.model.introHtml }} />
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="vendedor" className="mt-6">
        <h2 id="vendedor" className="text-xl font-bold tracking-tight text-slate-900">
          {l.dealer ? "Comercio" : "Vendedor"}
        </h2>
        {l.dealer ? (
          <p className="mt-1">
            {l.dealer.status === "active" ? (
              <Link href={paths.dealer(l.dealer.slug)} className={linkClass}>
                {l.dealer.name}
              </Link>
            ) : (
              l.dealer.name
            )}
            {l.dealer.isVerified ? " · Comercio verificado" : ""} · {l.city.name}
          </p>
        ) : (
          <p className="mt-1">Vendedor particular · {l.city.name}</p>
        )}
        <p className="mt-2">
          <a href={`${url}/compartir`} rel="nofollow" className={linkClass}>
            Compartir por WhatsApp
          </a>
        </p>
      </section>

      {similar.length ? (
        <section id="similares" aria-labelledby="similares-titulo" className="mt-8">
          <h2 id="similares-titulo" className="text-xl font-bold tracking-tight text-slate-900">
            Motos parecidas disponibles
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <li key={s.id} className="flex">
                <ListingCard listing={s} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p id="similares" className="mt-8">
          <Link href={paths.brand(l.brand.slug)} className={linkClass}>
            Ver otras motos {l.brand.name}
          </Link>
        </p>
      )}

      <ReportForm publicRef={l.publicRef} path={url} result={reportResult} />
    </article>
  );
}
