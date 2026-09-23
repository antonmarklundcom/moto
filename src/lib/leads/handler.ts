// POST /api/leads (INTEGRATIONS.md §2, PRODUCT_SPEC.md §2.3). La lógica vive
// acá y no en la ruta para poder probarla sin el runtime de Next.
//
// Orden: origen → límite por IP → honeypot → validar (teléfono normalizado)
// → guardar en `leads` → responder → (después de responder) postear al CRM.
//
// Dos formas de uso, mismo endpoint:
// - JSON (fetch desde el formulario con JS): responde JSON.
// - Formulario HTML sin JS (application/x-www-form-urlencoded o multipart):
//   responde 303 a /gracias?tipo=… o de vuelta a la página con ?error=campo.
// El visitante nunca ve un error del CRM: el CRM ni se llama antes de responder.
import "server-only";

import { env } from "@/lib/env";
import { STATIC_PATHS } from "@/lib/seo/routes";
import { clientIp, RateLimiter } from "@/lib/rate-limit";
import { ATTRIBUTION_COOKIE, readAttribution } from "./attribution";
import { deliverLead } from "./deliver";
import { formFlashCookie } from "./form-flash";
import { jsonResponse, ownRefererPath, sameOriginOrAbsent, seeOther } from "./http";
import { leadLog } from "./log";
import { saveLead } from "./save";
import { isPublicLeadType, LEAD_TYPE_SLUG, type PublicLeadType } from "./types";
import { HONEYPOT_FIELD, safePagePath, validateLead } from "./validate";

/**
 * Página de gracias (la construye B5). `?tipo=` = LEAD_TYPE_SLUG. No está en
 * el contrato de rutas (src/lib/seo/routes.ts, de A2): es noindex y no se
 * enlaza; ver docs/log/A4.md.
 */
export const THANKS_PATH = "/gracias";

/** Adónde vuelve un formulario sin JS con error si no se sabe de qué página vino. */
const FORM_PAGE_BY_TYPE: Record<PublicLeadType, string> = {
  financing: STATIC_PATHS.financing,
  insurance: STATIC_PATHS.insurance,
  dealer_plan: STATIC_PATHS.dealers,
  advertising: STATIC_PATHS.contact,
};

export const LEAD_RATE_LIMIT = 10;
export const LEAD_RATE_WINDOW_MS = 10 * 60 * 1000;
const limiter = new RateLimiter(LEAD_RATE_LIMIT, LEAD_RATE_WINDOW_MS);

export const LEAD_MESSAGES = {
  ok: "Recibimos tu consulta. Te vamos a contactar al número que dejaste.",
  limite: "Recibimos varias consultas seguidas desde tu conexión. Esperá unos minutos y probá de nuevo.",
  servidor: "No pudimos guardar tu consulta. Probá de nuevo en un momento o escribinos por WhatsApp.",
  origen: "Solicitud no válida.",
} as const;

export type Schedule = (task: () => Promise<unknown>) => void;

async function readFields(request: Request): Promise<{ fields: Record<string, string>; json: boolean } | null> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body: unknown = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return null;
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (typeof v === "string") fields[k] = v;
        else if (typeof v === "number" && Number.isFinite(v)) fields[k] = String(v);
      }
      return { fields, json: true };
    }
    if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
      const form = await request.formData();
      const fields: Record<string, string> = {};
      for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;
      const accept = request.headers.get("accept") ?? "";
      return { fields, json: accept.includes("application/json") && !accept.includes("text/html") };
    }
  } catch {
    return null;
  }
  return null;
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function withError(path: string, field: string): string {
  const url = new URL(path, "http://x");
  url.searchParams.set("error", field);
  return `${url.pathname}${url.search}`;
}

export async function handleLeadPost(request: Request, schedule: Schedule): Promise<Response> {
  const headers = request.headers;
  if (!sameOriginOrAbsent(headers)) {
    leadLog("warn", "leads: POST con Origin ajeno", { origin: headers.get("origin")?.slice(0, 200) });
    return jsonResponse(403, { ok: false, error: LEAD_MESSAGES.origen });
  }

  const parsed = await readFields(request);
  if (!parsed) return jsonResponse(415, { ok: false, error: "Formato no soportado." });
  const { fields, json } = parsed;
  const tipo = fields.tipo?.trim() ?? "";
  const type: PublicLeadType | null = isPublicLeadType(tipo) ? tipo : null;
  const thanks = `${THANKS_PATH}?tipo=${type ? LEAD_TYPE_SLUG[type] : "consulta"}`;
  const backTo = safePagePath(fields.pagina) ?? ownRefererPath(headers) ?? (type ? FORM_PAGE_BY_TYPE[type] : STATIC_PATHS.home);

  const ip = clientIp(headers) ?? "sin-ip";
  if (!limiter.check(`lead|${ip}`).allowed) {
    leadLog("warn", "leads: límite por IP", {});
    return json
      ? jsonResponse(429, { ok: false, error: LEAD_MESSAGES.limite }, { "Retry-After": "600" })
      : seeOther(withError(backTo, "limite"), await formFlashCookie(tipo, fields));
  }

  // Honeypot (§2.7 regla 4): como si hubiera salido bien, sin guardar nada.
  if ((fields[HONEYPOT_FIELD] ?? "").trim() !== "") {
    leadLog("info", "leads: honeypot lleno, descartado", { type: tipo.slice(0, 20) });
    return json ? jsonResponse(200, { ok: true, message: LEAD_MESSAGES.ok }) : seeOther(thanks);
  }

  const validation = validateLead(fields);
  if (!validation.ok) {
    return json
      ? jsonResponse(422, { ok: false, errors: validation.errors })
      : seeOther(withError(backTo, Object.keys(validation.errors)[0]), await formFlashCookie(tipo, fields));
  }
  const sub = validation.value;
  const pagePath = sub.pagePath ?? ownRefererPath(headers);

  let saved;
  try {
    saved = await saveLead(
      { ...sub, pagePath },
      {
        headers,
        attribution: readAttribution(cookieValue(request, ATTRIBUTION_COOKIE)),
        pageUrl: pagePath ? `${env.siteUrl()}${pagePath}` : null,
      },
    );
  } catch (error) {
    leadLog("error", "leads: no se pudo guardar el lead", {
      type: sub.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return json ? jsonResponse(503, { ok: false, error: LEAD_MESSAGES.servidor }) : seeOther(withError(backTo, "servidor"), await formFlashCookie(tipo, fields));
  }

  if (!saved.duplicate) {
    schedule(async () => {
      try {
        await deliverLead(saved.leadId);
      } catch (error) {
        // El lead está guardado; el cron lo reintenta.
        leadLog("error", "crm: envío inmediato falló", {
          leadId: saved.leadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }
  return json ? jsonResponse(200, { ok: true, message: LEAD_MESSAGES.ok }) : seeOther(thanks);
}

/** Sólo pruebas. */
export function resetLeadRateLimitForTests(): void {
  limiter.reset();
}
