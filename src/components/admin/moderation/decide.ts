// Aprobar / rechazar (ADMIN_SPEC.md §3). Rol validado acá (admin, moderador)
// además del route handler: la función no confía en quien la llama. Todo
// cambio de estado pasa por `transition()` (activity_log en la misma transacción).
import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { listings, models, modelSuggestions } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertRole, type SessionUser } from "@/lib/auth/roles";
import { listingPublishProblem } from "@/components/admin/crud/authorization";
import { transition, TransitionError, type PublishProblem } from "@/lib/listings/state";
import { rotateManageToken } from "@/lib/manage-token";
import { absoluteUrl, paths } from "@/lib/seo/routes";
import {
  approvalMessage,
  dealerApprovalMessage,
  isRejectionCode,
  manageLinkPath,
  REJECTION_TEXT,
  rejectionMessage,
} from "./texts";

export const MODERATION_ROLES = ["admin", "moderator"] as const;

export type DecisionResult =
  | { ok: true; status: "published" | "rejected"; message: string; privateLink: boolean }
  | { ok: false; error: string; problems?: PublishProblem[] };

const PROBLEM_TEXT: Record<PublishProblem, string> = {
  image: "al menos una foto",
  price_or_installment: "precio o cuota",
  city: "ciudad",
  brand: "marca",
  model: "modelo del catálogo (mapealo arriba)",
  phone: "teléfono válido",
};

/** Mapea el modelo escrito a mano a uno del catálogo y resuelve la sugerencia, en un solo gesto. */
async function mapModel(user: SessionUser, listingId: number, modelId: number): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [l] = await tx.select({ brandId: listings.brandId, modelId: listings.modelId, engineCc: listings.engineCc }).from(listings).where(eq(listings.id, listingId)).for("update");
    if (!l) return "No existe la publicación.";
    const [m] = await tx
      .select({ id: models.id, engineCc: models.engineCc })
      .from(models)
      .where(and(eq(models.id, modelId), eq(models.brandId, l.brandId), eq(models.isActive, true)));
    if (!m) return "Ese modelo no es de la marca de la publicación.";
    if (l.modelId === m.id) return null;
    await tx
      .update(listings)
      .set({ modelId: m.id, engineCc: l.engineCc ?? m.engineCc, updatedBy: user.id })
      .where(eq(listings.id, listingId));
    await tx
      .update(modelSuggestions)
      .set({ status: "mapped", mappedModelId: m.id, resolvedBy: user.id })
      .where(and(eq(modelSuggestions.listingId, listingId), eq(modelSuggestions.status, "pending")));
    await logActivity(tx, {
      userId: user.id,
      entityType: "listing",
      entityId: listingId,
      action: "model_mapped",
      diff: { modelId: { from: l.modelId, to: m.id } },
    });
    return null;
  });
}

export async function approveListing(
  user: SessionUser | null,
  input: { listingId: number; modelId?: number | null; siteUrl: string; ipHash?: string | null },
): Promise<DecisionResult> {
  const actor = assertRole(user, MODERATION_ROLES);
  if (input.modelId) {
    const err = await mapModel(actor, input.listingId, input.modelId);
    if (err) return { ok: false, error: err };
  }
  // ADR-12: sin bloque de autorización del comercio no se publica (guarda de B7).
  const dealerProblem = await listingPublishProblem(input.listingId);
  if (dealerProblem) return { ok: false, error: dealerProblem };
  try {
    await transition({ listingId: input.listingId, action: "approve", actor: { kind: "user", user: actor, ipHash: input.ipHash ?? null } });
  } catch (error) {
    if (error instanceof TransitionError) {
      if (error.code === "requirements") {
        return { ok: false, error: `Para publicar falta: ${error.problems.map((p) => PROBLEM_TEXT[p]).join(", ")}.`, problems: error.problems };
      }
      return { ok: false, error: error.code === "invalid_state" ? "Ya no está en moderación (la resolvió otra persona)." : error.message };
    }
    throw error;
  }
  const [l] = await db
    .select({ title: listings.title, slug: listings.slug, publicRef: listings.publicRef, dealerId: listings.dealerId })
    .from(listings)
    .where(eq(listings.id, input.listingId));
  const listingUrl = absoluteUrl(paths.listing(l), input.siteUrl);
  if (l.dealerId !== null) {
    return { ok: true, status: "published", message: dealerApprovalMessage({ title: l.title, listingUrl }), privateLink: false };
  }
  // G-1: enlace privado del particular. El token sale sólo en esta respuesta; en la base queda su hash.
  const token = await rotateManageToken(input.listingId, { userId: actor.id, ipHash: input.ipHash ?? null });
  return {
    ok: true,
    status: "published",
    message: approvalMessage({ title: l.title, listingUrl, manageUrl: absoluteUrl(manageLinkPath(token), input.siteUrl) }),
    privateLink: true,
  };
}

export async function rejectListing(
  user: SessionUser | null,
  input: { listingId: number; code: unknown; text?: string | null; ipHash?: string | null },
): Promise<DecisionResult> {
  const actor = assertRole(user, MODERATION_ROLES);
  if (!isRejectionCode(input.code)) return { ok: false, error: "Elegí un motivo de rechazo." };
  const text = (input.text ?? "").trim().slice(0, 2000) || REJECTION_TEXT[input.code];
  // Un rechazo mudo es un vendedor perdido (T&S §4): siempre con texto.
  if (!text) return { ok: false, error: "Escribí qué tiene que corregir el vendedor." };
  try {
    await transition({
      listingId: input.listingId,
      action: "reject",
      actor: { kind: "user", user: actor, ipHash: input.ipHash ?? null },
      reason: { code: input.code, note: text },
    });
  } catch (error) {
    if (error instanceof TransitionError) {
      return { ok: false, error: error.code === "invalid_state" ? "Ya no está en moderación (la resolvió otra persona)." : error.message };
    }
    throw error;
  }
  const [l] = await db.select({ title: listings.title }).from(listings).where(eq(listings.id, input.listingId));
  return { ok: true, status: "rejected", message: rejectionMessage({ title: l.title, text }), privateLink: false };
}
