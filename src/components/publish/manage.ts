// /mi-aviso/<token> (G-1): el vendedor particular gestiona su publicación sin
// cuenta. Cada acción vuelve a verificar el token (A1) y pasa por
// `transition()` con el actor del enlace privado. Regla §3: fotos o
// descripción cambian → vuelve a moderación (`resubmit`); el precio no, pero
// queda como `price_changed`.
import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { brands, cities, listingImages, listings } from "@/db/schema";
import { diffFields, logActivity } from "@/lib/activity";
import { claimUploads, isValidDraftToken } from "@/lib/images/uploads";
import { editRequiresReview, transition, TransitionError, type TransitionAction } from "@/lib/listings/state";
import { findListingIdByManageToken } from "@/lib/manage-token";
import { getStorage } from "@/lib/storage";
import { contactInText } from "@/lib/import/validate";
import { amount, MAX_DESCRIPTION, MIN_DESCRIPTION } from "./validate";

export async function managedListing(token: string) {
  const id = await findListingIdByManageToken(token);
  if (id === null) return null;
  const [row] = await db
    .select({ l: listings, brandName: brands.name, cityName: cities.name })
    .from(listings)
    .innerJoin(brands, eq(brands.id, listings.brandId))
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .where(eq(listings.id, id));
  // Sólo publicaciones de particular (el enlace privado no aplica a comercios, A1).
  if (!row || row.l.dealerId !== null) return null;
  const storage = getStorage();
  const images = await db.select().from(listingImages).where(eq(listingImages.listingId, id)).orderBy(asc(listingImages.sortOrder), asc(listingImages.id));
  return { ...row, images: images.map((i) => ({ id: i.id, url: storage.url(i.storagePath) })) };
}

export type ManageResult = { ok: true; message: string } | { ok: false; error: string };

const ACTION_MESSAGES: Partial<Record<TransitionAction, string>> = {
  mark_sold: "Listo: quedó marcada como vendida. ¡Felicitaciones!",
  pause: "Pausada: no se muestra hasta que la reanudes.",
  resume: "Reanudada: se muestra de nuevo.",
  renew: "Renovada: se muestra de nuevo con un vencimiento nuevo.",
};

export async function manageAction(token: string, action: TransitionAction, ipHash: string | null): Promise<ManageResult> {
  if (!["mark_sold", "pause", "resume", "renew"].includes(action)) return { ok: false, error: "Acción no permitida." };
  const id = await findListingIdByManageToken(token);
  if (id === null) return { ok: false, error: "El enlace no es válido." };
  try {
    await transition({ listingId: id, action, actor: { kind: "manage_token", listingId: id, ipHash } });
    return { ok: true, message: ACTION_MESSAGES[action]! };
  } catch (error) {
    if (error instanceof TransitionError) return { ok: false, error: error.code === "invalid_state" ? "Esa acción no aplica al estado actual." : error.message };
    if ((error as { status?: number }).status === 403) return { ok: false, error: "No podés hacer eso con este enlace." };
    throw error;
  }
}

/**
 * Edición del vendedor. Precio/cuotas: se guardan y quedan registrados, sigue
 * publicada. Descripción o fotos: se guardan y, si estaba publicada, vuelve a
 * moderación (`resubmit`, §3 bait-and-switch).
 */
export async function manageEdit(
  token: string,
  input: { precio?: string; entrega?: string; cuota?: string; cuotas?: string; descripcion?: string; removeImageIds?: number[]; draftToken?: string | null; photoIds?: number[] },
  ipHash: string | null,
): Promise<ManageResult & { remoderation?: boolean }> {
  const id = await findListingIdByManageToken(token);
  if (id === null) return { ok: false, error: "El enlace no es válido." };
  const [l] = await db.select().from(listings).where(eq(listings.id, id));
  if (!l || l.dealerId !== null || l.deletedAt) return { ok: false, error: "El enlace no es válido." };
  if (l.status === "rejected") return { ok: false, error: "Esta publicación fue rechazada: publicala de nuevo desde /publicar." };

  const price = amount(input.precio);
  const down = amount(input.entrega);
  const inst = amount(input.cuota);
  const cnt = amount(input.cuotas);
  if ([price, down, inst, cnt].includes(null)) return { ok: false, error: "Los montos van sólo con números." };
  const priceGs = typeof price === "number" && price > 0 ? price : null;
  const plan = typeof inst === "number" && inst > 0 && typeof cnt === "number" && cnt > 0;
  if (!priceGs && !plan) return { ok: false, error: "Dejá el precio de contado o la cuota y cuántas cuotas." };
  const description = input.descripcion === undefined ? (l.description ?? "") : input.descripcion.trim().slice(0, MAX_DESCRIPTION);
  if (description.length < MIN_DESCRIPTION) return { ok: false, error: `La descripción necesita al menos ${MIN_DESCRIPTION} caracteres.` };
  if (contactInText(description)) return { ok: false, error: "Sacá el teléfono, el correo o los enlaces de la descripción." };

  const removeIds = (input.removeImageIds ?? []).filter((n) => Number.isSafeInteger(n));
  const set = {
    priceGs,
    hasFinancingOnly: !priceGs,
    downPaymentGs: plan && typeof down === "number" && down > 0 ? down : null,
    installmentGs: plan ? (inst as number) : null,
    installmentCount: plan ? (cnt as number) : null,
    description,
  };
  const diff = diffFields(l as Record<string, unknown>, set as Record<string, unknown>);
  const priceKeys = ["priceGs", "hasFinancingOnly", "downPaymentGs", "installmentGs", "installmentCount"];
  const priceDiff = Object.fromEntries(Object.entries(diff).filter(([k]) => priceKeys.includes(k)));

  let imagesChanged = false;
  await db.transaction(async (tx) => {
    if (Object.keys(diff).length) await tx.update(listings).set(set).where(eq(listings.id, id));
    if (removeIds.length) {
      const [res] = await tx.delete(listingImages).where(and(eq(listingImages.listingId, id), inArray(listingImages.id, removeIds)));
      imagesChanged = imagesChanged || res.affectedRows > 0;
    }
    if (input.draftToken && isValidDraftToken(input.draftToken)) {
      const claimed = await claimUploads(input.draftToken, id, { ids: input.photoIds?.length ? input.photoIds : undefined, tx });
      imagesChanged = imagesChanged || claimed > 0;
    }
    if (Object.keys(priceDiff).length) await logActivity(tx, { userId: null, entityType: "listing", entityId: id, action: "price_changed", diff: { via: "manage_token", ...priceDiff }, ipHash });
    if ("description" in diff || imagesChanged) {
      await logActivity(tx, { userId: null, entityType: "listing", entityId: id, action: "seller_edit", diff: { via: "manage_token", description: "description" in diff, images: imagesChanged }, ipHash });
    }
  });

  const needsReview = editRequiresReview(l, { description: "description" in diff, images: imagesChanged });
  if (needsReview) {
    await transition({ listingId: id, action: "resubmit", actor: { kind: "manage_token", listingId: id, ipHash } });
    return { ok: true, message: "Guardado. Como cambiaste fotos o descripción, la revisamos de nuevo antes de mostrarla (menos de 24 h).", remoderation: true };
  }
  return { ok: true, message: Object.keys(diff).length || imagesChanged ? "Guardado." : "No había cambios." };
}
