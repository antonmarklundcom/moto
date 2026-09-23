// Fotos de un borrador de /publicar (DATABASE_SCHEMA.md §2.15, G-2). El
// paso 1 del formulario son las fotos y todavía no existe la publicación: cada
// foto queda en `pending_uploads` bajo el hash del token del borrador, que
// vive sólo en el navegador del vendedor. Al enviar, `claimUploads` las pasa a
// `listing_images`. Lo no reclamado lo borra el job purge-uploads a los 7 días.
import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, max } from "drizzle-orm";
import { db } from "@/db";
import { listingImages, pendingUploads } from "@/db/schema";
import { sha256Hex } from "@/lib/hash";
import { getStorage } from "@/lib/storage";
import { processUpload, UploadError } from "./process";

/** Fotos por borrador. Ningún documento fija un tope; 20 cubre cualquier aviso real. */
export const MAX_UPLOADS_PER_DRAFT = 20;

const DRAFT_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

export function isValidDraftToken(token: unknown): token is string {
  return typeof token === "string" && DRAFT_TOKEN_RE.test(token);
}

/** Token nuevo para un borrador (base64url, 256 bits). */
export function newDraftToken(): string {
  return randomBytes(32).toString("base64url");
}

export function draftTokenHash(token: string): string {
  return sha256Hex(`draft|${token}`);
}

export type StoredUpload = {
  id: number;
  storagePath: string;
  url: string;
  width: number | null;
  height: number | null;
  /** La misma foto ya estaba en este borrador (reintento): no se duplica. */
  duplicate: boolean;
};

/** Valida, re-encodea, guarda las variantes y registra la foto en el borrador. */
export async function storeDraftUpload(draftToken: string, file: Buffer): Promise<StoredUpload> {
  if (!isValidDraftToken(draftToken)) throw new Error("storeDraftUpload: token de borrador inválido");
  const hash = draftTokenHash(draftToken);
  const storage = getStorage();

  const [{ n }] = await db
    .select({ n: count() })
    .from(pendingUploads)
    .where(and(eq(pendingUploads.draftTokenHash, hash), isNull(pendingUploads.claimedListingId)));

  const image = await processUpload(file);

  // Reintento de la misma foto (corte de conexión): se devuelve la fila existente.
  const [existing] = await db
    .select()
    .from(pendingUploads)
    .where(
      and(
        eq(pendingUploads.draftTokenHash, hash),
        eq(pendingUploads.contentHash, image.contentHash),
        isNull(pendingUploads.claimedListingId),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      id: existing.id,
      storagePath: existing.storagePath,
      url: storage.url(existing.storagePath),
      width: existing.width,
      height: existing.height,
      duplicate: true,
    };
  }
  if (n >= MAX_UPLOADS_PER_DRAFT) {
    throw new UploadError("too_many", 422, `Podés subir hasta ${MAX_UPLOADS_PER_DRAFT} fotos por publicación.`);
  }

  // Variantes chicas primero y la mayor al final: si `storage_path` existe, todas existen.
  for (const v of image.variants) {
    await storage.put({ path: v.path, data: v.data, contentType: "image/webp" });
  }

  const [res] = await db.insert(pendingUploads).values({
    draftTokenHash: hash,
    storagePath: image.storagePath,
    width: image.width,
    height: image.height,
    bytes: image.bytes,
    contentHash: image.contentHash,
  });

  return {
    id: res.insertId,
    storagePath: image.storagePath,
    url: storage.url(image.storagePath),
    width: image.width,
    height: image.height,
    duplicate: false,
  };
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ClaimOptions = {
  /**
   * Ids de `pending_uploads` en el orden en que el vendedor las dejó. Sólo se
   * reclaman ésas (las que quitó quedan para la purga). Sin `ids`: todas, en
   * orden de subida.
   */
  ids?: number[];
  /** Transacción de quien crea la publicación (B4), para que todo sea atómico. */
  tx?: DbOrTx;
};

/**
 * Pasa las fotos no reclamadas del borrador a `listing_images` de `listingId`
 * y marca `claimed_listing_id`, en una transacción. Devuelve cuántas movió.
 * Un segundo llamado con el mismo token no mueve nada (ya están reclamadas).
 */
export async function claimUploads(draftToken: string, listingId: number, options: ClaimOptions = {}): Promise<number> {
  if (!isValidDraftToken(draftToken)) return 0;
  const hash = draftTokenHash(draftToken);

  const run = async (tx: DbOrTx): Promise<number> => {
    const conditions = [eq(pendingUploads.draftTokenHash, hash), isNull(pendingUploads.claimedListingId)];
    if (options.ids) {
      if (options.ids.length === 0) return 0;
      conditions.push(inArray(pendingUploads.id, options.ids));
    }
    const rows = await tx
      .select()
      .from(pendingUploads)
      .where(and(...conditions))
      .orderBy(asc(pendingUploads.id))
      .for("update");
    if (rows.length === 0) return 0;

    if (options.ids) {
      const pos = new Map(options.ids.map((id, i) => [id, i]));
      rows.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
    }

    const [{ top, existing }] = await tx
      .select({ top: max(listingImages.sortOrder), existing: count() })
      .from(listingImages)
      .where(eq(listingImages.listingId, listingId));
    const start = top === null ? 0 : top + 1;
    // Tope por publicación, no sólo por borrador: editando con borradores nuevos
    // no se pasa de 20 (revisión de seguridad). Lo que sobra queda sin reclamar y lo purga el job.
    rows.splice(Math.max(0, MAX_UPLOADS_PER_DRAFT - Number(existing)));
    if (rows.length === 0) return 0;

    await tx.insert(listingImages).values(
      rows.map((r, i) => ({
        listingId,
        storagePath: r.storagePath,
        width: r.width,
        height: r.height,
        bytes: r.bytes,
        contentHash: r.contentHash,
        isCatalogPhoto: false,
        sortOrder: start + i,
      })),
    );
    await tx
      .update(pendingUploads)
      .set({ claimedListingId: listingId })
      .where(inArray(pendingUploads.id, rows.map((r) => r.id)));
    return rows.length;
  };

  return options.tx ? run(options.tx) : db.transaction((tx) => run(tx));
}
