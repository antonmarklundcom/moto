import Image from "next/image";
import type { ListingImage } from "./data";

/**
 * Galería sin JS: fila con scroll horizontal y snap. La primera foto es la LCP
 * (prioridad, a lo ancho de la pantalla); el loader de A3 elige la variante.
 * Una foto de catálogo lleva su etiqueta literal (PRODUCT_SPEC.md §3.3).
 */
export function Gallery({ images, alt }: { images: readonly ListingImage[]; alt: string }) {
  if (images.length === 0) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-200 text-slate-700">Sin fotos</div>;
  }
  return (
    <div>
      <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto" aria-label={`Fotos (${images.length})`}>
        {images.map((img, i) => (
          <li key={`${img.url}-${i}`} className={`relative w-full shrink-0 snap-center ${images.length > 1 ? "md:w-[88%]" : ""}`}>
            <Image
              src={img.url}
              alt={img.alt ?? `${alt}${images.length > 1 ? `, foto ${i + 1} de ${images.length}` : ""}`}
              width={img.width ?? 1024}
              height={img.height ?? 768}
              sizes="(min-width: 1152px) 700px, (min-width: 768px) 60vw, 100vw"
              priority={i === 0}
              className="aspect-[4/3] w-full rounded-xl bg-slate-200 object-cover"
            />
            {img.isCatalogPhoto ? (
              <span className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-xs font-medium text-neutral-900">
                Foto de catálogo del modelo, no de esta unidad
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {images.length > 1 ? <p className="mt-1 text-sm text-neutral-700">{images.length} fotos · deslizá para ver más</p> : null}
    </div>
  );
}
