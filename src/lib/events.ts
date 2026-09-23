// Registro de eventos propios en `listing_events` (ANALYTICS_AND_KPIS.md §2.1,
// ADR-07). Es la fuente de verdad de vistas y contactos, y lo que se le
// reporta a un comercio: nada se guarda en claro y nunca rompe la página.
//
// Privacidad: IP, user-agent y sesión se guardan como HMAC-SHA256 con
// IP_HASH_SALT (hashWithSalt). El referrer se guarda sin query string ni
// fragmento. Sin IP_HASH_SALT los hashes quedan en NULL: el evento se guarda
// igual (un evento sin hash vale más que ninguno).
//
// Sesión: el sitio público no pone cookies. `session_hash` =
// HMAC(IP | user-agent | día UTC): alcanza para deduplicar vistas en 30 min
// y para la regla de 30 vistas en 10 min, sin identificar a nadie entre días.
//
// Uso desde un server component, sin demorar el render:
//   after(() => recordListingEvent({ type: "view", listingId, dealerId, headers: await headers() }))
// Desde un route handler (/ir/wa/*), con await y antes del 302.
import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { listingEvents, listings, type listingEventTypeEnum } from "@/db/schema";
import { env } from "@/lib/env";
import { hashWithSalt } from "@/lib/hash";
import { clientIp, RateLimiter } from "@/lib/rate-limit";

export type ListingEventType = (typeof listingEventTypeEnum)[number];

type HeaderGetter = Pick<Headers, "get">;

/**
 * User-agents que no son personas: buscadores, previsualizaciones de enlaces
 * (WhatsApp, Facebook, Telegram…), herramientas y navegadores sin interfaz.
 */
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|mediapartners|facebookexternalhit|facebookcatalog|whatsapp\/|telegrambot|discordbot|skypeuripreview|embedly|linkpreview|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|pingdom|uptime|monitor|curl\/|wget\/|python|java\/|okhttp|go-http-client|node-fetch|axios|undici|libwww|httpclient|scrapy|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|perplexity|applebot|yandex|baidu|duckduck|bingpreview/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim() ?? "";
  if (ua.length < 10) return true; // vacío o sospechosamente corto
  return BOT_UA.test(ua);
}

/** ¿El referer es una página del propio sitio? */
export function isOwnReferer(referer: string | null | undefined, siteUrl: string): boolean {
  if (!referer) return false;
  try {
    const ref = new URL(referer);
    const site = new URL(siteUrl);
    const strip = (host: string) => host.toLowerCase().replace(/^www\./, "");
    return strip(ref.host) === strip(site.host);
  } catch {
    return false;
  }
}

/** Más de 30 vistas por `session_hash` en 10 minutos → bot (§2.1). */
/**
 * Vistas y clics se cuentan una vez por sesión y publicación cada 30 minutos
 * (ANALYTICS_AND_KPIS.md §1): recargar la ficha o tocar dos veces "Escribir
 * por WhatsApp" no infla los números que ve el comercio. La fila del evento
 * se guarda igual; sólo el contador y los reportes deduplican.
 */
export const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

export const VIEW_BURST_LIMIT = 30;
export const VIEW_BURST_WINDOW_MS = 10 * 60 * 1000;
// Un proceso Node en el slot (ADR-04): la memoria alcanza. Al reiniciar se
// pierde la ventana, que es de 10 minutos: el costo es marcar de menos, nunca
// de más. `listing_events` no tiene índice por session_hash para contarlo en
// la base, y agregarlo es un cambio de esquema.
const viewBursts = new RateLimiter(VIEW_BURST_LIMIT, VIEW_BURST_WINDOW_MS, 50_000);

export type BotSignals = {
  userAgent: string | null;
  referer: string | null;
  siteUrl: string;
  /**
   * El evento sólo ocurre navegando dentro del sitio (clic en un CTA:
   * whatsapp_click, phone_reveal, share). Sin Referer propio → bot (§2.1).
   * Una vista (`view`) puede llegar sin referer (enlace de WhatsApp): no aplica.
   */
  internalNavigation: boolean;
  /** Superó 30 vistas en 10 minutos. */
  burst: boolean;
};

export function detectBot(signals: BotSignals): boolean {
  if (isBotUserAgent(signals.userAgent)) return true;
  if (signals.internalNavigation && !isOwnReferer(signals.referer, signals.siteUrl)) return true;
  return signals.burst;
}

