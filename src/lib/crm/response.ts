// Clasificación de la respuesta del CRM (INTEGRATIONS.md §2.6). Pura.
//
// Criterio: sólo es éxito lo que se puede demostrar. Un 2xx con un cuerpo que
// no es el del contrato (p. ej. una página HTML de un proxy mal configurado
// que responde 200) cuenta como fallo reintentable: como el reintento usa la
// misma idempotency_key, si el CRM sí lo había creado contesta
// `200 duplicate:true` y el lead queda bien. Nunca se marca `sent` algo que
// quizás no llegó.

export type CrmOutcome = "sent" | "duplicate" | "failed";

export type CrmClassification = {
  outcome: CrmOutcome;
  contactId: string | null;
  dealId: string | null;
  /** Texto para `leads.crm_last_error` (null si fue éxito). */
  error: string | null;
  /** Nivel del log estructurado. */
  level: "info" | "warn" | "error";
};

function parseJson(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim().slice(0, 100);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

const MAX_ERROR = 5000;

export function classifyCrmResponse(status: number, body: string): CrmClassification {
  const json = parseJson(body);
  const ids = { contactId: idOf(json?.contactId), dealId: idOf(json?.dealId) };
  const fail = (error: string, level: CrmClassification["level"] = "warn"): CrmClassification => ({
    outcome: "failed",
    contactId: null,
    dealId: null,
    error: error.slice(0, MAX_ERROR),
    level,
  });

  if (status === 201) {
    if (!json || (ids.contactId === null && idOf(json.submissionId) === null)) {
      return fail(`201 con cuerpo inesperado: ${body.slice(0, 500)}`);
    }
    return { outcome: "sent", ...ids, error: null, level: "info" };
  }
  if (status === 200) {
    if (json?.duplicate === true) return { outcome: "duplicate", ...ids, error: null, level: "info" };
    return fail(`200 sin duplicate:true: ${body.slice(0, 500)}`);
  }
  switch (status) {
    case 401:
      return fail("401: API key ausente o inválida. Revisar VENDERCRM_API_KEY (VenderCRM → Sitios).", "error");
    case 403:
      return fail("403: sitio desactivado o suscripción en sólo lectura. Revisar VenderCRM → Sitios / facturación.", "error");
    case 422:
      // El cuerpo entero: nombra el campo que falló (§2.6).
      return fail(`422: ${body}`, "error");
    case 429:
      return fail("429: límite de 60/min por sitio; se reintenta con backoff.");
    default:
      return fail(`${status}: ${body.slice(0, 1000)}`, status >= 500 ? "warn" : "error");
  }
}
