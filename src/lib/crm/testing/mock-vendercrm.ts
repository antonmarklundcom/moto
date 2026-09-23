// Servidor falso de VenderCRM para pruebas (A4 paso 6). Nunca se importa
// desde código de la app. Implementa el contrato de INTEGRATIONS.md §2.3/§2.6
// lo bastante fiel como para que las pruebas fallen si el payload se sale de
// él: key, obligatorios, largos, email vacío, claves de enrutamiento
// prohibidas e idempotencia (replay → 200 duplicate:true con los mismos ids).
//
// Además se le pueden encolar respuestas forzadas: cualquier código, cuerpo
// mal formado o una demora mayor al timeout del cliente.
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type ForcedResponse = {
  status?: number;
  /** Se envía tal cual (permite cuerpos mal formados). */
  rawBody?: string;
  body?: unknown;
  /** Demora antes de responder. Mayor al timeout del cliente = timeout. */
  delayMs?: number;
};

export type ReceivedRequest = {
  apiKey: string | null;
  contentType: string | null;
  body: Record<string, unknown> | null;
  rawBody: string;
  status: number;
};

export type MockVenderCrm = {
  url: string;
  apiKey: string;
  requests: ReceivedRequest[];
  /** Contactos creados de verdad (201), por idempotency_key. */
  created: Map<string, { contactId: string; dealId: string; submissionId: string }>;
  enqueue(...responses: ForcedResponse[]): void;
  reset(): void;
  close(): Promise<void>;
};

const OPTIONAL_LIMITS: Record<string, number> = {
  name: 200,
  email: 320,
  message: 5000,
  source: 100,
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_term: 200,
  utm_content: 200,
  gclid: 200,
  fbclid: 200,
  page_url: 2000,
  referrer: 2000,
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Valida como el CRM real; devuelve el campo que falla o null. */
export function validateLikeCrm(body: Record<string, unknown>): { field: string; message: string } | null {
  for (const forbidden of ["pipeline", "stage", "owner", "tag"]) {
    if (forbidden in body) return { field: forbidden, message: "campo no permitido" };
  }
  const phone = body.phone;
  if (typeof phone !== "string" || phone.length < 6 || phone.length > 30) return { field: "phone", message: "requerido, 6–30" };
  const key = body.idempotency_key;
  if (typeof key !== "string" || key.length < 8 || key.length > 100) {
    return { field: "idempotency_key", message: "requerido, 8–100" };
  }
  for (const [field, max] of Object.entries(OPTIONAL_LIMITS)) {
    if (!(field in body)) continue;
    const v = body[field];
    if (typeof v !== "string" || v.length > max) return { field, message: `texto ≤ ${max}` };
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { field, message: "email inválido" };
  }
  if ("fields" in body && (typeof body.fields !== "object" || body.fields === null || Array.isArray(body.fields))) {
    return { field: "fields", message: "debe ser un objeto" };
  }
  return null;
}

export async function startMockVenderCrm(apiKey = "clave-de-prueba-del-sitio"): Promise<MockVenderCrm> {
  const queue: ForcedResponse[] = [];
  const requests: ReceivedRequest[] = [];
  const created = new Map<string, { contactId: string; dealId: string; submissionId: string }>();
  let seq = 0;

  const server: Server = createServer(async (req, res) => {
    const rawBody = await readBody(req);
    let body: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    } catch {
      body = null;
    }
    const record: ReceivedRequest = {
      apiKey: (req.headers["x-api-key"] as string | undefined) ?? null,
      contentType: req.headers["content-type"] ?? null,
      body,
      rawBody,
      status: 0,
    };
    requests.push(record);

    const send = (status: number, payload: string) => {
      record.status = status;
      if (res.destroyed) return;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(payload);
    };

    const forced = queue.shift();
    if (forced) {
      if (forced.delayMs) await new Promise((r) => setTimeout(r, forced.delayMs));
      const payload = forced.rawBody ?? JSON.stringify(forced.body ?? {});
      send(forced.status ?? 200, payload);
      return;
    }

    if (req.method !== "POST" || req.url !== "/api/v1/leads") return send(404, JSON.stringify({ error: "not_found" }));
    if (record.apiKey !== apiKey) return send(401, JSON.stringify({ error: "invalid_api_key" }));
    if (!body) return send(422, JSON.stringify({ error: "validation", field: "body", message: "JSON inválido" }));
    const invalid = validateLikeCrm(body);
    if (invalid) return send(422, JSON.stringify({ error: "validation", ...invalid }));

    const key = body.idempotency_key as string;
    const existing = created.get(key);
    if (existing) return send(200, JSON.stringify({ ...existing, duplicate: true }));
    seq += 1;
    const ids = { contactId: `c_${seq}`, dealId: `d_${seq}`, submissionId: `s_${seq}` };
    created.set(key, ids);
    return send(201, JSON.stringify({ ...ids, duplicate: false }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    apiKey,
    requests,
    created,
    enqueue: (...responses) => queue.push(...responses),
    reset() {
      queue.length = 0;
      requests.length = 0;
      created.clear();
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
