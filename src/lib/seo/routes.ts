// Contrato de rutas públicas (SEO_ARCHITECTURE.md §1). Es el ÚNICO lugar donde
// se construyen URLs públicas: ninguna página ni componente arma "/motos/" + x
// a mano. Cambiar un patrón acá es cambiar URLs → escalar (PLAN.md §4.3).
//
// Módulo puro (sin entorno ni base): lo pueden importar componentes de
// cliente. Las URLs absolutas se arman con `absoluteUrl(path, siteUrl)`.

import {
  CONDITION_SLUGS,
  MAX_PAGES,
  PAGE_PARAM,
  toQueryEntries,
  type ListingCondition,
  type ParsedSearchParams,
} from "@/lib/listings/filters";
import { isReservedSlug, parsePublicRef } from "@/lib/slug";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Valida un slug antes de meterlo en una ruta. Un slug reservado (G-15) o mal
 * formado es un error de datos: se lanza para que no salga a producción un
 * enlace que choca con `/motos/tipo`, `/motos/ciudad`, etc.
 */
function seg(slug: string, what: string): string {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`routes: slug de ${what} inválido: "${slug}"`);
  }
  if (isReservedSlug(slug)) {
    throw new Error(`routes: slug de ${what} reservado (G-15): "${slug}"`);
  }
  return slug;
}

export const STATIC_PATHS = {
  home: "/",
  motos: "/motos",
  enCuotas: "/motos/en-cuotas",
  dealers: "/comercios",
  financing: "/financiacion",
  insurance: "/seguros",
  guides: "/guias",
  publish: "/publicar",
  howItWorks: "/como-funciona",
  terms: "/terminos",
  privacy: "/privacidad",
  contact: "/contacto",
  /** Confirmación de un lead (A4). Nunca se indexa ni va al sitemap. */
  thanks: "/gracias",
} as const;

export const paths = {
  ...STATIC_PATHS,
  brand: (brand: string) => `/motos/${seg(brand, "marca")}`,
  model: (brand: string, model: string) => `/motos/${seg(brand, "marca")}/${seg(model, "modelo")}`,
  category: (category: string) => `/motos/tipo/${seg(category, "categoría")}`,
  city: (city: string) => `/motos/ciudad/${seg(city, "ciudad")}`,
  brandCity: (brand: string, city: string) => `/motos/${seg(brand, "marca")}/ciudad/${seg(city, "ciudad")}`,
  categoryCity: (category: string, city: string) =>
    `/motos/tipo/${seg(category, "categoría")}/ciudad/${seg(city, "ciudad")}`,
  condition: (condition: ListingCondition) => `/motos/${CONDITION_SLUGS[condition]}`,
  dealer: (dealer: string) => `/comercios/${seg(dealer, "comercio")}`,
  guide: (guide: string) => `/guias/${seg(guide, "guía")}`,
  /**
   * Ficha: `/aviso/<slug>-<ref>` con el `public_ref` en minúsculas. El slug
   * es inmutable una vez publicado (§1); el ref garantiza unicidad.
   */
  listing: (listing: { slug: string; publicRef: string }) => {
    const ref = parsePublicRef(listing.publicRef);
    if (!ref) throw new Error(`routes: public_ref inválido: "${listing.publicRef}"`);
    return `/aviso/${seg(listing.slug, "publicación")}-${ref.toLowerCase()}`;
  },
  /** Enlace privado del vendedor (G-1). Nunca se enlaza públicamente ni va al sitemap. */
  manage: (token: string) => `/mi-aviso/${encodeURIComponent(token)}`,
  /** Redirecciones rastreadas de WhatsApp (ADR-07). Nunca `wa.me` directo. */
  whatsappListing: (listingId: number) => `/ir/wa/${positiveId(listingId)}`,
  whatsappDealer: (dealerId: number) => `/ir/wa/comercio/${positiveId(dealerId)}`,
  /** Contacto general; `texto` precarga lo que busca el visitante (ADR-21). */
  whatsappGeneral: (texto?: string) =>
    texto && texto.trim() !== ""
      ? `/ir/wa/general?${new URLSearchParams({ texto: texto.trim().slice(0, 200) }).toString()}`
      : "/ir/wa/general",
} as const;

function positiveId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`routes: id inválido: ${id}`);
  return id;
}

/** `/aviso/<param>` → `{ slug, ref }` (ref en mayúsculas, como en la base) o `null`. */
export function parseListingParam(param: string): { slug: string; ref: string } | null {
  const decoded = safeDecode(param);
  const dash = decoded.lastIndexOf("-");
  if (dash <= 0) return null;
  const slug = decoded.slice(0, dash);
  const ref = parsePublicRef(decoded.slice(dash + 1));
  if (!ref || !SLUG_PATTERN.test(slug)) return null;
  return { slug, ref };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Ruta + query string. Los pares vacíos no se escriben. */
export function withQuery(path: string, entries: Array<[string, string]> | URLSearchParams): string {
  const query = new URLSearchParams(entries).toString();
  return query ? `${path}?${query}` : path;
}

/** `path?page=N` (la página 1 es la URL limpia). */
export function pagePath(path: string, page: number): string {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES) {
    throw new Error(`routes: página fuera de rango: ${page}`);
  }
  return page === 1 ? path : withQuery(path, [[PAGE_PARAM, String(page)]]);
}

