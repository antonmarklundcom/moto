// POST /api/reportes — denuncia de una publicación (T-118, TRUST_AND_SAFETY.md §5).
// JSON → JSON; formulario sin JS → 303 de vuelta a la ficha con el resultado.
import { submitReport } from "@/components/listing/reports";
import { env } from "@/lib/env";
import { jsonResponse, ownRefererPath } from "@/lib/leads/http";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 16 * 1024;

/**
 * Origin ausente, o del mismo host que el pedido (como las server actions de
 * Next). No se compara con SITE_URL: con otro host o puerto (staging, E2E) el
 * formulario sin JS de la ficha quedaría bloqueado.
 */
function sameHostOrAbsent(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin || origin === "null") return true;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameHostOrAbsent(request.headers)) return jsonResponse(403, { error: "Solicitud no válida." });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return jsonResponse(413, { error: "La denuncia es demasiado larga." });

  const type = request.headers.get("content-type") ?? "";
  const isJson = type.includes("application/json");
  let fields: Record<string, string>;
  try {
    if (isJson) {
      const body = (await request.json()) as Record<string, unknown>;
      fields = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? v : ""]));
    } else {
      const form = await request.formData();
      fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
    }
  } catch {
    return jsonResponse(400, { error: "No pudimos leer la denuncia." });
  }

  let salt: string | null = null;
  try {
    salt = env.ipHashSalt();
  } catch {
    salt = null;
  }
  const result = await submitReport({
    ref: fields.ref ?? "",
    reason: fields.motivo,
    detail: fields.detalle,
    phone: fields.telefono,
    honeypot: fields.website,
    ip: clientIp(request.headers),
    salt,
  });

  if (isJson) {
    return result.ok
      ? jsonResponse(200, { ok: true, message: "Recibimos tu denuncia y la vamos a revisar." })
      : jsonResponse(result.status, { error: result.error, field: result.field });
  }
  // Sin JS: de vuelta a la ficha (sólo a una ruta del sitio) con el resultado.
  // Location relativa: vale detrás de cualquier proxy, host o puerto.
  // La ficha manda su propia ruta (`volver`); sólo se acepta una ruta de ficha.
  const back = fields.volver ?? ownRefererPath(request.headers) ?? "";
  const target = /^\/aviso\/[a-z0-9-]+$/.test(back) ? back : "/";
  const flag = result.ok ? "denuncia=ok" : `denuncia=error&campo=${encodeURIComponent(result.ok ? "" : (result.field ?? "general"))}`;
  return new Response(null, {
    status: 303,
    headers: { Location: `${target}?${flag}#denunciar`, "Cache-Control": "no-store" },
  });
}
