// Nombres de las variantes de una foto (G-22). Puro y sin dependencias de
// servidor: lo usa también el loader de next/image, que corre en el cliente.
//
// Una foto subida se guarda como varios WebP con el mismo prefijo, un hash del
// contenido re-encodeado, y el ancho en el nombre:
//   listings/ab/ab12…ef-320.webp, …-640.webp, …-1024.webp, …-1600.webp
// Si la foto es más angosta que 1600 px no se agranda: la variante mayor lleva
// su ancho real (ej. …-900.webp) y sólo existen las estándar menores que él.
// `storage_path` en la base apunta siempre a la variante mayor.

export const VARIANT_WIDTHS = [320, 640, 1024, 1600] as const;
export const MAX_VARIANT_WIDTH = VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];

const VARIANT_RE = /^(listings\/[0-9a-f]{2}\/[0-9a-f]{20,64})-(\d{1,4})\.webp$/;

export type VariantSet = { prefix: string; maxWidth: number; widths: number[] };

/** Anchos que existen para una foto cuya variante mayor mide `maxWidth`. */
export function variantWidthsFor(maxWidth: number): number[] {
  const top = Math.min(maxWidth, MAX_VARIANT_WIDTH);
  return [...VARIANT_WIDTHS.filter((w) => w < top), top];
}

export function variantPath(prefix: string, width: number): string {
  return `${prefix}-${width}.webp`;
}

/** Prefijo de almacenamiento a partir del hash del contenido re-encodeado. */
export function variantPrefix(hashHex: string): string {
  return `listings/${hashHex.slice(0, 2)}/${hashHex.slice(0, 32)}`;
}

/** Reconoce la ruta de una variante mayor; `null` si no sigue el esquema (ej. fixtures PNG). */
export function parseVariantPath(storagePath: string): VariantSet | null {
  const m = VARIANT_RE.exec(storagePath);
  if (!m) return null;
  const maxWidth = Number(m[2]);
  if (maxWidth < 1 || maxWidth > MAX_VARIANT_WIDTH) return null;
  return { prefix: m[1], maxWidth, widths: variantWidthsFor(maxWidth) };
}

/** La variante más chica que cubre `width`; si ninguna alcanza, la mayor. */
export function pickVariantWidth(widths: readonly number[], width: number): number {
  return widths.find((w) => w >= width) ?? widths[widths.length - 1];
}
