// POST /admin/moderacion/decision — aprobar o rechazar (ADMIN_SPEC.md §3).
// JSON desde el panel de la cola. withRole: sin sesión 401, otro rol 403.
import { withRole } from "@/lib/auth/session";
import { approveListing, MODERATION_ROLES, rejectListing } from "@/components/admin/moderation/decide";
import { json, readJson, sameHostOrigin } from "@/components/admin/moderation/http";
import { requestIpHash } from "@/components/admin/moderation/ip";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const POST = withRole([...MODERATION_ROLES], async (user, request) => {
  if (!sameHostOrigin(request.headers)) return json(403, { ok: false, error: "Origen no permitido." });
  const body = await readJson(request);
  const listingId = Number(body?.listingId);
  if (!body || !Number.isSafeInteger(listingId) || listingId <= 0) return json(400, { ok: false, error: "Pedido inválido." });
  const ipHash = requestIpHash(request.headers);
  const result =
    body.action === "approve"
      ? await approveListing(user, {
          listingId,
          modelId: body.modelId ? Number(body.modelId) : null,
          siteUrl: env.siteUrl(),
          ipHash,
        })
      : body.action === "reject"
        ? await rejectListing(user, { listingId, code: body.code, text: typeof body.text === "string" ? body.text : null, ipHash })
        : { ok: false as const, error: "Acción desconocida." };
  return json(result.ok ? 200 : 422, result);
});
