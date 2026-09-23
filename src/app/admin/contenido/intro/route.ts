// POST /admin/contenido/intro — guarda `intro_html` de una marca, modelo,
// tipo o ciudad y devuelve el indicador de indexabilidad recalculado.
import { withRole } from "@/lib/auth/session";
import { json, readJson, sameHostOrigin } from "@/components/admin/moderation/http";
import { CONTENT_ROLES, saveIntro } from "../_lib/content-admin";

export const dynamic = "force-dynamic";

export const POST = withRole([...CONTENT_ROLES], async (user, request) => {
  if (!sameHostOrigin(request.headers)) return json(403, { ok: false, error: "Origen no permitido." });
  const body = await readJson(request, 128 * 1024);
  const id = Number(body?.id);
  if (!body || !Number.isSafeInteger(id) || id <= 0 || typeof body.html !== "string") return json(400, { ok: false, error: "Pedido inválido." });
  const result = await saveIntro(user, String(body.kind), id, body.html);
  return result.ok ? json(200, result) : json(result.status, result);
});
