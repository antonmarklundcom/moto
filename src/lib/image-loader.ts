// Loader de next/image (G-22). No hay optimización en el servidor (gastaría CPU
// del slot compartido): las variantes WebP se generan al subir y este loader
// elige la más chica que cubre el ancho pedido. Corre también en el cliente,
// así que no puede mirar el disco: decide sólo por el nombre.
//
// Una ruta que no sigue el esquema de variantes (placeholders PNG de
// `npm run fixtures`, fotos estáticas de public/) se sirve tal cual; el `?w=`
// sólo cumple con next/image, que exige que el loader use el ancho.
import { parseVariantPath, pickVariantWidth, variantPath } from "./images/variants";

const MEDIA_PREFIX = "/media/";

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (src.startsWith(MEDIA_PREFIX)) {
    let storagePath: string;
    try {
      storagePath = decodeURIComponent(src.slice(MEDIA_PREFIX.length).split("?")[0]);
    } catch {
      storagePath = "";
    }
    const set = parseVariantPath(storagePath);
    if (set) return `${MEDIA_PREFIX}${variantPath(set.prefix, pickVariantWidth(set.widths, width))}`;
  }
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}
