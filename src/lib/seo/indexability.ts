// Regla de umbral de indexación (T-102, SEO_ARCHITECTURE.md §2.1–§2.2,
// CLAUDE.md §3.4). Es código, no criterio: la usan las páginas programáticas
// (meta robots) y el generador de sitemaps (C1), y ninguna de las dos decide
// por su cuenta. No se relaja "por esta vez".
//
// Módulo puro salvo por el modo global, que se inyecta (por defecto lo lee
// de SITE_NOINDEX vía src/lib/env.ts, ADR-26).

import { globalIndexingAllows, siteIndexingMode, type SiteIndexingMode } from "@/lib/env";

export type ProgrammaticPageType =
  | "brand"
  | "model"
  | "category"
  | "city"
  | "brand_city"
  | "category_city"
  | "condition"
  | "en_cuotas";

export type Threshold = { minLive: number; minWords: number };

/** SEO_ARCHITECTURE.md §2.1, literal. Cambiar un número acá es escalar (PLAN.md §4.3). */
export const THRESHOLDS: Readonly<Record<ProgrammaticPageType, Threshold>> = {
  brand: { minLive: 5, minWords: 300 },
  model: { minLive: 3, minWords: 250 },
  category: { minLive: 8, minWords: 300 },
  city: { minLive: 8, minWords: 250 },
  brand_city: { minLive: 10, minWords: 200 },
  category_city: { minLive: 10, minWords: 200 },
  condition: { minLive: 15, minWords: 300 },
  en_cuotas: { minLive: 10, minWords: 400 },
};

/**
 * ¿Es indexable una página programática? Las **dos** condiciones de §2.1
 * (publicaciones vivas y palabras propias) y además el interruptor global
 * `SITE_NOINDEX` (ADR-26: con `true` o `content`, ninguna página de
 * inventario se indexa).
 */
export function isIndexable(
  pageType: ProgrammaticPageType,
  liveCount: number,
  editorialWords: number,
  mode: SiteIndexingMode = siteIndexingMode(),
): boolean {
  if (!globalIndexingAllows("inventory", mode)) return false;
  const threshold = THRESHOLDS[pageType];
  return liveCount >= threshold.minLive && editorialWords >= threshold.minWords;
}

/**
 * `/motos` (listado general) no es una página programática de §2.1: no tiene
 * umbral propio. Se indexa si el modo global lo permite y hay al menos una
 * publicación viva (§9: con 0, `noindex`).
 */
export function isMotosIndexIndexable(liveCount: number, mode: SiteIndexingMode = siteIndexingMode()): boolean {
  return globalIndexingAllows("inventory", mode) && liveCount >= 1;
}

/** Página de comercio: `active` con ≥ 1 publicación viva (§7, sitemap de comercios). */
export function isDealerPageIndexable(
  dealerStatus: string,
  liveCount: number,
  mode: SiteIndexingMode = siteIndexingMode(),
): boolean {
  return globalIndexingAllows("inventory", mode) && dealerStatus === "active" && liveCount >= 1;
}

export const SOLD_INDEXABLE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ficha de publicación (§4): `published` indexable; `sold` indexable si se
 * vendió hace menos de 90 días; todo lo demás `noindex, follow`.
 */
export function isListingIndexable(
  listing: { status: string; soldAt: Date | null; deletedAt?: Date | null },
  now: Date = new Date(),
  mode: SiteIndexingMode = siteIndexingMode(),
): boolean {
  if (!globalIndexingAllows("inventory", mode)) return false;
  if (listing.deletedAt) return false;
  if (listing.status === "published") return true;
  if (listing.status === "sold" && listing.soldAt) {
    return now.getTime() - listing.soldAt.getTime() < SOLD_INDEXABLE_DAYS * DAY_MS;
  }
  return false;
}

/** Guías, cómo funciona y estáticas (ADR-26: indexables con `content` y `false`). */
export function isContentPageIndexable(mode: SiteIndexingMode = siteIndexingMode()): boolean {
  return globalIndexingAllows("content", mode);
}

const NAMED_ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Palabras visibles de un fragmento HTML (`intro_html`): sin etiquetas, sin
 * `<script>`/`<style>`, con entidades básicas decodificadas. Una "palabra" es
 * una secuencia con al menos una letra o dígito; la puntuación suelta no cuenta.
 */
export function countWords(html: string | null | undefined): number {
  if (!html) return 0;
  const text = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
      if (body[0] === "#") {
        const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? " ";
    });
  const words = text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
  return words.length;
}
