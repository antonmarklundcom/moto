// Borrar los archivos de fotos que ya nadie usa (revisión de seguridad): una
// foto que el vendedor saca de su aviso no puede seguir servida en /media.
// Mismo criterio que la purga de borradores: se borra sólo si ninguna fila
// (otra publicación u otro borrador con la misma foto) apunta a esa ruta.
import "server-only";

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { listingImages, pendingUploads } from "@/db/schema";
import { filesForStoragePath } from "@/lib/cron/jobs/purge-uploads";
import { getStorage } from "@/lib/storage";

/** Llamar **después** de confirmar el borrado de las filas. Nunca lanza: un archivo huérfano es inofensivo. */
export async function deleteUnreferencedImageFiles(storagePaths: string[]): Promise<number> {
  const paths = [...new Set(storagePaths)];
  if (paths.length === 0) return 0;
  try {
    const [inImages, inPending] = await Promise.all([
      db.select({ p: listingImages.storagePath }).from(listingImages).where(inArray(listingImages.storagePath, paths)),
      db.select({ p: pendingUploads.storagePath }).from(pendingUploads).where(inArray(pendingUploads.storagePath, paths)),
    ]);
    const referenced = new Set([...inImages, ...inPending].map((r) => r.p));
    const storage = getStorage();
    let deleted = 0;
    for (const path of paths) {
      if (referenced.has(path)) continue;
      for (const file of filesForStoragePath(path)) {
        await storage.delete(file);
        deleted++;
      }
    }
    return deleted;
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", msg: "imagenes: no se pudieron borrar archivos", error: error instanceof Error ? error.message : String(error) }));
    return 0;
  }
}
