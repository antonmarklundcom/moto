// Filtros de listado: parseo y serialización del query string
// (SEO_ARCHITECTURE.md §3.1, PRODUCT_SPEC.md §3.2). Módulo puro, sin base ni
// entorno: lo usan las páginas (servidor) y los formularios de filtros.
//
// Los nombres de parámetro son contrato público (URLs compartidas por
// WhatsApp); cambiarlos es cambiar URLs → escalar (PLAN.md §4.3).

import { isReservedSlug } from "@/lib/slug";

/** Parámetros de filtro con nombre fijo (§3.1). Cualquiera presente → `noindex, follow`. */
export const FILTER_PARAMS = [
  "marca",
  "modelo",
  "tipo",
  "ciudad",
  "condicion",
  "precio_min",
  "precio_max",
  "anio_min",
  "km_max",
  "cilindrada",
  "entrega_max",
  "cuota_max",
  "q",
  "orden",
] as const;
export type FilterParam = (typeof FILTER_PARAMS)[number];

/** Único parámetro que no quita la indexación (§3.2). */
export const PAGE_PARAM = "page";
/** Máximo de páginas por listado (§3.2): más allá, el usuario filtra. */
export const MAX_PAGES = 50;
export const DEFAULT_PER_PAGE = 24;

export const SORTS = ["recientes", "precio_asc", "precio_desc", "km_asc", "anio_desc"] as const;
export type ListingSort = (typeof SORTS)[number];
export const DEFAULT_SORT: ListingSort = "recientes";

export type ListingCondition = "new" | "used";

/** Valores de `?condicion=` y segmentos `/motos/nuevas`, `/motos/usadas`. */
export const CONDITION_SLUGS: Record<ListingCondition, "nuevas" | "usadas"> = {
  new: "nuevas",
  used: "usadas",
};

/**
 * Filtros ya resueltos a ids, listos para la consulta (src/lib/listings/query.ts).
 * Todo campo ausente = sin filtro.
 */
export type ListingFilters = {
  brandId?: number;
  modelId?: number;
  categoryId?: number;
  cityId?: number;
  dealerId?: number;
  condition?: ListingCondition;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  kmMax?: number;
  ccMin?: number;
  ccMax?: number;
  /** Entrega máxima en Gs.: sólo publicaciones con entrega informada ≤ este valor. */
  downPaymentMax?: number;
  /** Cuota máxima en Gs.: sólo publicaciones con cuota informada ≤ este valor. */
  installmentMax?: number;
  /** Sólo publicaciones con plan de cuotas informado (`/motos/en-cuotas`). */
  withFinancing?: boolean;
  /** Texto libre, ya normalizado (ver `normalizeQuery`). */
  q?: string;
};

/** Facetas pedidas por slug en el query string (`/motos?marca=honda`). */
export type FacetSlugs = {
  brand?: string;
  model?: string;
  category?: string;
  city?: string;
};

export type ParsedSearchParams = {
  /** Filtros que no dependen de la base (todo menos las facetas por slug). */
  filters: Omit<ListingFilters, "brandId" | "modelId" | "categoryId" | "cityId" | "dealerId">;
  facets: FacetSlugs;
  sort: ListingSort;
  /** Página pedida, 1 si no vino. `null` si vino un valor inválido o > MAX_PAGES (→ 404). */
  page: number | null;
  /**
   * Hay al menos un parámetro de filtro u orden en la URL, aunque su valor
   * sea inválido. Decide `noindex, follow` + canonical limpio (§3.1).
   */
  hasFilterParams: boolean;
  /** Vino `?page=` explícito (incluido `?page=1`). */
  hasPageParam: boolean;
};

export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function toGetter(input: SearchParamsInput): (key: string) => string | undefined {
  if (input instanceof URLSearchParams) {
    return (key) => input.get(key) ?? undefined;
  }
  return (key) => {
    const value = input[key];
    // Parámetro repetido (?marca=a&marca=b): vale el primero, como URLSearchParams.get.
    return Array.isArray(value) ? value[0] : value;
  };
}

