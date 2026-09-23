// Archivos de fotos de publicaciones borradas o rechazadas (KNOWN-ISSUES): a
// los 30 días se borran del disco y dejan de servirse en /media. Las filas de
// `listing_images` se quedan: su `content_hash` es la evidencia con la que
// moderación detecta fotos repetidas (TRUST_AND_SAFETY §2, señal de duplicados).
// Cada publicación se procesa una sola vez (`photos_purged` en activity_log).
// Un archivo compartido con una publicación que sigue viva no se toca.
import { and, eq, inArray, isNotNull, isNull, lt, notExists, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, listingImages, listings, pendingUploads } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { getStorage } from "@/lib/storage";
import type { JobFn } from "../runner";
import { filesForStoragePath } from "./purge-uploads";

export const REMOVED_PHOTO_RETENTION_DAYS = 30;
const BATCH = 100;

/** Borrada hace más de N días, o rechazada (sin tocar) hace más de N días. */
function removedBefore(cutoff: Date) {
  return or(
    and(isNotNull(listings.deletedAt), lt(listings.deletedAt, cutoff)),
    and(isNull(listings.deletedAt), eq(listings.status, "rejected"), lt(listings.updatedAt, cutoff)),
  );
}

export const purgeRemovedPhotos: JobFn = async ({ now }) => {
  const cutoff = new Date(now.getTime() - REMOVED_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const storage = getStorage();
  let listingsDone = 0;
  let files = 0;
  let kept = 0;

  for (;;) {
    const batch = await db
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          removedBefore(cutoff),
          sql`exists (select 1 from ${listingImages} where ${listingImages.listingId} = ${listings.id})`,
          notExists(
            db
              .select({ one: sql`1` })
              .from(activityLog)
              .where(and(eq(activityLog.entityType, "listing"), eq(activityLog.entityId, listings.id), eq(activityLog.action, "photos_purged"))),
          ),
        ),
      )
      .limit(BATCH);
    if (batch.length === 0) break;
    const ids = batch.map((b) => b.id);

    const images = await db.select({ listingId: listingImages.listingId, path: listingImages.storagePath }).from(listingImages).where(inArray(listingImages.listingId, ids));
    const paths = [...new Set(images.map((i) => i.path))];
    // ¿Otra publicación que NO está para borrar, o un borrador, usa la misma foto?
    const sharedLive = paths.length
      ? await db
          .select({ path: listingImages.storagePath })
          .from(listingImages)
          .innerJoin(listings, eq(listings.id, listingImages.listingId))
          .where(and(inArray(listingImages.storagePath, paths), notInArray(listingImages.listingId, ids), sql`not (${removedBefore(cutoff)})`))
      : [];
    const sharedPending = paths.length ? await db.select({ path: pendingUploads.storagePath }).from(pendingUploads).where(inArray(pendingUploads.storagePath, paths)) : [];
    const keep = new Set([...sharedLive, ...sharedPending].map((r) => r.path));

    const perListing = new Map<number, number>();
    for (const img of images) {
      if (keep.has(img.path)) {
        kept++;
        continue;
      }
      for (const file of filesForStoragePath(img.path)) {
        await storage.delete(file);
        files++;
        perListing.set(img.listingId, (perListing.get(img.listingId) ?? 0) + 1);
      }
    }
    for (const id of ids) {
      await logActivity(db, { userId: null, entityType: "listing", entityId: id, action: "photos_purged", diff: { files: perListing.get(id) ?? 0 } });
    }
    listingsDone += ids.length;
    if (batch.length < BATCH) break;
  }

  return { listings: listingsDone, deletedFiles: files, keptShared: kept, cutoff: cutoff.toISOString() };
};
