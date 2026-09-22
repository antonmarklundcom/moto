import { focusRing } from "./styles";

/** Primer elemento enfocable: salta la navegación hasta `<main id="contenido">`. */
export function SkipLink() {
  return (
    <a
      href="#contenido"
      className={`sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded focus:bg-white focus:px-3 focus:text-neutral-900 ${focusRing}`}
    >
      Saltar al contenido
    </a>
  );
}
