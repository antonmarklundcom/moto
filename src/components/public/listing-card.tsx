import Link from "next/link";
import { groupThousands } from "@/lib/format";
import type { ListingCardData } from "@/lib/listings/query";
import { paths } from "@/lib/seo/routes";
import { FinancingLine } from "./financing-line";
import { Price } from "./price";
import { focusRing, primaryButton, secondaryButton } from "./styles";

/** Alt real (PRODUCT_SPEC.md §5): "{Marca} {Modelo} {Año} usada en {Ciudad}", sin datos que falten. */
export function listingAltText(l: Pick<ListingCardData, "brand" | "model" | "year" | "condition" | "city">): string {
  return [l.brand.name, l.model?.name, l.year ?? undefined, l.condition === "new" ? "nueva" : "usada", "en", l.city.name]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(" ");
}

/** "12.300 km"; 0 km para nuevas sin kilometraje informado no se inventa: se omite. */
function mileage(l: ListingCardData): string | null {
  return l.mileageKm === null ? null : `${groupThousands(l.mileageKm)} km`;
}

/**
 * Tarjeta de listado (PRODUCT_SPEC.md §3.2): foto, título, precio o cuota,
 * ciudad, año, km, sello de comercio verificado y CTA de WhatsApp por
 * /ir/wa/* (ADR-07, nunca wa.me directo).
 */
export function ListingCard({ listing, headingLevel = 2 }: { listing: ListingCardData; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = paths.listing(listing);
  const sold = listing.status === "sold";
  const facts = [listing.city.name, listing.year ? String(listing.year) : null, mileage(listing)].filter(Boolean);
  const img = listing.image;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white">
      <div className="relative aspect-[4/3] bg-neutral-200">
        {img ? (
          // A3 define el loader y las variantes; hasta entonces, la foto original con tamaño explícito.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.url}
            alt={img.alt ?? listingAltText(listing)}
            width={img.width ?? 800}
            height={img.height ?? 600}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-700">Sin foto</div>
        )}
        {img?.isCatalogPhoto ? (
          <span className="absolute bottom-1 left-1 rounded bg-white/95 px-1.5 py-0.5 text-xs text-neutral-900">
            Foto de catálogo
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <ul className="flex flex-wrap gap-1 text-xs font-semibold" aria-label="Etiquetas">
          {listing.isFeatured ? <li className="rounded bg-amber-200 px-1.5 py-0.5 text-neutral-900">Destacado</li> : null}
          {sold ? <li className="rounded bg-neutral-800 px-1.5 py-0.5 text-white">Vendida</li> : null}
          {listing.dealer?.isVerified ? (
            <li className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900">Comercio verificado</li>
          ) : null}
        </ul>
        <Heading className="text-base font-semibold leading-snug">
          <Link href={href} className={`text-neutral-900 hover:underline ${focusRing}`}>
            {listing.title}
          </Link>
        </Heading>
        <Price data={listing} />
        {!listing.hasFinancingOnly ? (
          <FinancingLine financing={listing} informedBy={listing.dealer ? "comercio" : "vendedor"} className="text-sm" />
        ) : null}
        <p className="text-sm text-neutral-700">{facts.join(" · ")}</p>
        <div className="mt-auto pt-1">
          {sold ? null : listing.contactWhatsapp ? (
            <a href={paths.whatsappListing(listing.id)} rel="nofollow" className={`${primaryButton} w-full`}>
              Escribir por WhatsApp
            </a>
          ) : (
            <Link href={href} className={`${secondaryButton} w-full`}>
              Ver teléfono
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
