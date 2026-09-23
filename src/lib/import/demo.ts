// Stock de demostración (owner 2026-09-23, docs/templates/demo/README.md).
// Filas `DEV-` y comercios `dev-` se importan sólo si la guarda de fixtures
// (ADR-24) pasa: base local, ALLOW_DEV_FIXTURES=1, no producción. En ese modo
// cada moto de prueba recibe la imagen de marcador de posición de
// `npm run fixtures` (etiquetada «[DEV] imagen de relleno», nunca presentada
// como foto de la unidad) para que pueda publicarse.
import "server-only";
import sharp from "sharp";
import { and, count, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import { dealers, listingImages } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { sha256Hex } from "@/lib/hash";
import { getStorage } from "@/lib/storage";
import { DEV_DEALER_SLUG_PREFIX, DEV_TITLE_PREFIX, fixturesRefusalReason } from "../../../scripts/lib/dev-fixtures-core";

/** `null` = se aceptan filas de prueba; si no, el motivo por el que se rechazan. */
export function demoRefusal(env: NodeJS.ProcessEnv = process.env): string | null {
  return fixturesRefusalReason(env);
}

/** La misma ruta que usa scripts/dev-fixtures.ts para su primer marcador. */
export const DEMO_PLACEHOLDER_PATH = "dev-fixtures/placeholder-1.png";

let placeholder: { bytes: number; contentHash: string } | null = null;

async function ensurePlaceholder(): Promise<{ bytes: number; contentHash: string }> {
  if (placeholder) return placeholder;
  const storage = getStorage();
  let data = await storage.get(DEMO_PLACEHOLDER_PATH);
  if (!data) {
    // Gris liso: evidente que no es una foto.
    data = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 120, g: 130, b: 140 } } })
      .png()
      .toBuffer();
    await storage.put({ path: DEMO_PLACEHOLDER_PATH, data, contentType: "image/png" });
  }
  placeholder = { bytes: data.length, contentHash: sha256Hex(data) };
  return placeholder;
}

/** Adjunta el marcador a una publicación de prueba sin fotos. Sólo con la guarda en verde. */
export async function attachDemoPlaceholder(listingId: number): Promise<boolean> {
  const refusal = demoRefusal();
  if (refusal !== null) throw new Error(`attachDemoPlaceholder: ${refusal}`);
  const [{ n }] = await db.select({ n: count() }).from(listingImages).where(eq(listingImages.listingId, listingId));
  if (n > 0) return false;
  const ph = await ensurePlaceholder();
  await db.insert(listingImages).values({
    listingId,
    storagePath: DEMO_PLACEHOLDER_PATH,
    width: 640,
    height: 480,
    bytes: ph.bytes,
    contentHash: ph.contentHash,
    altText: `${DEV_TITLE_PREFIX} imagen de relleno`,
    isCatalogPhoto: false,
    sortOrder: 0,
  });
  return true;
}

/**
 * Los comercios de `npm run fixtures` no tienen auto-aprobación; en modo demo
 * se les activa para que las 30 motos se vean publicadas en local. Sólo toca
 * comercios `dev-`, sólo con la guarda en verde, y queda en activity_log.
 */
export async function enableDemoAutoApprove(dealerIds: readonly number[], userId: number | null): Promise<number[]> {
  const refusal = demoRefusal();
  if (refusal !== null) throw new Error(`enableDemoAutoApprove: ${refusal}`);
  if (dealerIds.length === 0) return [];
  const rows = await db
    .select({ id: dealers.id })
    .from(dealers)
    .where(
      and(
        inArray(dealers.id, [...dealerIds]),
        like(dealers.slug, `${DEV_DEALER_SLUG_PREFIX}%`),
        eq(dealers.autoApprove, false),
      ),
    );
  for (const { id } of rows) {
    await db.transaction(async (tx) => {
      await tx.update(dealers).set({ autoApprove: true }).where(eq(dealers.id, id));
      await logActivity(tx, {
        userId,
        entityType: "dealer",
        entityId: id,
        action: "dev_auto_approve",
        diff: { autoApprove: { from: false, to: true }, reason: "importación de stock de demostración (local)" },
      });
    });
  }
  return rows.map((r) => r.id);
}
