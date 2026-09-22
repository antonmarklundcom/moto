// Purga de fotos de borradores nunca enviados (DATABASE_SCHEMA.md §2.15):
// filas de `pending_uploads` sin reclamar con más de 7 días, y sus archivos.
// Un archivo se borra sólo si ninguna otra fila (una foto ya publicada o el
// borrador de otra persona con la misma foto) apunta a la misma ruta.
import { and, inArray, isNull, lt, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { listingImages, pendingUploads } from "@/db/schema";
import { parseVariantPath, variantPath } from "@/lib/images/variants";
import { getStorage } from "@/lib/storage";
import type { JobFn } from "../runner";

export const PENDING_UPLOAD_RETENTION_DAYS = 7;
const BATCH = 500;

/** Todas las variantes de una foto a partir de su `storage_path`. */
export function filesForStoragePath(storagePath: string): string[] {
  const set = parseVariantPath(storagePath);
  return set ? set.widths.map((w) => variantPath(set.prefix, w)) : [storagePath];
}

export const purgeUploads: JobFn = async ({ now }) => {
  const cutoff = new Date(now.getTime() - PENDING_UPLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const storage = getStorage();
  let rows = 0;
  let files = 0;
  let kept = 0;

  for (;;) {
    const stale = await db
      .select({ id: pendingUploads.id, storagePath: pendingUploads.storagePath })
      .from(pendingUploads)
      .where(and(isNull(pendingUploads.claimedListingId), lt(pendingUploads.createdAt, cutoff)))
      .limit(BATCH);
    if (stale.length === 0) break;

    const ids = stale.map((r) => r.id);
    const paths = [...new Set(stale.map((r) => r.storagePath))];
    // Primero las filas: si el borrado de archivos falla a mitad, queda un
    // archivo huérfano (inofensivo), nunca una fila que apunta a la nada.
    await db.delete(pendingUploads).where(inArray(pendingUploads.id, ids));
    rows += ids.length;

    const inImages = await db
      .select({ p: listingImages.storagePath })
      .from(listingImages)
      .where(inArray(listingImages.storagePath, paths));
    const inPending = await db
      .select({ p: pendingUploads.storagePath })
      .from(pendingUploads)
      .where(and(inArray(pendingUploads.storagePath, paths), notInArray(pendingUploads.id, ids)));
    const referenced = new Set([...inImages, ...inPending].map((r) => r.p));

    for (const path of paths) {
      if (referenced.has(path)) {
        kept++;
        continue;
      }
      for (const file of filesForStoragePath(path)) {
        await storage.delete(file);
        files++;
      }
    }
    if (stale.length < BATCH) break;
  }

  return { deletedRows: rows, deletedFiles: files, keptShared: kept, cutoff: cutoff.toISOString() };
};