function hasKey(input: SearchParamsInput, key: string): boolean {
  if (input instanceof URLSearchParams) return input.has(key);
  return input[key] !== undefined;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseSlug(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const slug = raw.trim().toLowerCase();
  if (slug.length === 0 || slug.length > 200 || !SLUG_PATTERN.test(slug) || isReservedSlug(slug)) {
    return undefined;
  }
  return slug;
}

/**
 * Entero no negativo. Acepta el formato visible de guaraníes ("15.000.000",
 * "Gs. 15.000.000") porque la gente pega montos tal como los lee.
 */
export function parseAmount(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const digits = raw.replace(/^\s*gs\.?\s*/i, "").replace(/[.\s]/g, "");
  if (!/^\d{1,15}$/.test(digits)) return undefined;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : undefined;
}

function parseYear(raw: string | undefined): number | undefined {
  const value = parseAmount(raw);
  return value !== undefined && value >= 1950 && value <= 2100 ? value : undefined;
}

/** `?cilindrada=150` (exacta), `125-250`, `-125` (hasta), `250-` (desde). */
export function parseCcRange(raw: string | undefined): { ccMin?: number; ccMax?: number } {
  if (raw === undefined) return {};
  const value = raw.trim();
  const exact = /^(\d{2,4})$/.exec(value);
  if (exact) {
    const cc = Number(exact[1]);
    return { ccMin: cc, ccMax: cc };
  }
  const range = /^(\d{2,4})?-(\d{2,4})?$/.exec(value);
  if (!range || (range[1] === undefined && range[2] === undefined)) return {};
  const ccMin = range[1] === undefined ? undefined : Number(range[1]);
  const ccMax = range[2] === undefined ? undefined : Number(range[2]);
  if (ccMin !== undefined && ccMax !== undefined && ccMin > ccMax) return {};
  return { ...(ccMin !== undefined && { ccMin }), ...(ccMax !== undefined && { ccMax }) };
}

function parseCondition(raw: string | undefined): ListingCondition | undefined {
  switch (raw?.trim().toLowerCase()) {
    case "nueva":
    case "nuevas":
      return "new";
    case "usada":
    case "usadas":
      return "used";
    default:
      return undefined;
  }
}

function parseSort(raw: string | undefined): ListingSort {
  const value = raw?.trim().toLowerCase();
  return (SORTS as readonly string[]).includes(value ?? "") ? (value as ListingSort) : DEFAULT_SORT;
}

/** Página 1…MAX_PAGES; `null` si el valor es inválido o se pasa del tope. */
export function parsePage(raw: string | undefined): number | null {
  if (raw === undefined) return 1;
  if (!/^\d{1,4}$/.test(raw.trim())) return null;
  const page = Number(raw.trim());
  return page >= 1 && page <= MAX_PAGES ? page : null;
}

/**
 * Normaliza el texto libre: espacios colapsados, sin caracteres de control,
 * máximo 100 caracteres. `undefined` si queda vacío.
 */
export function normalizeQuery(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const q = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();
  return q === "" ? undefined : q;
}

/** Lee el query string de un listado. Nunca lanza: lo inválido se ignora. */
export function parseSearchParams(input: SearchParamsInput): ParsedSearchParams {
  const get = toGetter(input);
  const cc = parseCcRange(get("cilindrada"));

  const filters: ParsedSearchParams["filters"] = {};
  const condition = parseCondition(get("condicion"));
  if (condition) filters.condition = condition;
  const priceMin = parseAmount(get("precio_min"));
  if (priceMin !== undefined) filters.priceMin = priceMin;
  const priceMax = parseAmount(get("precio_max"));
  if (priceMax !== undefined) filters.priceMax = priceMax;
  const yearMin = parseYear(get("anio_min"));
  if (yearMin !== undefined) filters.yearMin = yearMin;
  const kmMax = parseAmount(get("km_max"));
  if (kmMax !== undefined) filters.kmMax = kmMax;
  if (cc.ccMin !== undefined) filters.ccMin = cc.ccMin;
  if (cc.ccMax !== undefined) filters.ccMax = cc.ccMax;
  const downPaymentMax = parseAmount(get("entrega_max"));
  if (downPaymentMax !== undefined) filters.downPaymentMax = downPaymentMax;
  const installmentMax = parseAmount(get("cuota_max"));
  if (installmentMax !== undefined) filters.installmentMax = installmentMax;
  const q = normalizeQuery(get("q"));
  if (q !== undefined) filters.q = q;

  const facets: FacetSlugs = {};
  const brand = parseSlug(get("marca"));
  if (brand) facets.brand = brand;
  const model = parseSlug(get("modelo"));
  if (model) facets.model = model;
  const category = parseSlug(get("tipo"));
  if (category) facets.category = category;
  const city = parseSlug(get("ciudad"));
  if (city) facets.city = city;

  return {
    filters,
    facets,
    sort: parseSort(get("orden")),
    page: parsePage(get(PAGE_PARAM)),
    hasFilterParams: FILTER_PARAMS.some((key) => hasKey(input, key)),
    hasPageParam: hasKey(input, PAGE_PARAM),
  };
}

/**
 * Serializa filtros a pares clave/valor en un orden fijo (URLs estables para
 * compartir y para los enlaces de paginación). El orden por defecto y la
 * página 1 no se escriben.
 */
export function toQueryEntries(
  parsed: Pick<ParsedSearchParams, "filters" | "facets" | "sort"> & { page?: number | null },
): Array<[string, string]> {
  const { filters: f, facets, sort } = parsed;
  const entries: Array<[string, string]> = [];
  const push = (key: FilterParam | typeof PAGE_PARAM, value: string | number | undefined) => {
    if (value !== undefined && value !== "") entries.push([key, String(value)]);
  };
  push("marca", facets.brand);
  push("modelo", facets.model);
  push("tipo", facets.category);
  push("ciudad", facets.city);
  push("condicion", f.condition ? (f.condition === "new" ? "nueva" : "usada") : undefined);
  push("precio_min", f.priceMin);
  push("precio_max", f.priceMax);
  push("anio_min", f.yearMin);
  push("km_max", f.kmMax);
  if (f.ccMin !== undefined || f.ccMax !== undefined) {
    push(
      "cilindrada",
      f.ccMin !== undefined && f.ccMin === f.ccMax ? f.ccMin : `${f.ccMin ?? ""}-${f.ccMax ?? ""}`,
    );
  }
  push("entrega_max", f.downPaymentMax);
  push("cuota_max", f.installmentMax);
  push("q", f.q);
  if (sort !== DEFAULT_SORT) push("orden", sort);
  if (parsed.page && parsed.page > 1) push(PAGE_PARAM, parsed.page);
  return entries;
}
