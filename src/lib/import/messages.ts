// Textos para copiar y mandar por WhatsApp al comercio (G-6, G-14). Puros.
// Todos los números vienen de consultas reales (ANALYTICS_AND_KPIS.md §7);
// acá sólo se les da formato.
import { formatFinancing, formatGuaranies, groupThousands } from "@/lib/format";

/** Paraguay tiene horario fijo UTC−3 desde octubre de 2024. */
const PY_OFFSET_MS = -3 * 60 * 60 * 1000;

/** "23/09/2026" en hora de Paraguay. */
export function formatDatePy(date: Date): string {
  const d = new Date(date.getTime() + PY_OFFSET_MS);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export type StockLine = {
  externalRef: string | null;
  publicRef: string;
  title: string;
  priceGs: number | null;
  downPaymentGs: number | null;
  installmentGs: number | null;
  installmentCount: number | null;
};

export function priceText(l: StockLine): string {
  const cash = formatGuaranies(l.priceGs);
  if (cash) return cash;
  if (l.installmentGs && l.installmentCount) {
    return formatFinancing({
      downPaymentGs: l.downPaymentGs ?? 0,
      installmentCount: l.installmentCount,
      installmentGs: l.installmentGs,
    }).replace("Entrega Gs. 0 + ", "");
  }
  return "sin precio";
}

/** G-6: pedido de confirmación del stock publicado, con las referencias del comercio. */
export function reconfirmMessage(dealerName: string, lines: readonly StockLine[]): string {
  if (lines.length === 0) {
    return `Hola, ${dealerName}. Hoy no tenés motos publicadas en moto.com.py. Si querés cargar stock, mandame la planilla.`;
  }
  const items = lines.map((l) => `• ${l.externalRef ?? l.publicRef} · ${l.title} · ${priceText(l)}`);
  return [
    `Hola, ${dealerName}. Estas son tus ${lines.length === 1 ? "moto publicada" : `${lines.length} motos publicadas`} en moto.com.py.`,
    "¿Siguen disponibles y con estos precios? Respondeme con las referencias que ya se vendieron o cambiaron, así las actualizo.",
    "",
    ...items,
  ].join("\n");
}

export type DealerReport = {
  dealerName: string;
  from: Date;
  to: Date;
  /** Publicadas ahora mismo. */
  publishedNow: number;
  views: number;
  whatsappClicks: number;
  financingLeads: number;
};

/** G-14: reporte para WhatsApp (formato de ANALYTICS_AND_KPIS.md §7). Los números van tal cual. */
export function reportMessage(r: DealerReport): string {
  const n = (v: number) => groupThousands(v);
  // `to` es exclusivo: el último día contado es el anterior.
  const lastDay = new Date(r.to.getTime() - 1);
  return [
    `*Reporte de ${r.dealerName} en moto.com.py*`,
    `Del ${formatDatePy(r.from)} al ${formatDatePy(lastDay)}`,
    "",
    `Motos publicadas hoy: ${n(r.publishedNow)}`,
    `Visitas a tus motos: ${n(r.views)}`,
    `Consultas por WhatsApp: ${n(r.whatsappClicks)}`,
    `Pedidos de financiación: ${n(r.financingLeads)}`,
    "",
    "Son números reales del sitio. Las visitas de robots no se cuentan.",
  ].join("\n");
}

/** "2026-09-23" (hora de Paraguay), para los `<input type="date">`. */
export function isoDatePy(date: Date): string {
  const d = new Date(date.getTime() + PY_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;
export const MAX_REPORT_DAYS = 366;

/**
 * Rango del reporte desde el formulario (`desde`/`hasta`, días de Paraguay,
 * ambos incluidos) → `[from, to)`. Sin fechas, o inválidas: los últimos 30
 * días hasta ahora (G-14).
 */
export function parseReportRange(
  desde: string | undefined,
  hasta: string | undefined,
  now: Date,
): { from: Date; to: Date; custom: boolean } {
  const fallback = { from: new Date(now.getTime() - 30 * DAY_MS), to: now, custom: false };
  const re = /^(\d{4})-(\d{2})-(\d{2})$/;
  const a = desde ? re.exec(desde) : null;
  const b = hasta ? re.exec(hasta) : null;
  if (!a || !b) return fallback;
  // Medianoche de Paraguay = 03:00 UTC.
  const from = new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], 3));
  const to = new Date(Date.UTC(+b[1], +b[2] - 1, +b[3], 3) + DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || isoDatePy(from) !== desde || to <= from) return fallback;
  if (to.getTime() - from.getTime() > MAX_REPORT_DAYS * DAY_MS) return fallback;
  return { from, to, custom: true };
}