/** Referrer sin query string ni fragmento (pueden llevar datos personales), máx. 500. */
export function sanitizeReferrer(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export type VisitorHashes = { sessionHash: string | null; ipHash: string | null; userAgentHash: string | null };

/** Hashes del visitante. `salt` null → todo null (sin sal no se guarda nada identificable). */
export function visitorHashes(ip: string | null, userAgent: string | null, salt: string | null, now: Date): VisitorHashes {
  if (!salt) return { sessionHash: null, ipHash: null, userAgentHash: null };
  const ua = userAgent ?? "";
  return {
    sessionHash: hashWithSalt(`session|${ip ?? "-"}|${ua}|${utcDay(now)}`, salt),
    // Igual que auth_attempts.ip_hash (A1): el mismo IP da el mismo hash en todas las tablas.
    ipHash: ip ? hashWithSalt(ip, salt) : null,
    userAgentHash: ua ? hashWithSalt(ua, salt) : null,
  };
}

export type RecordEventInput = {
  type: ListingEventType;
  listingId: number | null;
  dealerId?: number | null;
  headers: HeaderGetter;
  /** Ruta de la página donde ocurrió (se guarda sin query string). */
  pagePath?: string | null;
  /** Por defecto: true para clics de CTA, false para `view`. */
  internalNavigation?: boolean;
  now?: Date;
};

export type RecordEventResult = { recorded: boolean; isBot: boolean };

const COUNTER_BY_TYPE: Partial<Record<ListingEventType, "viewCount" | "whatsappClickCount">> = {
  view: "viewCount",
  whatsapp_click: "whatsappClickCount",
};

const INTERNAL_BY_DEFAULT: ReadonlySet<ListingEventType> = new Set(["whatsapp_click", "phone_reveal", "share", "favorite"]);

/**
 * Inserta el evento y, si no es bot, incrementa el contador denormalizado
 * (`view_count`, `whatsapp_click_count`). **Nunca lanza**: ante cualquier
 * error loguea y devuelve `recorded: false`. Perder un evento es aceptable;
 * romper una ficha o un 302 a WhatsApp, no (INTEGRATIONS.md §1.1).
 */
export async function recordListingEvent(input: RecordEventInput): Promise<RecordEventResult> {
  let isBot = false;
  try {
    const now = input.now ?? new Date();
    const userAgent = input.headers.get("user-agent");
    const referer = input.headers.get("referer");
    const ip = clientIp(input.headers);
    let salt: string | null = null;
    try {
      salt = env.ipHashSalt();
    } catch {
      console.error(JSON.stringify({ level: "warn", msg: "events: IP_HASH_SALT sin definir; evento sin hashes" }));
    }
    const hashes = visitorHashes(ip, userAgent, salt, now);
    const siteUrl = env.siteUrl();

    let burst = false;
    if (input.type === "view") {
      const key = hashes.sessionHash ?? `nosalt|${ip ?? "-"}|${userAgent ?? ""}`;
      burst = !viewBursts.check(key, now.getTime()).allowed;
    }
    isBot = detectBot({
      userAgent,
      referer,
      siteUrl,
      internalNavigation: input.internalNavigation ?? INTERNAL_BY_DEFAULT.has(input.type),
      burst,
    });

    const counter = COUNTER_BY_TYPE[input.type];
    // ¿Ya contamos esta sesión en esta publicación en los últimos 30 minutos?
    // (usa el índice listing_id + event_type + created_at).
    let repeated = false;
    if (counter && !isBot && input.listingId !== null && hashes.sessionHash) {
      const [prev] = await db
        .select({ id: listingEvents.id })
        .from(listingEvents)
        .where(
          and(
            eq(listingEvents.listingId, input.listingId),
            eq(listingEvents.eventType, input.type),
            gte(listingEvents.createdAt, new Date(now.getTime() - DEDUPE_WINDOW_MS)),
            eq(listingEvents.sessionHash, hashes.sessionHash),
            eq(listingEvents.isBot, false),
          ),
        )
        .limit(1);
      repeated = Boolean(prev);
    }

    await db.insert(listingEvents).values({
      listingId: input.listingId,
      eventType: input.type,
      dealerId: input.dealerId ?? null,
      sessionHash: hashes.sessionHash,
      ipHash: hashes.ipHash,
      userAgentHash: hashes.userAgentHash,
      referrer: sanitizeReferrer(referer),
      pageUrl: input.pagePath ? input.pagePath.split(/[?#]/)[0].slice(0, 500) : null,
      isBot,
      createdAt: now,
    });

    if (counter && !isBot && !repeated && input.listingId !== null) {
      await db
        .update(listings)
        .set({ [counter]: sql`${listings[counter]} + 1`, updatedAt: sql`${listings.updatedAt}` })
        .where(eq(listings.id, input.listingId));
    }
    return { recorded: true, isBot };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "events: no se pudo registrar el evento",
        type: input.type,
        listingId: input.listingId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { recorded: false, isBot };
  }
}

/** Sólo pruebas: vacía la ventana de ráfagas. */
export function resetViewBurstsForTests(): void {
  viewBursts.reset();
}
