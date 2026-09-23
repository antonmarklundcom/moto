// Textos de las páginas de listado (SEO_ARCHITECTURE.md §9): título, h1,
// descripción y migas. Puro. `{N}` siempre es un conteo real que llega de la
// base; con 0 el título omite el conteo (§9).
import { groupThousands } from "@/lib/format";
import { paths } from "@/lib/seo/routes";

export type BrowseKind = "motos" | "brand" | "category" | "city" | "brand_city" | "category_city" | "condition";

export type BrowseNames = {
  brand?: { name: string; slug: string };
  category?: { name: string; slug: string };
  city?: { name: string; slug: string };
  condition?: "new" | "used";
};

export type BrowseCopy = {
  /** Sin " | moto.com.py" (lo agrega la plantilla del layout). */
  title: string;
  h1: string;
  description: string;
  crumbs: Array<{ name: string; href: string }>;
  /** Lo que busca el visitante, para el mensaje precargado del estado vacío. */
  searchText: string;
};

const CONDITION_LABEL = { new: "0 km", used: "usadas" } as const;

function published(n: number): string {
  return n === 1 ? "1 publicada" : `${groupThousands(n)} publicadas`;
}

/** Descripción de 140–160 caracteres cuando se puede (§9): la cola fija sólo si entra. */
function describe(subject: string): string {
  const base = `Encontrá ${subject}. Precios en guaraníes, contado o en cuotas, y contacto directo por WhatsApp.`;
  const long = `${base} Publicá gratis la tuya.`;
  return long.length <= 160 ? long : base;
}

export function browseCopy(kind: BrowseKind, names: BrowseNames, liveCount: number): BrowseCopy {
  const count = liveCount > 0 ? ` — ${published(liveCount)}` : "";
  const brand = names.brand?.name;
  const category = names.category?.name;
  const city = names.city?.name;
  const motos = { name: "Motos", href: paths.motos };

  switch (kind) {
    case "motos":
      return {
        title: `Motos en venta en Paraguay${count}`,
        h1: "Motos en venta en Paraguay",
        description: describe("motos nuevas y usadas en venta en todo Paraguay"),
        crumbs: [motos],
        searchText: "una moto",
      };
    case "brand":
      return {
        title: `Motos ${brand} en Paraguay${count}`,
        h1: `Motos ${brand} en Paraguay`,
        // §9, literal para marca.
        description: `Encontrá motos ${brand} en Paraguay. Precios en guaraníes, nuevas y usadas, contacto directo por WhatsApp.`,
        crumbs: [motos, { name: brand!, href: paths.brand(names.brand!.slug) }],
        searchText: `una ${brand}`,
      };
    case "category":
      return {
        title: `Motos ${category} en Paraguay${count}`,
        h1: `Motos ${category} en Paraguay`,
        description: describe(`motos ${category} nuevas y usadas en Paraguay`),
        crumbs: [motos, { name: category!, href: paths.category(names.category!.slug) }],
        searchText: `una moto ${category}`,
      };
    case "city":
      return {
        title: `Motos en ${city}${count}`,
        h1: `Motos en ${city}`,
        description: describe(`motos nuevas y usadas en ${city}`),
        crumbs: [motos, { name: city!, href: paths.city(names.city!.slug) }],
        searchText: `una moto en ${city}`,
      };
    case "brand_city":
      return {
        title: `Motos ${brand} en ${city}${count}`,
        h1: `Motos ${brand} en ${city}`,
        description: describe(`motos ${brand} nuevas y usadas en ${city}`),
        crumbs: [
          motos,
          { name: brand!, href: paths.brand(names.brand!.slug) },
          { name: city!, href: paths.brandCity(names.brand!.slug, names.city!.slug) },
        ],
        searchText: `una ${brand} en ${city}`,
      };
    case "category_city":
      return {
        title: `Motos ${category} en ${city}${count}`,
        h1: `Motos ${category} en ${city}`,
        description: describe(`motos ${category} nuevas y usadas en ${city}`),
        crumbs: [
          motos,
          { name: category!, href: paths.category(names.category!.slug) },
          { name: city!, href: paths.categoryCity(names.category!.slug, names.city!.slug) },
        ],
        searchText: `una moto ${category} en ${city}`,
      };
    case "condition": {
      const label = CONDITION_LABEL[names.condition ?? "used"];
      return {
        title: `Motos ${label} en Paraguay${count}`,
        h1: `Motos ${label} en Paraguay`,
        description: describe(names.condition === "new" ? "motos 0 km de comercios de Paraguay" : "motos usadas en venta en Paraguay"),
        crumbs: [motos, { name: `Motos ${label}`, href: paths.condition(names.condition ?? "used") }],
        searchText: names.condition === "new" ? "una moto 0 km" : "una moto usada",
      };
    }
  }
}

/** "12 motos" / "1 moto" / "Ninguna moto" para el encabezado de resultados. */
export function resultsLabel(total: number): string {
  if (total === 0) return "Ninguna moto";
  return total === 1 ? "1 moto" : `${groupThousands(total)} motos`;
}
