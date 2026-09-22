// POST /api/uploads — una foto del paso 1 de /publicar (T-108, G-2).
// multipart/form-data con `file` y, desde la segunda foto, `draftToken`. Sin
// token, se crea uno y se devuelve: el navegador lo guarda con el borrador.
// Público (el vendedor no tiene cuenta): lo acotan el límite por IP, el tope
// de fotos por borrador y la purga de lo no reclamado.
import { MAX_UPLOAD_BYTES, UploadError } from "@/lib/images/process";
import { BodyTooLargeError, readBodyCapped } from "@/lib/images/read-body";
import { isValidDraftToken, newDraftToken, storeDraftUpload } from "@/lib/images/uploads";
import { uploadLimiter } from "@/lib/images/upload-limiter";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Margen para las cabeceras multipart y el campo del token.
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function fail(status: number, error: string, message: string, headers?: Record<string, string>): Response {
  return json(status, { error, message }, headers);
}

export async function POST(request: Request): Promise<Response> {
  const limit = uploadLimiter.check(`upload|${clientIp(request.headers) ?? "unknown"}`);
  if (!limit.allowed) {
    return fail(429, "rate_limited", "Subiste muchas fotos seguidas. Esperá unos minutos y probá de nuevo.", {
      "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return fail(400, "bad_request", "Mandá la foto como formulario (multipart/form-data).");
  }

  let form: FormData;
  try {
    const body = await readBodyCapped(request, MAX_BODY_BYTES);
    form = await new Response(new Uint8Array(body), { headers: { "content-type": contentType } }).formData();
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return fail(413, "too_large", "La foto pesa demasiado. Probá con una de menos de 12 MB.");
    }
    return fail(400, "bad_request", "No pudimos leer el envío. Probá de nuevo.");
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return fail(400, "no_file", "Elegí una foto para subir.");
  }

  const sent = form.get("draftToken");
  let draftToken: string;
  if (sent === null || sent === "") {
    draftToken = newDraftToken();
  } else if (isValidDraftToken(sent)) {
    draftToken = sent;
  } else {
    return fail(400, "bad_draft_token", "El borrador no es válido. Recargá la página y probá de nuevo.");
  }

  try {
    const stored = await storeDraftUpload(draftToken, Buffer.from(await file.arrayBuffer()));
    return json(stored.duplicate ? 200 : 201, {
      id: stored.id,
      url: stored.url,
      width: stored.width,
      height: stored.height,
      duplicate: stored.duplicate,
      draftToken,
    });
  } catch (error) {
    if (error instanceof UploadError) return fail(error.status, error.code, error.message);
    console.error(
      JSON.stringify({ level: "error", msg: "uploads: fallo al guardar", error: error instanceof Error ? error.message : String(error) }),
    );
    return fail(500, "server_error", "No pudimos guardar la foto. Probá de nuevo en un momento.");
  }
}
