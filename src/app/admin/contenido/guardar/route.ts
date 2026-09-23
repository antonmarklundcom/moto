// POST /admin/contenido/guardar — alta y edición de guías (ADMIN_SPEC §9).
// Publicar sin `reviewed_by` → 400, aunque el pedido no venga de la pantalla.
import { withRole } from "@/lib/auth/session";
import { json, sameHostOrigin } from "@/components/admin/moderation/http";
import { CONTENT_ROLES, savePost } from "../_lib/content-admin";

export const dynamic = "force-dynamic";

export const POST = withRole([...CONTENT_ROLES], async (user, request) => {
  if (!sameHostOrigin(request.headers)) return json(403, { ok: false, error: "Origen no permitido." });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, error: "Pedido inválido." });
  }
  const s = (k: string) => String(form.get(k) ?? "");
  const reviewedBy = Number(s("reviewedBy"));
  const result = await savePost(user, {
    id: Number(s("id")) || null,
    title: s("title"),
    slug: s("slug"),
    excerpt: s("excerpt"),
    bodyHtml: s("bodyHtml"),
    metaTitle: s("metaTitle"),
    metaDescription: s("metaDescription"),
    status: s("status"),
    reviewedBy: Number.isSafeInteger(reviewedBy) && reviewedBy > 0 ? reviewedBy : null,
  });
  return result.ok ? json(200, result) : json(result.status, result);
});
