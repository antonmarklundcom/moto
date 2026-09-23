// POST /admin/denuncias/resolver — descartar, pausar o dar de baja (ADMIN_SPEC.md §10).
import { withRole } from "@/lib/auth/session";
import { MODERATION_ROLES } from "@/components/admin/moderation/decide";
import { json, readJson, sameHostOrigin } from "@/components/admin/moderation/http";
import { requestIpHash } from "@/components/admin/moderation/ip";
import { resolveReport } from "@/components/admin/moderation/reports-admin";

export const dynamic = "force-dynamic";

export const POST = withRole([...MODERATION_ROLES], async (user, request) => {
  if (!sameHostOrigin(request.headers)) return json(403, { ok: false, error: "Origen no permitido." });
  const body = await readJson(request);
  const reportId = Number(body?.reportId);
  if (!body || !Number.isSafeInteger(reportId) || reportId <= 0) return json(400, { ok: false, error: "Pedido inválido." });
  const result = await resolveReport(user, { reportId, action: body.action, note: body.note, ipHash: requestIpHash(request.headers) });
  return json(result.ok ? 200 : 422, result);
});
