// Stock importado y `auto_approve` (ADR-09, BUILD_PLAN.md §5.2 B8): si el
// comercio tiene auto-aprobación, la publicación pasa sola a `published` por
// la máquina de estados (actor sistema); si no, queda en la cola de moderación.
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { dealers, listingImages, listings } from "@/db/schema";
import { publishProblems, transition, TransitionError, type PublishProblem } from "@/lib/listings/state";

export type AutoPublishResult =
  | { status: "published" }
  | { status: "pending_review"; reason: "no_auto_approve" | "catalog_photo_only" | "requirements"; problems?: PublishProblem[] }
  | { status: string; reason: "not_pending" };

const PROBLEM_TEXT: Record<PublishProblem, string> = {
  image: "falta al menos una foto",
  price_or_installment: "falta precio o cuota",
  city: "falta la ciudad",
  brand: "falta la marca",
  model: "el modelo no está en el catálogo",
  phone: "el teléfono no es válido",
};

export const STATUS_LABEL: Readonly<Record<string, string>> = {
  draft: "borrador",
  pending_review: "en moderación",
  published: "publicada",
  paused: "pausada",
  sold: "vendida",
  expired: "vencida",
  rejected: "rechazada",
};

export function describeAutoPublish(result: AutoPublishResult): string {
  if (!("reason" in result)) return "Publicada.";
  switch (result.reason) {
    case "no_auto_approve":
      return "En moderación (el comercio no tiene auto-aprobación).";
    case "catalog_photo_only":
      return "En moderación: una usada necesita al menos una foto real de la unidad, no sólo de catálogo.";
    case "requirements":
      return `En moderación: ${(result.problems ?? []).map((p) => PROBLEM_TEXT[p]).join(", ")}.`;
    case "not_pending":
      return `Estado: ${STATUS_LABEL[result.status] ?? result.status}.`;
  }
}

/** Publica una publicación importada en `pending_review` si su comercio lo permite y cumple las reglas. */
export async function autoPublishIfAllowed(listingId: number, job = "import"): Promise<AutoPublishResult> {
  const [row] = await db
    .select({
      status: listings.status,
      condition: listings.condition,
      autoApprove: dealers.autoApprove,
      priceGs: listings.priceGs,
      installmentGs: listings.installmentGs,
      cityId: listings.cityId,
      brandId: listings.brandId,
      modelId: listings.modelId,
      contactPhoneE164: listings.contactPhoneE164,
    })
    .from(listings)
    .innerJoin(dealers, eq(dealers.id, listings.dealerId))
    .where(eq(listings.id, listingId));
  if (!row) throw new Error(`autoPublishIfAllowed: la publicación ${listingId} no es de un comercio`);
  if (row.status !== "pending_review") return { status: row.status, reason: "not_pending" };
  if (!row.autoApprove) return { status: "pending_review", reason: "no_auto_approve" };

  const images = await db
    .select({ isCatalogPhoto: listingImages.isCatalogPhoto })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId));
  const problems = publishProblems(row, images.length);
  if (problems.length) return { status: "pending_review", reason: "requirements", problems };
  // Checklist (TRUST_AND_SAFETY.md §3): foto de catálogo sólo vale para 0 km.
  if (row.condition === "used" && images.every((i) => i.isCatalogPhoto)) {
    return { status: "pending_review", reason: "catalog_photo_only" };
  }

  try {
    await transition({ listingId, action: "approve", actor: { kind: "system", job } });
    return { status: "published" };
  } catch (error) {
    if (error instanceof TransitionError && error.code === "requirements") {
      return { status: "pending_review", reason: "requirements", problems: error.problems };
    }
    if (error instanceof TransitionError && error.code === "invalid_state") {
      const [now] = await db.select({ status: listings.status }).from(listings).where(and(eq(listings.id, listingId)));
      return { status: now?.status ?? "unknown", reason: "not_pending" };
    }
    throw error;
  }
}
