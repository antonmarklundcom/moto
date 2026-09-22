// Canonical, robots y metadatos de página (SEO_ARCHITECTURE.md §3 y §9).
// Las páginas no arman `robots` ni `alternates.canonical` a mano: llaman acá.
//
// Reglas (§3):
// - Cualquier parámetro de filtro u orden → `noindex, follow` + canonical a la
//   URL limpia de la página base.
// - `?page=N` (N ≥ 2) → indexable según la página base y auto-canonical.
// - Página inválida, > 50 o > páginas reales → 404.
// - Todo pasa además por el interruptor global SITE_NOINDEX (ADR-26), que ya
//   viene aplicado en `baseIndexable` (src/lib/seo/indexability.ts).

import type { Metadata } from "next";
import type { ParsedSearchParams } from "@/lib/listings/filters";
import { isContentPageIndexable } from "./indexability";
import { listingPageHref, pagePath } from "./routes";
import { SITE_NAME } from "./site";

export { SITE_NAME };

export type RobotsValue = { index: boolean; follow: true };

export function robots(index: boolean): RobotsValue {
  return { index, follow: true };
}

export type ListingPageSeo =
  | { status: "not_found" }
  | {
      status: "ok";
      page: number;
      /** Ruta relativa; `metadataBase` del layout raíz la vuelve absoluta. */
      canonical: string;
      robots: RobotsValue;
      /** Enlaces `rel=prev/next` con los filtros actuales (§3.2). */
      prevHref: string | null;
      nextHref: string | null;
    };

/**
 * Decide canonical, robots y paginación de un listado.
 *
 * @param basePath      ruta limpia de la página (de `paths.*`).
 * @param parsed        resultado de `parseSearchParams`.
 * @param baseIndexable la página base pasa el umbral y el modo global
 *                      (`isIndexable(...)`, `isMotosIndexIndexable(...)`).
 * @param pageCount     páginas reales del resultado (0 si no hay resultados).
 */
export function resolveListingPageSeo(input: {
  basePath: string;
  parsed: Pick<ParsedSearchParams, "filters" | "facets" | "sort" | "page" | "hasFilterParams">;
  baseIndexable: boolean;
  pageCount: number;
}): ListingPageSeo {
  const { basePath, parsed, baseIndexable, pageCount } = input;
  const page = parsed.page;
  if (page === null) return { status: "not_found" };
  // La página 1 existe siempre (el estado vacío también es una página); las
  // demás sólo si hay resultados para llenarlas.
  if (page > 1 && page > pageCount) return { status: "not_found" };

  const lastPage = Math.max(pageCount, 1);
  const prevHref = page > 1 ? listingPageHref(basePath, parsed, page - 1) : null;
  const nextHref = page < lastPage ? listingPageHref(basePath, parsed, page + 1) : null;

  if (parsed.hasFilterParams) {
    return { status: "ok", page, canonical: basePath, robots: robots(false), prevHref, nextHref };
  }
  return {
    status: "ok",
    page,
    canonical: pagePath(basePath, page),
    robots: robots(baseIndexable),
    prevHref,
    nextHref,
  };
}

/** "… — Página 2" en el título de la página 2+ (§3.2: sin títulos duplicados). */
export function withPageSuffix(title: string, page: number): string {
  return page > 1 ? `${title} — Página ${page}` : title;
}

export type PageMetaInput = {
  /** Sin " | moto.com.py": lo agrega la plantilla del layout raíz. */
  title: string;
  description: string;
  canonical: string;
  robots: RobotsValue;
  /** Primera imagen real (URL absoluta o relativa a metadataBase). Nunca una genérica inventada. */
  image?: { url: string; width?: number; height?: number; alt: string } | null;
  ogType?: "website" | "article";
};

/** `Metadata` completo: title, description, canonical, robots, `og:` y `twitter:` (§9). */
export function pageMetadata(input: PageMetaInput): Metadata {
  const { title, description, canonical, image } = input;
  const fullTitle = `${title} | ${SITE_NAME}`;
  const images = image ? [{ url: image.url, width: image.width, height: image.height, alt: image.alt }] : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    robots: input.robots,
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: "es_PY",
      type: input.ogType ?? "website",
      ...(images && { images }),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: fullTitle,
      description,
      ...(images && { images: images.map((i) => i.url) }),
    },
  };
}

/**
 * Páginas de contenido (guías, cómo funciona, estáticas): indexables con
 * `SITE_NOINDEX=content` y `false`, `noindex` con `true` (ADR-26).
 */
export function contentPageMetadata(input: Omit<PageMetaInput, "robots"> & { robots?: never }): Metadata {
  return pageMetadata({ ...input, robots: robots(isContentPageIndexable()) });
}
