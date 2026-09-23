// Fotos del stock por nombre de archivo (G-18): cada archivo empieza con la
// referencia de la moto: `HX-102.jpg`, `HX-102-2.jpg`, `HX-102_catalogo.jpg`.
// Puro, para probarlo sin base.

export const PHOTO_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

/** Nombre sin carpetas (acepta rutas de zip y de `webkitdirectory`). */
export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Referencia a la que pertenece un archivo: la más larga con la que empieza
 * el nombre, seguida de fin, punto, guion, guion bajo, espacio o paréntesis.
 * Sin mayúsculas/minúsculas. `null` si ninguna.
 */
export function refForFile(fileName: string, refs: Iterable<string>): string | null {
  const name = baseName(fileName).toUpperCase();
  let best: string | null = null;
  for (const ref of refs) {
    const r = ref.toUpperCase();
    if (!name.startsWith(r)) continue;
    const next = name.charAt(r.length);
    if (next !== "" && !".-_ (".includes(next)) continue;
    if (best === null || r.length > best.length) best = ref;
  }
  return best;
}

/** `…catalogo…` en el nombre = foto oficial del modelo, marcada como tal (DATA_SEEDING.md §4). */
export function isCatalogPhotoName(fileName: string): boolean {
  return /cat[aá]logo|catalog/i.test(baseName(fileName));
}

/** Orden natural: `X-2` antes que `X-10`. Así las fotos quedan en el orden en que el comercio las numeró. */
export function naturalCompare(a: string, b: string): number {
  const chunks = (s: string) => baseName(s).toLowerCase().match(/\d+|\D+/g) ?? [];
  const x = chunks(a);
  const y = chunks(b);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    if (x[i] === y[i]) continue;
    const bothNumbers = /^\d/.test(x[i]) && /^\d/.test(y[i]);
    if (bothNumbers) return Number(x[i]) - Number(y[i]) || x[i].length - y[i].length;
    return x[i] < y[i] ? -1 : 1;
  }
  return x.length - y.length;
}
