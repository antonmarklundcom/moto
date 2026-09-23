// POST /admin/importar/fotos — una foto del stock importado (G-18). La manda
// el cargador del admin, de a una: el middleware del panel corta cuerpos de
// más de 10 MB, así que un zip grande va por la CLI.
import { withRole } from "@/lib/auth/session";
import { MAX_UPLOAD_BYTES } from "@/lib/images/process";
import { BodyTooLargeError, readBodyCapped } from "@/lib/images/read-body";
import { attachPhoto, photoCandidates } from "@/lib/import/photos";
import { PHOTO_EXTENSIONS } from "@/lib/import/photo-names";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Tope del middleware de Next (10 MB) con margen para el multipart.
const MAX_BODY_BYTES = Math.min(MAX_UPLOAD_BYTES, 10 * 1024 * 1024 - 64 * 1024);

/**
 * El cargador siempre manda Origin: tiene que ser este mismo host (como
 * chequean las server actions de Next). Sin Origin, o de otro sitio: 403.
 */
function sameHostOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || origin === "null" || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const POST = withRole(["admin"], async (user, request) => {
  if (!sameHostOrigin(request.headers)) {
    return json(403, { error: "forbidden", message: "Origen no permitido." });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return json(400, { error: "bad_request", message: "Mandá la foto como formulario." });
  }
  let form: FormData;
  try {
    const body = await readBodyCapped(request, MAX_BODY_BYTES);
    form = await new Response(new Uint8Array(body), { headers: { "content-type": contentType } }).formData();
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return json(413, { error: "too_large", message: "La foto pesa más de 10 MB. Achicala o cargala con la CLI." });
    }
    return json(400, { error: "bad_request", message: "No pudimos leer el envío." });
  }
  const file = form.get("file");
  const name = String(form.get("name") ?? (file instanceof File ? file.name : ""));
  if (!(file instanceof Blob) || file.size === 0 || !name) return json(400, { error: "no_file", message: "Falta la foto." });
  if (!PHOTO_EXTENSIONS.test(name)) return json(415, { error: "unsupported_type", message: "Sólo fotos JPG, PNG o WebP." });

  const dealerNum = Number(form.get("comercio"));
  const dealerId = Number.isSafeInteger(dealerNum) && dealerNum > 0 ? dealerNum : null;
  const candidates = await photoCandidates(dealerId);
  const outcome = await attachPhoto({
    fileName: name,
    data: Buffer.from(await file.arrayBuffer()),
    candidates,
    source: { kind: "admin", userId: user.id },
  });
  return json(outcome.ok ? 200 : 422, outcome);
});
