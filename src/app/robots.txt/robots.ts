// GET /robots.txt — SEO_ARCHITECTURE.md §3.4, con los ajustes de las fases:
// `/publicar/listo` es la ruta real de "publicación recibida" (el documento
// dice `/publicar/exito`), `/mi-aviso/` lleva un token privado y `/gracias`
// es la confirmación de un lead. Los filtros no se bloquean (el noindex tiene
// que poder verse); sí la búsqueda libre y el orden.
export function robotsTxt(siteUrl: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /ir/",
    "Disallow: /*?orden=",
    "Disallow: /*?q=",
    "Disallow: /publicar/listo",
    "Disallow: /mi-aviso/",
    "Disallow: /gracias",
    "Disallow: /aviso/*/compartir",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}
