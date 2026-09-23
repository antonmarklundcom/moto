// Reglas puras de la ficha (SEO_ARCHITECTURE.md §4, T&S §5, §9). Sin base.
import type { documentationStatusEnum } from "@/db/schema";

const DAY_MS = 86_400_000;
/** Vencida o vendida hace más de 12 meses → 301 a la página del modelo (§4). */
export const RETIRE_AFTER_DAYS = 365;

export type PublicState =
  | { kind: "live" } // published
  | { kind: "sold" }
  | { kind: "expired" }
  | { kind: "retired" } // vendida/vencida hace > 12 meses → redirección
  | { kind: "gone" } // borrada → 410 (ver log B3: Next sirve 404)
  | { kind: "hidden" }; // draft, pending_review, paused, rejected → 404

export function publicState(
  l: { status: string; deletedAt: Date | null; soldAt: Date | null; expiresAt: Date | null; updatedAt?: Date | null },
  now: Date,
): PublicState {
  if (l.deletedAt) return { kind: "gone" };
  const old = (d: Date | null | undefined) => d !== null && d !== undefined && now.getTime() - d.getTime() > RETIRE_AFTER_DAYS * DAY_MS;
  switch (l.status) {
    case "published":
      return { kind: "live" };
    case "sold":
      return old(l.soldAt) ? { kind: "retired" } : { kind: "sold" };
    case "expired":
      return old(l.expiresAt) ? { kind: "retired" } : { kind: "expired" };
    default:
      return { kind: "hidden" };
  }
}

/** Etiquetas de G-4 (docs/research/vocabulary-check.md, a validar con un comercio). */
export const DOCUMENTATION_LABEL: Record<(typeof documentationStatusEnum)[number], string> = {
  al_dia: "Papeles al día",
  transferencia_pendiente: "Transferencia pendiente",
  // [VERIFICAR con un comercio] Texto neutro: no acusa ni oculta.
  no_declara: "El vendedor no informó el estado de los papeles",
};

/** Motivos de denuncia (TRUST_AND_SAFETY.md §5), en el orden del documento. */
export const REPORT_REASONS = [
  { code: "estafa", label: "Creo que es una estafa" },
  { code: "vendida", label: "Ya está vendida" },
  { code: "precio_falso", label: "El precio no es real" },
  { code: "no_responde", label: "El vendedor no responde" },
  { code: "duplicada", label: "Está publicada varias veces" },
  { code: "robada", label: "Creo que es robada" },
  { code: "datos_incorrectos", label: "Los datos no coinciden" },
  { code: "otro", label: "Otro motivo" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["code"];

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && REPORT_REASONS.some((r) => r.code === value);
}

/** 3 denuncias independientes (IP distintas) de estafa/robada → pausa automática (§5). */
export const AUTO_PAUSE_REASONS: readonly ReportReason[] = ["estafa", "robada"];
export const AUTO_PAUSE_THRESHOLD = 3;
/** Denuncias de mala fe (T&S §5, propietario 2026-09-23): 2 descartadas en 90 días silencian esa IP. */
export const REPORTER_MUTE_DISMISSED = 2;
export const REPORTER_MUTE_WINDOW_DAYS = 90;
/** Tras una reanudación de un moderador, la publicación no se vuelve a pausar sola durante 30 días. */
export const AUTO_PAUSE_COOLDOWN_DAYS = 30;
/** 5 denuncias por IP por día (§5), ventana móvil de 24 h. */
export const REPORTS_PER_IP_PER_DAY = 5;

/** Título de la ficha (§9): `{Marca} {Modelo} {Año} — Gs. {precio} en {Ciudad}`; lo que falta se omite. */
export function listingTitle(l: {
  brandName: string;
  modelName: string | null;
  modelRaw: string | null;
  year: number | null;
  priceText: string | null;
  cityName: string;
}): string {
  const name = [l.brandName, l.modelName ?? l.modelRaw, l.year ? String(l.year) : null].filter(Boolean).join(" ");
  const price = l.priceText ? ` — ${l.priceText}` : "";
  return `${name}${price} en ${l.cityName}`;
}

/** Descripción (§9): `{Condición} con {km} km en {ciudad}. {Entrega y cuota}. Contactá al vendedor por WhatsApp.` */
export function listingDescription(l: {
  condition: "new" | "used";
  mileageKm: number | null;
  cityName: string;
  financingText: string | null;
  whatsapp: boolean;
  kmText: string | null;
}): string {
  const head =
    l.condition === "new" ? `0 km en ${l.cityName}.` : l.kmText ? `Usada con ${l.kmText} en ${l.cityName}.` : `Usada en ${l.cityName}.`;
  const fin = l.financingText ? ` ${l.financingText}.` : "";
  const cta = l.whatsapp ? " Contactá al vendedor por WhatsApp." : " Llamá al vendedor.";
  return `${head}${fin}${cta}`;
}
