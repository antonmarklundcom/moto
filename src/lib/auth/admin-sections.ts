// Secciones del panel y quién ve cada una (ADMIN_SPEC.md §2). La navegación se
// arma desde acá y cada página lo usa en requirePageRole(), así que lo que se
// ve en el menú y lo que el servidor deja pasar salen de la misma tabla.
// Cada sección es de una fase de lane 2 (BUILD_PLAN.md §5.2): esa fase ajusta
// su fila si la pantalla lo necesita. Ver no es mutar: toda acción revalida.
import type { Role } from "./roles";

export type AdminSection = {
  slug: string;
  label: string;
  roles: readonly Role[];
};

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { slug: "moderacion", label: "Moderación", roles: ["admin", "moderator"] },
  { slug: "denuncias", label: "Denuncias", roles: ["admin", "moderator"] },
  { slug: "publicaciones", label: "Publicaciones", roles: ["admin", "moderator", "dealer"] },
  { slug: "comercios", label: "Comercios", roles: ["admin", "moderator", "dealer"] },
  { slug: "catalogo", label: "Catálogo", roles: ["admin", "moderator"] },
  { slug: "importar", label: "Importar stock", roles: ["admin"] },
  { slug: "leads", label: "Leads", roles: ["admin", "moderator", "dealer"] },
  { slug: "monetizacion", label: "Monetización", roles: ["admin", "dealer"] },
  { slug: "contenido", label: "Contenido", roles: ["admin", "moderator"] },
  { slug: "actividad", label: "Actividad", roles: ["admin", "moderator"] },
  { slug: "salud", label: "Salud del sitio", roles: ["admin"] },
  { slug: "config", label: "Configuración", roles: ["admin"] },
];

export function adminSection(slug: string): AdminSection {
  const section = ADMIN_SECTIONS.find((s) => s.slug === slug);
  if (!section) throw new Error(`Sección de admin desconocida: ${slug}`);
  return section;
}

export function sectionsFor(role: Role): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => s.roles.includes(role));
}

/** Destino seguro tras el login: sólo rutas internas de /admin, nunca una URL externa. */
export function safeAdminNext(next: string | null | undefined): string {
  if (!next || !/^\/admin(\/|$|\?)/.test(next) || next.startsWith("//") || next.includes("\\")) return "/admin";
  if (next.startsWith("/admin/login")) return "/admin";
  return next;
}
