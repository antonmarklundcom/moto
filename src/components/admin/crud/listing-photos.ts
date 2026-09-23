// Fotos de una publicación desde el admin (KNOWN-ISSUES): borrar, subir o bajar
// y elegir portada (la primera por `sort_order`). Admin y moderador; el rol se
// valida acá, no en la pantalla. Borrar la última foto de una publicación
// visible no se permite: la ficha quedaría sin imagen.
import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { listingImages, listings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertRole, type SessionUser } from "@/lib/auth/roles";
import { deleteUnreferencedImageFiles } from "@/lib/images/cleanup";
import { parseVariantPath, variantPath } from "@/lib/images/variants";
import { getStorage } from "@/lib/storage";
import { reorder } from "./listing-photos-order";

export const PHOTO_ROLES = ["admin", "moderator"] as const;
export type PhotoAction = "delete" | "up" | "down" | "cover";
export type PhotoResult = { ok: true } | { ok: false; error: string };

const VISIBLE = new Set(["published", "paused", "sold", "expired", "pending_review"]);

/** Miniatura: la variante más chica si la foto sigue el esquema de variantes. */
export function thumbPath(storagePath: string): string {
  const set = parseVariantPath(storagePath);
  return set ? variantPath(set.prefix, set.widths[0]) : storagePath;
}

export async function listingPhotos(user: SessionUser, listingId: number) {
  assertRole(user, PHOTO_ROLES);
  const rows = await db
    .select({ id: listingImages.id, storagePath: listingImages.storagePath, sortOrder: listingImages.sortOrder, isCatalogPhoto: listingImages.isCatalogPhoto })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId))
    .orderBy(asc(listingImages.sortOrder), asc(listingImages.id));
  const storage = getStorage();
  return rows.map((r) => ({ ...r, thumbUrl: storage.url(thumbPath(r.storagePath)) }));
}

export async function photoAction(user: SessionUser, listingId: number, imageId: number, action: PhotoAction): Promise<PhotoResult> {
  assertRole(user, PHOTO_ROLES);
  const [listing] = await db.select({ id: listings.id, status: listings.status }).from(listings).where(eq(listings.id, listingId));
  if (!listing) return { ok: false, error: "No existe la publicación." };
  const rows = await db
    .select({ id: listingImages.id, storagePath: listingImages.storagePath })
    .from(listingImages)
    .where(eq(listingImages.listingId, listingId))
    .orderBy(asc(listingImages.sortOrder), asc(listingImages.id));
  const target = rows.find((r) => r.id === imageId);
  if (!target) return { ok: false, error: "Esa foto no es de esta publicación." };

  if (action === "delete") {
    if (rows.length === 1 && VISIBLE.has(listing.status)) return { ok: false, error: "Es la única foto: subí otra antes de borrarla." };
    await db.transaction(async (tx) => {
      await tx.delete(listingImages).where(and(eq(listingImages.id, imageId), eq(listingImages.listingId, listingId)));
      await logActivity(tx, { userId: user.id, entityType: "listing", entityId: listingId, action: "photo_deleted", diff: { imageId } });
    });
    await deleteUnreferencedImageFiles([target.storagePath]);
    return { ok: true };
  }

  const order = reorder(rows.map((r) => r.id), imageId, action);
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) {
      await tx.update(listingImages).set({ sortOrder: i }).where(and(eq(listingImages.id, id), eq(listingImages.listingId, listingId)));
    }
    await logActivity(tx, { userId: user.id, entityType: "listing", entityId: listingId, action: "photos_reordered", diff: { imageId, action } });
  });
  return { ok: true };
}
