// Constructores de JSON-LD (SEO_ARCHITECTURE.md §6).
//
// Prohibiciones duras, garantizadas por código:
// - Nunca `Review` ni `AggregateRating` (ADR-10): `serializeJsonLd` lanza si
//   aparecen, en cualquier nivel, como tipo o como propiedad.
// - Nunca `priceValidUntil` inventado.
// - Con `has_financing_only` no se emite `price`.
// - Todo dato de acá tiene que estar visible en la página: quien llama pasa
//   los mismos valores que renderiza, y un dato ausente se omite.
//
// Módulo puro: recibe URLs absolutas ya armadas (routes.ts + absoluteUrl).

import { SITE_NAME } from "./site";

export type JsonLdNode = { "@type": string | string[]; [key: string]: unknown };
export type JsonLdDocument = JsonLdNode & { "@context": "https://schema.org" };

const FORBIDDEN_TYPES = new Set(["review", "aggregaterating", "criticreview", "employerreview", "userreview"]);
const FORBIDDEN_KEYS = new Set(["review", "reviews", "aggregaterating", "reviewrating"]);

/** Devuelve la ruta del primer `Review`/`AggregateRating` encontrado, o `null`. */
export function findForbiddenJsonLd(value: unknown, path = "$"): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findForbiddenJsonLd(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (value === null || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return `${path}.${key}`;
    if (key === "@type") {
      const types = Array.isArray(child) ? child : [child];
      if (types.some((t) => typeof t === "string" && FORBIDDEN_TYPES.has(t.replace(/^.*[/#:]/, "").toLowerCase()))) {
        return `${path}.@type`;
      }
    }
    const found = findForbiddenJsonLd(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

/**
 * Serializa para `<script type="application/ld+json">`. Escapa `<`, `>` y `&`
 * para que un título con "</script>" no rompa el HTML. Lanza si aparece
 * `Review` o `AggregateRating` (ADR-10): es fabricación, no un detalle.
 */
export function serializeJsonLd(doc: JsonLdDocument | JsonLdDocument[]): string {
  const forbidden = findForbiddenJsonLd(doc);
  if (forbidden) {
    throw new Error(`JSON-LD prohibido (ADR-10: sin Review ni AggregateRating) en ${forbidden}`);
  }
  return JSON.stringify(doc)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function doc<T extends JsonLdNode>(node: T): T & { "@context": "https://schema.org" } {
  return { "@context": "https://schema.org", ...node };
}

/** Quita claves `undefined`/`null` (un dato que falta se omite, no se rellena). */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)) as T;
}

// ---------------------------------------------------------------------------
// Global: Organization + WebSite con SearchAction
// ---------------------------------------------------------------------------

/** `siteUrl` sin barra final. Sin logo ni `sameAs` hasta que existan de verdad. */
export function organizationJsonLd(siteUrl: string): JsonLdDocument {
  return doc({ "@type": "Organization", "@id": `${siteUrl}/#organization`, name: SITE_NAME, url: siteUrl });
}

export function webSiteJsonLd(siteUrl: string): JsonLdDocument {
  return doc({
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: SITE_NAME,
    url: siteUrl,
    inLanguage: "es-PY",
    publisher: { "@id": `${siteUrl}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/motos?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  });
}

// ---------------------------------------------------------------------------
// Migas
// ---------------------------------------------------------------------------

export type BreadcrumbItem = { name: string; url: string };

/** `items` en orden, con URLs absolutas; el último es la página actual. */
export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLdDocument {
  return doc({
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  });
}

// ---------------------------------------------------------------------------
// Listados: CollectionPage + ItemList
// ---------------------------------------------------------------------------

export function collectionPageJsonLd(input: {
  url: string;
  name: string;
  description?: string;
  /** URLs absolutas de las fichas visibles en esta página, en orden. */
  itemUrls: readonly string[];
  /** Posición de la primera ficha (página 2 con 24 por página → 25). */
  firstPosition?: number;
}): JsonLdDocument {
  const first = input.firstPosition ?? 1;
  return doc(
    compact({
      "@type": "CollectionPage",
      url: input.url,
      name: input.name,
      description: input.description,
      inLanguage: "es-PY",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: input.itemUrls.length,
        itemListElement: input.itemUrls.map((url, index) => ({
          "@type": "ListItem",
          position: first + index,
          url,
        })),
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Ficha: Product + Offer + Vehicle
// ---------------------------------------------------------------------------

export type ListingJsonLdInput = {
  url: string;
  title: string;
  description?: string | null;
  /** URLs absolutas de las fotos reales, en orden. */
  images: readonly string[];
  brandName: string;
  modelName?: string | null;
  year?: number | null;
  mileageKm?: number | null;
  engineCc?: number | null;
  condition: "new" | "used";
  status: "published" | "sold";
  priceGs?: number | null;
  hasFinancingOnly: boolean;
  cityName: string;
  sellerName?: string | null;
};

export function listingJsonLd(input: ListingJsonLdInput): JsonLdDocument {
  const vehicle = compact({
    "@type": "Vehicle",
    name: input.title,
    brand: { "@type": "Brand", name: input.brandName },
    model: input.modelName ?? undefined,
    vehicleModelDate: input.year ? String(input.year) : undefined,
    mileageFromOdometer:
      input.mileageKm !== null && input.mileageKm !== undefined
        ? { "@type": "QuantitativeValue", value: input.mileageKm, unitCode: "KMT" }
        : undefined,
    vehicleEngine: input.engineCc
      ? { "@type": "EngineSpecification", engineDisplacement: { "@type": "QuantitativeValue", value: input.engineCc, unitCode: "CMQ" } }
      : undefined,
    itemCondition: input.condition === "new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
  });

  // Con financiación sola no hay precio de contado: no se emite `price` (§6).
  const showPrice = !input.hasFinancingOnly && typeof input.priceGs === "number" && input.priceGs > 0;
  const offer = compact({
    "@type": "Offer",
    url: input.url,
    priceCurrency: "PYG",
    price: showPrice ? input.priceGs : undefined,
    availability: input.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    itemCondition: vehicle.itemCondition,
    areaServed: { "@type": "City", name: input.cityName },
    seller: input.sellerName ? { "@type": "Organization", name: input.sellerName } : undefined,
    itemOffered: vehicle,
  });

  return doc(
    compact({
      "@type": "Product",
      name: input.title,
      description: input.description ?? undefined,
      image: input.images.length > 0 ? [...input.images] : undefined,
      brand: { "@type": "Brand", name: input.brandName },
      model: input.modelName ?? undefined,
      offers: offer,
    }),
  );
}

// ---------------------------------------------------------------------------
// Comercio: AutoDealer
// ---------------------------------------------------------------------------

export function autoDealerJsonLd(input: {
  url: string;
  name: string;
  description?: string | null;
  /** E.164, tal como se muestra en la página. */
  telephone?: string | null;
  streetAddress?: string | null;
  cityName: string;
  department?: string | null;
  areaServed?: readonly string[];
}): JsonLdDocument {
  return doc(
    compact({
      "@type": "AutoDealer",
      url: input.url,
      name: input.name,
      description: input.description ?? undefined,
      telephone: input.telephone ?? undefined,
      address: compact({
        "@type": "PostalAddress",
        streetAddress: input.streetAddress ?? undefined,
        addressLocality: input.cityName,
        addressRegion: input.department ?? undefined,
        addressCountry: "PY",
      }),
      areaServed: (input.areaServed?.length ? input.areaServed : [input.cityName]).map((name) => ({ "@type": "City", name })),
    }),
  );
}

// ---------------------------------------------------------------------------
// Guías: Article + FAQPage
// ---------------------------------------------------------------------------

export function articleJsonLd(input: {
  url: string;
  headline: string;
  description?: string | null;
  datePublished: Date;
  dateModified: Date;
  image?: string | null;
  siteUrl: string;
}): JsonLdDocument {
  return doc(
    compact({
      "@type": "Article",
      mainEntityOfPage: input.url,
      headline: input.headline.slice(0, 110),
      description: input.description ?? undefined,
      datePublished: input.datePublished.toISOString(),
      dateModified: input.dateModified.toISOString(),
      image: input.image ?? undefined,
      inLanguage: "es-PY",
      author: { "@id": `${input.siteUrl}/#organization` },
      publisher: { "@id": `${input.siteUrl}/#organization` },
    }),
  );
}

/** Sólo con preguntas reales que estén en la página (§6). */
export function faqPageJsonLd(questions: readonly { question: string; answer: string }[]): JsonLdDocument | null {
  if (questions.length === 0) return null;
  return doc({
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  });
}