/** URL de un listado con sus filtros actuales, para paginación y "quitar filtro". */
export function listingPageHref(
  path: string,
  parsed: Pick<ParsedSearchParams, "filters" | "facets" | "sort">,
  page = 1,
): string {
  return withQuery(path, toQueryEntries({ ...parsed, page }));
}

/** URL absoluta; `siteUrl` sin barra final (env.siteUrl()). */
export function absoluteUrl(path: string, siteUrl: string): string {
  if (!path.startsWith("/")) throw new Error(`routes: se esperaba una ruta absoluta: "${path}"`);
  return `${siteUrl.replace(/\/+$/, "")}${path === "/" ? "" : path}`;
}

// ---------------------------------------------------------------------------
// Clasificación de /motos/** (SEO_ARCHITECTURE.md §1 y §2.3)
// ---------------------------------------------------------------------------

export type MotosRoute =
  | { kind: "motos" }
  | { kind: "en_cuotas" }
  | { kind: "condition"; condition: ListingCondition }
  | { kind: "brand"; brand: string }
  | { kind: "model"; brand: string; model: string }
  | { kind: "category"; category: string }
  | { kind: "city"; city: string }
  | { kind: "brand_city"; brand: string; city: string }
  | { kind: "category_city"; category: string; city: string };

const CONDITION_BY_SLUG: Record<string, ListingCondition> = { nuevas: "new", usadas: "used" };

function slugOk(value: string | undefined): value is string {
  return value !== undefined && SLUG_PATTERN.test(value) && !isReservedSlug(value);
}

/**
 * Clasifica los segmentos que siguen a `/motos`. `null` = la ruta no existe y
 * debe responder 404 (`notFound()`): marca × modelo × ciudad, tres o más
 * facetas, año o precio como segmento (§2.3), slugs reservados o mal formados.
 */
export function classifyMotosPath(segments: readonly string[]): MotosRoute | null {
  const s = segments.map((part) => safeDecode(part));
  switch (s.length) {
    case 0:
      return { kind: "motos" };
    case 1: {
      if (s[0] === "en-cuotas") return { kind: "en_cuotas" };
      const condition = CONDITION_BY_SLUG[s[0]];
      if (condition) return { kind: "condition", condition };
      return slugOk(s[0]) ? { kind: "brand", brand: s[0] } : null;
    }
    case 2:
      if (s[0] === "tipo") return slugOk(s[1]) ? { kind: "category", category: s[1] } : null;
      if (s[0] === "ciudad") return slugOk(s[1]) ? { kind: "city", city: s[1] } : null;
      return slugOk(s[0]) && slugOk(s[1]) ? { kind: "model", brand: s[0], model: s[1] } : null;
    case 3:
      if (s[0] === "tipo" && s[2] === "ciudad") return null; // /motos/tipo/x/ciudad sin ciudad
      if (s[1] === "ciudad") return slugOk(s[0]) && slugOk(s[2]) ? { kind: "brand_city", brand: s[0], city: s[2] } : null;
      return null; // incluye /motos/<marca>/<modelo>/<año>
    case 4:
      if (s[0] === "tipo" && s[2] === "ciudad" && slugOk(s[1]) && slugOk(s[3])) {
        return { kind: "category_city", category: s[1], city: s[3] };
      }
      return null; // incluye /motos/<marca>/<modelo>/ciudad/<ciudad>
    default:
      return null;
  }
}

/** Ruta canónica de una clasificación (inversa de `classifyMotosPath`). */
export function motosRoutePath(route: MotosRoute): string {
  switch (route.kind) {
    case "motos":
      return paths.motos;
    case "en_cuotas":
      return paths.enCuotas;
    case "condition":
      return paths.condition(route.condition);
    case "brand":
      return paths.brand(route.brand);
    case "model":
      return paths.model(route.brand, route.model);
    case "category":
      return paths.category(route.category);
    case "city":
      return paths.city(route.city);
    case "brand_city":
      return paths.brandCity(route.brand, route.city);
    case "category_city":
      return paths.categoryCity(route.category, route.city);
  }
}

/**
 * Página propia para un conjunto de facetas elegidas en el buscador de
 * `/motos` (`?marca=honda&ciudad=luque` → `/motos/honda/ciudad/luque`).
 * `null` si la combinación no tiene página (§2.3): se queda en `/motos` con
 * filtros (noindex). Sirve para redirigir un formulario GET a la URL limpia.
 */
export function facetRoute(facets: {
  brand?: string;
  model?: string;
  category?: string;
  city?: string;
  condition?: ListingCondition;
}): MotosRoute | null {
  const { brand, model, category, city, condition } = facets;
  const count = [brand, category, city, condition].filter(Boolean).length + (model ? 1 : 0);
  if (count === 0) return { kind: "motos" };
  if (model) {
    return brand && count === 2 ? { kind: "model", brand, model } : null;
  }
  if (count === 1) {
    if (brand) return { kind: "brand", brand };
    if (category) return { kind: "category", category };
    if (city) return { kind: "city", city };
    if (condition) return { kind: "condition", condition };
  }
  if (count === 2 && city) {
    if (brand) return { kind: "brand_city", brand, city };
    if (category) return { kind: "category_city", category, city };
  }
  return null;
}
