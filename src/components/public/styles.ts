// Clases compartidas del sitio público (pase de diseño E1, ADR-15). El diseño
// vive acá y en unos pocos componentes: la estructura (HTML semántico, un h1,
// labels, foco visible, áreas táctiles ≥ 44 px) no cambia.
//
// Paleta: tinta pizarra (slate) sobre fondo claro; acento naranja de marca
// (orange-700, 5,2:1 sobre blanco) para la marca y detalles; verde para la
// acción principal (WhatsApp / enviar, green-700 = 5,0:1 con texto blanco).
// Las transiciones sólo corren con `motion-safe` (prefers-reduced-motion).

/** Foco visible en todo control (CLAUDE.md §5). */
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700";

/** Área táctil ≥ 44 px (min-h-11 = 44 px). */
export const tapTarget = "inline-flex min-h-11 items-center";

export const linkClass = `font-medium text-blue-800 underline decoration-blue-800/40 underline-offset-2 hover:decoration-blue-800 ${focusRing}`;

const buttonBase = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold shadow-sm motion-safe:transition-colors ${focusRing}`;

/** Acción principal: verde con texto blanco, contraste > 4.5:1. */
export const primaryButton = `${buttonBase} bg-green-700 text-white hover:bg-green-800`;

export const secondaryButton = `${buttonBase} border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50`;

export const container = "mx-auto w-full max-w-6xl px-4";

/** Campos de formulario y sus etiquetas (una sola definición para todo el sitio). */
export const fieldClass = `min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-slate-900 shadow-sm placeholder:text-slate-500 ${focusRing}`;
export const labelClass = "flex flex-col gap-1 text-sm font-medium text-slate-900";

/** Superficie blanca con borde suave (formularios, bloques). */
export const surface = "rounded-xl border border-slate-200 bg-white shadow-sm";

/** Título de sección (h2). */
export const sectionTitle = "text-xl font-bold tracking-tight text-slate-900";
