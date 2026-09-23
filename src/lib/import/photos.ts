// Fotos del stock importado (G-18): cada archivo va a la publicación cuya
// referencia encabeza su nombre, pasando por el pipeline de A3 (tipo por
// bytes, re-encodeo WebP sin EXIF, variantes). La misma foto dos veces en la
// misma publicación no se duplica. Después intenta publicar (auto_approve).
import "server-only";
import { and, count, eq, isNotNull, isNull, max } from "drizzle-orm";
import { db } from "@/db";
import { listingImages, listings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { processUpload, UploadError } from "@/lib/images/process";
import { MAX_UPLOADS_PER_DRAFT } from "@/lib/images/uploads";
import { getStorage } from "@/lib/storage";
import { baseName, isCatalogPhotoName, refForFile } from "./photo-names";
import { autoPublishIfAllowed, describeAutoPublish } from "./publish";
import type { ImportSource } from "./apply";

export type PhotoOutcome = {
  file: string;
  ok: boolean;
  externalRef: string | null;
  listingId: number | null;
  duplicate: boolean;
  status: string | null;
  message: string;
};

type Candidate = { id: number; dealerId: number; externalRef: string; status: string };

/** Publicaciones de comercio con referencia, de un comercio o de todos. */
export async function photoCandidates(dealerId: number | null): Promise<Candidate[]> {
  const rows = await db
    .select({ id: listings.id, dealerId: listings.dealerId, externalRef: listings.externalRef, status: listings.status })
    .from(listings)
    .where(
      and(
        isNotNull(listings.externalRef),
        isNull(listings.deletedAt),
        dealerId === null ? isNotNull(listings.dealerId) : eq(listings.dealerId, dealerId),
      ),
    );
  const out: Candidate[] = [];
  for (const r of rows) {
    if (r.dealerId !== null && r.externalRef !== null) out.push({ ...r, dealerId: r.dealerId, externalRef: r.externalRef });
  }
  return out;
}

/** A qué publicación va un archivo. Sin comercio elegido, la referencia tiene que ser única entre comercios. */
export function matchPhoto(
  fileName: string,
  candidates: readonly Candidate[],
): { listing: Candidate } | { error: string } {
  const ref = refForFile(
    fileName,
    candidates.map((c) => c.externalRef),
  );
  if (!ref) return { error: "El nombre no empieza con la referencia de ninguna moto importada." };
  const hits = candidates.filter((c) => c.externalRef.toUpperCase() === ref.toUpperCase());
  if (hits.length > 1) return { error: `La referencia ${ref} existe en más de un comercio: elegí el comercio.` };
  return { listing: hits[0] };
}

export async function attachPhoto(input: {
  fileName: string;
  data: Buffer;
  candidates: readonly Candidate[];
  source: ImportSource;
}): Promise<PhotoOutcome> {
  const file = baseName(input.fileName);
  const fail = (message: string, externalRef: string | null = null, listingId: number | null = null): PhotoOutcome => ({
    file,
    ok: false,
    externalRef,
    listingId,
    duplicate: false,
    status: null,
    message,
  });

  const match = matchPhoto(file, input.candidates);
  if ("error" in match) return fail(match.error);
  const { listing } = match;

  let image;
  try {
    image = await processUpload(input.data);
  } catch (error) {
    if (error instanceof UploadError) return fail(error.message, listing.externalRef, listing.id);
    throw error;
  }

  const storage = getStorage();
  const userId = input.source.kind === "admin" ? input.source.userId : null;
  const result = await db.transaction(async (tx) => {
    // Bloquea la publicación: dos subidas simultáneas no pasan el tope ni duplican.
    const [locked] = await tx
      .select({ id: listings.id, deletedAt: listings.deletedAt })
      .from(listings)
      .where(eq(listings.id, listing.id))
      .for("update");
    if (!locked || locked.deletedAt !== null) return { error: "La publicación ya no existe." } as const;
    const [same] = await tx
      .select({ id: listingImages.id })
      .from(listingImages)
      .where(and(eq(listingImages.listingId, listing.id), eq(listingImages.contentHash, image.contentHash)))
      .limit(1);
    if (same) return { duplicate: true } as const;
    const [{ n }] = await tx.select({ n: count() }).from(listingImages).where(eq(listingImages.listingId, listing.id));
    if (n >= MAX_UPLOADS_PER_DRAFT) return { error: `La moto ya tiene ${MAX_UPLOADS_PER_DRAFT} fotos.` } as const;

    // Variantes chicas primero y la mayor al final (A3): si `storage_path` existe, todas existen.
    for (const v of image.variants) await storage.put({ path: v.path, data: v.data, contentType: "image/webp" });

    const [{ top }] = await tx
      .select({ top: max(listingImages.sortOrder) })
      .from(listingImages)
      .where(eq(listingImages.listingId, listing.id));
    const isCatalogPhoto = isCatalogPhotoName(file);
    const [res] = await tx.insert(listingImages).values({
      listingId: listing.id,
      storagePath: image.storagePath,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      contentHash: image.contentHash,
      isCatalogPhoto,
      sortOrder: top === null ? 0 : top + 1,
    });
    await logActivity(tx, {
      userId,
      entityType: "listing",
      entityId: listing.id,
      action: "photo_imported",
      diff: { source: input.source.kind, file, imageId: res.insertId, isCatalogPhoto },
    });
    return { duplicate: false } as const;
  });
  if ("error" in result) return fail(result.error ?? "Error", listing.externalRef, listing.id);

  const publish = await autoPublishIfAllowed(listing.id);
  return {
    file,
    ok: true,
    externalRef: listing.externalRef,
    listingId: listing.id,
    duplicate: result.duplicate,
    status: publish.status,
    message: `${result.duplicate ? "Ya estaba cargada." : "Foto agregada."} ${describeAutoPublish(publish)}`,
  };
}
