// Mensajes pre-cargados y URL de wa.me (INTEGRATIONS.md §1.2, TEST_PLAN.md §2
// punto 8). Puro: sólo datos reales que llegan por parámetro; nunca un nombre
// de vendedor inventado, sin emojis, ≤ 300 caracteres.

import { formatFinancing, formatGuaranies } from "@/lib/format";
import { isWhatsAppCapable } from "@/lib/phone";

export const WHATSAPP_MESSAGE_MAX = 300;

 
const CONTROL = /[\u{0}-\u{1F}\u{7F}\u{200B}-\u{200F}\u{2028}\u{2029}\u{202A}-\u{202E}\u{2066}-\u{2069}]/gu;
// Emojis y pictogramas: el mensaje va sin emojis aunque el título los traiga.
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/gu;

/** Una línea: sin saltos, sin caracteres de control/bidi, sin emojis, espacios colapsados. */
export function oneLine(value: string): string {
  return value.replace(CONTROL, " ").replace(EMOJI, "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max <= 1) return value.slice(0, Math.max(0, max));
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export type ListingMessageData = {
  title: string;
  priceGs: number | null;
  hasFinancingOnly: boolean;
  downPaymentGs: number | null;
  installmentGs: number | null;
  installmentCount: number | null;
  /** URL absoluta de la ficha. */
  url: string;
};

/** Precio o financiación, como en la ficha; null si no hay ninguno. */
export function priceLine(data: Omit<ListingMessageData, "title" | "url">): string | null {
  const hasTerms =
    data.downPaymentGs !== null && data.installmentGs !== null && data.installmentCount !== null && data.installmentCount > 0;
  const financing = hasTerms
    ? formatFinancing({
        downPaymentGs: data.downPaymentGs!,
        installmentGs: data.installmentGs!,
        installmentCount: data.installmentCount!,
      })
    : null;
  if (!data.hasFinancingOnly && data.priceGs !== null) return formatGuaranies(data.priceGs);
  return financing ?? (data.priceGs !== null ? formatGuaranies(data.priceGs) : null);
}

/**
 * Hola, vi esta moto en moto.com.py:
 * {título} — {precio o "Entrega Gs. X + Y cuotas de Gs. Z"}
 * {URL absoluta}
 * ¿Sigue disponible?
 *
 * Si no entra en 300 caracteres se acorta el título, nunca la URL ni el precio.
 */
export function listingWhatsAppMessage(data: ListingMessageData): string {
  const head = "Hola, vi esta moto en moto.com.py:";
  const tail = "¿Sigue disponible?";
  const price = priceLine(data);
  const suffix = price ? ` — ${price}` : "";
  const url = oneLine(data.url);
  const fixed = head.length + suffix.length + url.length + tail.length + 3; // 3 saltos de línea
  const title = truncate(oneLine(data.title), Math.max(10, WHATSAPP_MESSAGE_MAX - fixed));
  return truncate([head, `${title}${suffix}`, url, tail].join("\n"), WHATSAPP_MESSAGE_MAX);
}

export function dealerWhatsAppMessage(data: { name: string; url: string }): string {
  const head = "Hola, los encontré en moto.com.py:";
  const tail = "Quería hacer una consulta.";
  const url = oneLine(data.url);
  const fixed = head.length + url.length + tail.length + 3;
  const name = truncate(oneLine(data.name), Math.max(10, WHATSAPP_MESSAGE_MAX - fixed));
  return truncate([head, name, url, tail].join("\n"), WHATSAPP_MESSAGE_MAX);
}

/** Contacto general (ADR-21): la búsqueda del visitante, si la hay. */
export function generalWhatsAppMessage(texto?: string | null): string {
  const head = "Hola, les escribo desde moto.com.py.";
  const search = texto ? oneLine(texto).slice(0, 200) : "";
  return truncate(search ? `${head}\nBusco: ${search}` : head, WHATSAPP_MESSAGE_MAX);
}

/**
 * `https://wa.me/<E164 sin +>?text=<urlencoded>`. Sólo celulares paraguayos:
 * un fijo no tiene WhatsApp y el enlace fallaría del lado del visitante.
 */
export function waMeUrl(phoneE164: string, message: string): string {
  if (!isWhatsAppCapable(phoneE164)) {
    throw new Error(`waMeUrl: no es un celular con WhatsApp: ${phoneE164}`);
  }
  return `https://wa.me/${phoneE164.slice(1)}?text=${encodeURIComponent(message)}`;
}
