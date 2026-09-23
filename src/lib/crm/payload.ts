// Payload de POST {VENDERCRM_URL}/api/v1/leads (INTEGRATIONS.md §2.3–§2.5).
// Módulo puro: sin entorno ni base, para poder probarlo en unitarias
// (TEST_PLAN.md §2 punto 4).
//
// Reglas que este módulo garantiza, pase lo que pase en la entrada:
// - `phone` e `idempotency_key` siempre presentes y válidos (si no, lanza).
// - Los opcionales vacíos se OMITEN: `email: ""` falla la validación del CRM.
// - Nunca `pipeline`, `stage`, `owner` ni `tag`: el enrutamiento vive en el
//   registro del sitio dentro del CRM. No existen en el tipo y además se
//   descartan en tiempo de ejecución si alguien los mete en `fields`.
// - Largos máximos del contrato: se recortan en vez de fallar (un nombre de
//   250 caracteres no puede costar un lead).

export const CRM_SOURCE = "site:moto-com-py";

/** Claves que nunca viajan al CRM, ni en la raíz ni dentro de `fields`. */
export const FORBIDDEN_CRM_KEYS: ReadonlySet<string> = new Set(["pipeline", "stage", "owner", "tag", "tags"]);

export type CrmFieldValue = string | number | boolean;

export type CrmLeadInput = {
  phoneE164: string;
  idempotencyKey: string;
  name?: string | null;
  email?: string | null;
  message?: string | null;
  source?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  pageUrl?: string | null;
  referrer?: string | null;
  fields?: Record<string, CrmFieldValue | null | undefined> | null;
};

/** El cuerpo exacto que se envía. Sin claves de enrutamiento, por construcción. */
export type CrmLeadPayload = {
  phone: string;
  idempotency_key: string;
  name?: string;
  email?: string;
  message?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  page_url?: string;
  referrer?: string;
  fields?: Record<string, CrmFieldValue>;
};

const LIMITS = {
  name: 200,
  email: 320,
  message: 5000,
  source: 100,
  utm: 200,
  clickId: 200,
  url: 2000,
  fieldString: 1000,
} as const;

function clean(value: string | null | undefined, max: number): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  if (trimmed === "") return undefined;
  return trimmed.slice(0, max);
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanFields(fields: CrmLeadInput["fields"]): Record<string, CrmFieldValue> | undefined {
  if (!fields) return undefined;
  const out: Record<string, CrmFieldValue> = {};
  for (const [key, raw] of Object.entries(fields)) {
    if (FORBIDDEN_CRM_KEYS.has(key.toLowerCase())) continue;
    if (raw === null || raw === undefined) continue;
    if (typeof raw === "string") {
      const v = clean(raw, LIMITS.fieldString);
      if (v !== undefined) out[key] = v;
    } else if (typeof raw === "number") {
      if (Number.isFinite(raw)) out[key] = raw;
    } else if (typeof raw === "boolean") {
      out[key] = raw;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Arma el payload. Lanza sólo si falta lo obligatorio (teléfono E.164 o clave
 * de idempotencia de 8–100 caracteres): eso es un error de programación, no
 * del visitante, porque el lead ya pasó por la validación.
 */
export function buildCrmPayload(input: CrmLeadInput): CrmLeadPayload {
  const phone = input.phoneE164?.trim() ?? "";
  if (phone.length < 6 || phone.length > 30) {
    throw new Error(`buildCrmPayload: teléfono inválido: "${phone}"`);
  }
  const key = input.idempotencyKey?.trim() ?? "";
  if (key.length < 8 || key.length > 100) {
    throw new Error("buildCrmPayload: idempotency_key fuera de 8–100 caracteres");
  }

  const email = clean(input.email, LIMITS.email);
  const candidate: Record<string, unknown> = {
    phone,
    idempotency_key: key,
    name: clean(input.name, LIMITS.name),
    // Un email que no parsea se omite: el CRM lo rechazaría con 422 y
    // perderíamos el lead entero por un dato opcional.
    email: email && EMAIL_PATTERN.test(email) ? email : undefined,
    message: clean(input.message, LIMITS.message),
    source: clean(input.source ?? CRM_SOURCE, LIMITS.source),
    utm_source: clean(input.utmSource, LIMITS.utm),
    utm_medium: clean(input.utmMedium, LIMITS.utm),
    utm_campaign: clean(input.utmCampaign, LIMITS.utm),
    utm_term: clean(input.utmTerm, LIMITS.utm),
    utm_content: clean(input.utmContent, LIMITS.utm),
    gclid: clean(input.gclid, LIMITS.clickId),
    fbclid: clean(input.fbclid, LIMITS.clickId),
    page_url: clean(input.pageUrl, LIMITS.url),
    referrer: clean(input.referrer, LIMITS.url),
    fields: cleanFields(input.fields),
  };

  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(candidate)) {
    if (v !== undefined && !FORBIDDEN_CRM_KEYS.has(k)) payload[k] = v;
  }
  return payload as CrmLeadPayload;
}
