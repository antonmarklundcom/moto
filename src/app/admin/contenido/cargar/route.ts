// POST /admin/contenido/cargar — carga los borradores de content/guias como
// guías en `draft` (sólo admin). Nunca pisa una guía existente.
import { withRole } from "@/lib/auth/session";
import { json, sameHostOrigin } from "@/components/admin/moderation/http";
import { loadGuideDrafts } from "../_lib/content-admin";

export const dynamic = "force-dynamic";

export const POST = withRole(["admin"], async (user, request) => {
  if (!sameHostOrigin(request.headers)) return json(403, { ok: false, error: "Origen no permitido." });
  const r = await loadGuideDrafts(user);
  const q = new URLSearchParams({ cargadas: String(r.created.length), omitidas: String(r.skipped.length) });
  if (r.failed.length) q.set("error", r.failed.join(" · ").slice(0, 500));
  return new Response(null, { status: 303, headers: { Location: `/admin/contenido?${q.toString()}`, "Cache-Control": "no-store" } });
});
