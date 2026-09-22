// Validación de la ruta pedida a /media/[...path] (G-22). Además del chequeo
// de LocalStorage, acá se rechaza todo lo que no sea una imagen con nombre
// simple: nada de `..`, rutas absolutas, barras invertidas, bytes nulos ni
// archivos ocultos o temporales.

const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export type MediaTarget = { path: string; contentType: string };

/** `null` si la ruta no es servible. Los segmentos llegan ya decodificados. */
export function resolveMediaPath(segments: readonly string[]): MediaTarget | null {
  if (segments.length === 0 || segments.length > 6) return null;
  for (const seg of segments) {
    if (!SEGMENT_RE.test(seg) || seg.includes("..") || seg.endsWith(".tmp")) return null;
  }
  const name = segments[segments.length - 1];
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  const contentType = MEDIA_TYPES[name.slice(dot + 1).toLowerCase()];
  if (!contentType) return null;
  return { path: segments.join("/"), contentType };
}
