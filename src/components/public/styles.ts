// Clases compartidas del shell público. Estilo mínimo a propósito (ADR-15):
// el rediseño cambia estas clases, no la estructura.

/** Foco visible en todo control (CLAUDE.md §5). */
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

/** Área táctil ≥ 44 px (min-h-11 = 44 px). */
export const tapTarget = "inline-flex min-h-11 items-center";

export const linkClass = `text-blue-800 underline underline-offset-2 hover:text-blue-950 ${focusRing}`;

/** Botón principal: verde oscuro con texto blanco, contraste > 4.5:1. */
export const primaryButton = `inline-flex min-h-11 items-center justify-center rounded-md bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-900 ${focusRing}`;

export const secondaryButton = `inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-500 bg-white px-4 py-2 font-semibold text-neutral-900 hover:bg-neutral-100 ${focusRing}`;

export const container = "mx-auto w-full max-w-6xl px-4";
