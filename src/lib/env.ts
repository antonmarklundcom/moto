// Entorno del servidor, tipado y en un solo lugar.
//
// `server-only` hace que importar este módulo desde un componente de cliente
// rompa el build: ningún secreto (VENDERCRM_API_KEY, SESSION_SECRET…) puede
// terminar en un bundle del navegador por accidente.
//
// Regla (BUILD_PLAN.md §4.5): un valor faltante nunca rompe el arranque. Los
// opcionales devuelven `null` y quien los usa degrada con elegancia (p. ej. sin
// VENDERCRM_URL el lead se guarda con crm_status = pending). Los obligatorios
// lanzan recién cuando se usan, con un mensaje que dice qué falta.
import "server-only";

function read(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? null : value.trim();
}

function required(name: string): string {
  const value = read(name);
  if (value === null) {
    throw new Error(`${name} no está definida. Copiá .env.example a .env y completala.`);
  }
  return value;
}

/**
 * Modo de indexación global (ADR-26):
 * - `"none"`    — SITE_NOINDEX=true: todo noindex.
 * - `"content"` — SITE_NOINDEX=content: guías y páginas estáticas indexables;
 *                 inventario y páginas programáticas noindex.
 * - `"rules"`   — SITE_NOINDEX=false: rigen las reglas de umbral (SEO_ARCHITECTURE.md §2.1).
 */
export type SiteIndexingMode = "none" | "content" | "rules";

/**
 * Parsea SITE_NOINDEX. Falla cerrado: cualquier valor ausente, vacío o
 * desconocido equivale a `true` (todo noindex). Abrir la indexación tiene que
 * ser un valor escrito a propósito, nunca un olvido (CLAUDE.md §3.4).
 */
export function parseSiteIndexingMode(raw: string | null | undefined): SiteIndexingMode {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "false":
      return "rules";
    case "content":
      return "content";
    default:
      return "none";
  }
}

export function siteIndexingMode(): SiteIndexingMode {
  return parseSiteIndexingMode(process.env.SITE_NOINDEX);
}

/** Tipo de página, a efectos del interruptor global de indexación. */
export type IndexablePageKind = "content" | "inventory";

/**
 * ¿El interruptor global permite indexar este tipo de página? `true` no
 * significa "indexable": las páginas de inventario además tienen que pasar el
 * umbral de SEO_ARCHITECTURE.md §2.1 (lo decide A2 en src/lib/seo). `content`
 * = guías, cómo funciona, páginas estáticas; `inventory` = todo lo demás.
 */
export function globalIndexingAllows(kind: IndexablePageKind, mode = siteIndexingMode()): boolean {
  if (mode === "none") return false;
  if (mode === "content") return kind === "content";
  return true;
}

export const env = {
  /** URL pública sin barra final. En desarrollo, http://localhost:3000. */
  siteUrl(): string {
    return (read("SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
  },
  databaseUrl: () => required("DATABASE_URL"),
  /** `null` = CRM no configurado todavía (S-6): los leads quedan en `pending`. */
  vendercrmUrl: () => read("VENDERCRM_URL")?.replace(/\/+$/, "") ?? null,
  vendercrmApiKey: () => read("VENDERCRM_API_KEY"),
  storageDriver: () => read("STORAGE_DRIVER") ?? "local",
  storageLocalPath: () => required("STORAGE_LOCAL_PATH"),
  ipHashSalt: () => required("IP_HASH_SALT"),
  sessionSecret: () => required("SESSION_SECRET"),
  /** `null` = los endpoints de cron responden 503 (ADR-19). */
  cronSecret: () => read("CRON_SECRET"),
  whatsappSiteNumber: () => read("WHATSAPP_SITE_NUMBER"),
  smtp() {
    const host = read("SMTP_HOST");
    if (host === null) return null;
    return {
      host,
      port: Number(read("SMTP_PORT") ?? "587"),
      user: read("SMTP_USER"),
      pass: read("SMTP_PASS"),
    };
  },
  isProduction: () => process.env.NODE_ENV === "production",
};
