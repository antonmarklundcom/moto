// Utilidades de los route handlers de moderación.

/** Origin del mismo host que el pedido (el panel siempre lo manda en un fetch POST). */
export function sameHostOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || origin === "null" || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}

export function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Lee un cuerpo JSON chico; `null` si no es un objeto. */
export async function readJson(request: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get("content-length") ?? "0") > maxBytes) return null;
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
