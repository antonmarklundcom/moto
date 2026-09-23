// Cliente HTTP de VenderCRM (INTEGRATIONS.md §2). Sólo servidor: la key vive
// en el entorno y nunca llega al navegador (§2.1).
//
// `postLeadToCrm` nunca lanza: devuelve el resultado del intento (con el
// código HTTP, el cuerpo y la duración) para que quien llama escriba la fila
// de `lead_deliveries` y actualice el lead.
import "server-only";

import { env } from "@/lib/env";
import type { CrmLeadPayload } from "./payload";
import { classifyCrmResponse, type CrmClassification } from "./response";

export const CRM_TIMEOUT_MS = 10_000;
/** Tope del cuerpo guardado en `lead_deliveries.response_body` (TEXT = 64 KB). */
export const MAX_STORED_BODY = 15_000; // caracteres: hasta 4 bytes c/u en utf8mb4

export type CrmConfig = { url: string; apiKey: string };

/** `null` si falta la URL o la key (S-6): el lead queda `pending`. */
export function crmConfigFromEnv(): CrmConfig | null {
  const url = env.vendercrmUrl();
  const apiKey = env.vendercrmApiKey();
  if (!url || !apiKey) return null;
  return { url, apiKey };
}

export type CrmAttempt = CrmClassification & {
  /** `null` = no hubo respuesta HTTP (timeout, red, URL inválida). */
  httpStatus: number | null;
  responseBody: string;
  durationMs: number;
};

export type PostOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export async function postLeadToCrm(
  config: CrmConfig,
  payload: CrmLeadPayload,
  options: PostOptions = {},
): Promise<CrmAttempt> {
  const started = Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${config.url}/api/v1/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Api-Key": config.apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeoutMs ?? CRM_TIMEOUT_MS),
      cache: "no-store",
      redirect: "error",
    });
    const body = await response.text();
    return {
      ...classifyCrmResponse(response.status, body),
      httpStatus: response.status,
      responseBody: body.slice(0, MAX_STORED_BODY),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : String(error);
    const reason = name === "TimeoutError" || name === "AbortError" ? "timeout" : "red";
    const text = `${reason}: ${message}`.slice(0, 2000);
    return {
      outcome: "failed",
      contactId: null,
      dealId: null,
      error: text,
      level: "warn",
      httpStatus: null,
      responseBody: text,
      durationMs: Date.now() - started,
    };
  }
}
