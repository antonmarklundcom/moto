// Enlace privado del vendedor /mi-aviso/<token> (ADR-17, G-1).
//
// 32 bytes aleatorios en base64url (43 caracteres), mostrados una sola vez.
// En la base sólo queda SHA-256 hex en `listings.manage_token_hash` (UNIQUE):
// quien lee la base no puede reconstruir el enlace. Rotar invalida el anterior.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { sha256Hex } from "@/lib/hash";

export const MANAGE_TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedManageToken(token: string): boolean {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function hashManageToken(token: string): string {
  return sha256Hex(token);
}

/** Token nuevo y su hash. El token se muestra una vez y no se guarda. */
export function generateManageToken(): { token: string; hash: string } {
  const token = randomBytes(MANAGE_TOKEN_BYTES).toString("base64url");
  return { token, hash: hashManageToken(token) };
}

/** Comparación en tiempo constante del hash del token contra el guardado. */
export function verifyManageToken(token: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !isWellFormedManageToken(token)) return false;
  const a = Buffer.from(hashManageToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && a.length === 32 && timingSafeEqual(a, b);
}

/**
 * Publicación (no borrada) de un token. Busca por el hash (índice UNIQUE) y
 * confirma con verifyManageToken. `null` si el token no es válido.
 */
export async function findListingIdByManageToken(token: string): Promise<number | null> {
  if (!isWellFormedManageToken(token)) return null;
  const hash = hashManageToken(token);
  const [row] = await db
    .select({ id: listings.id, manageTokenHash: listings.manageTokenHash })
    .from(listings)
    .where(and(eq(listings.manageTokenHash, hash), isNull(listings.deletedAt)))
    .limit(1);
  if (!row || !verifyManageToken(token, row.manageTokenHash)) return null;
  return row.id;
}

/**
 * Emite o rota el token de una publicación: guarda el hash nuevo (el anterior
 * deja de valer) y registra `manage_token_rotated`. Devuelve el token en claro,
 * que quien llama muestra una sola vez.
 */
export async function rotateManageToken(
  listingId: number,
  by: { userId: number | null; ipHash?: string | null } = { userId: null },
): Promise<string> {
  const { token, hash } = generateManageToken();
  await db.transaction(async (tx) => {
    const [res] = await tx.update(listings).set({ manageTokenHash: hash }).where(eq(listings.id, listingId));
    if (res.affectedRows !== 1) throw new Error(`No existe la publicación ${listingId}`);
    await logActivity(tx, {
      userId: by.userId,
      entityType: "listing",
      entityId: listingId,
      action: "manage_token_rotated",
      diff: null,
      ipHash: by.ipHash ?? null,
    });
  });
  return token;
}
