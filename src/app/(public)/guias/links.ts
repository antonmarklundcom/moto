// Enlaces entre guías: un enlace a una guía que no está publicada (borrador o
// inexistente) se deja como texto, para no mandar a nadie (ni a Google) a un 404.
// Puro: trabaja sobre el HTML ya limpio de sanitizeHtml (<a href="…">…</a>).
export function unlinkUnpublishedGuides(html: string, published: ReadonlySet<string>): string {
  return html.replace(/<a href="\/guias\/([a-z0-9-]+)">([\s\S]*?)<\/a>/g, (whole, slug: string, text: string) => (published.has(slug) ? whole : text));
}

/** Guía de compra segura, enlazada desde "Antes de pagar" en cada ficha cuando está publicada. */
export const SAFETY_GUIDE_SLUG = "como-comprar-una-moto-usada-sin-que-te-estafen";
