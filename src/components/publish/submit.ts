// Envío de /publicar (T-107): límite por IP, alta en `draft` con las fotos
// del borrador reclamadas en la misma transacción (A3), sugerencia de modelo
// si vino como texto libre (ADR-11) y `draft → pending_review` por la máquina
// de estados con el actor "vendedor" de la publicación (G-1).
import "server-only";

import { and, asc, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { brands, categories, cities, listings, models, modelSuggestions } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { claimUploads, isValidDraftToken } from "@/lib/images/uploads";
import { transition } from "@/lib/listings/state";
import { publicRef, slugify, slugifyUniqueAsync } from "@/lib/slug";
import { packIp } from "./ip";
import type { PublishCatalog, PublishValues } from "./validate";

export { packIp };

/** 3 publicaciones por IP en 24 h (T&S §8). */
export const PUBLISH_PER_IP_PER_DAY = 3;

export async function publishCatalog(): Promise<PublishCatalog> {
  const [b, m, c, ci] = await Promise.all([
    db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.isActive, true)).orderBy(asc(brands.sortOrder), asc(brands.name)),
    db
      .select({ id: models.id, brandId: models.brandId, name: models.name, engineCc: models.engineCc, categoryId: models.categoryId })
      .from(models)
      .innerJoin(brands, eq(brands.id, models.brandId))
      .where(and(eq(models.isActive, true), eq(brands.isActive, true)))
      .orderBy(asc(models.name)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
    db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder), asc(cities.name)),
  ]);
  return { brands: b, models: m, categories: c, cities: ci };
}

export async function publishedTodayFromIp(ip: Buffer, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.submittedIp, ip as unknown as string), gte(listings.createdAt, new Date(now.getTime() - 86_400_000))));
  return Number(row?.n ?? 0);
}

export type CreateResult = { ok: true; listingId: number; photos: number } | { ok: false; reason: "rate_limited" };

export async function createFromPublish(input: {
  values: PublishValues;
  draftToken: string | null;
  photoIds: number[];
  ip: string | null;
  ipHash: string | null;
  now?: Date;
}): Promise<CreateResult> {
  const now = input.now ?? new Date();
  const packed = packIp(input.ip);
  if (packed && (await publishedTodayFromIp(packed, now)) >= PUBLISH_PER_IP_PER_DAY) return { ok: false, reason: "rate_limited" };

  const v = input.values;
  let base: string;
  try {
    base = slugify(v.title);
  } catch {
    base = "moto";
  }
  let listingId = 0;
  let photos = 0;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const slug = await slugifyUniqueAsync(base, async (c) => (await db.select({ id: listings.id }).from(listings).where(eq(listings.slug, c)).limit(1)).length > 0);
    try {
      ({ listingId, photos } = await db.transaction(async (tx) => {
        const [res] = await tx.insert(listings).values({
          slug,
          publicRef: publicRef(),
          title: v.title,
          description: v.description,
          brandId: v.brandId,
          modelId: v.modelId,
          modelRaw: v.modelRaw,
          categoryId: v.categoryId,
          cityId: v.cityId,
          condition: v.condition,
          year: v.year,
          mileageKm: v.mileageKm,
          engineCc: v.engineCc,
          priceGs: v.priceGs,
          hasFinancingOnly: v.hasFinancingOnly,
          downPaymentGs: v.downPaymentGs,
          installmentGs: v.installmentGs,
          installmentCount: v.installmentCount,
          isNegotiable: v.isNegotiable,
          acceptsTradeIn: v.acceptsTradeIn,
          contactPhoneE164: v.contactPhoneE164,
          contactPhoneRaw: v.contactPhoneRaw,
          contactName: v.contactName,
          contactWhatsapp: v.contactWhatsapp,
          documentationStatus: v.documentationStatus,
          status: "draft",
          submittedIp: packed as unknown as string,
          createdAt: now,
        });
        const id = res.insertId;
        const claimed =
          input.draftToken && isValidDraftToken(input.draftToken)
            ? await claimUploads(input.draftToken, id, { ids: input.photoIds.length ? input.photoIds : undefined, tx })
            : 0;
        if (v.modelRaw) await tx.insert(modelSuggestions).values({ rawText: v.modelRaw, brandId: v.brandId, listingId: id, status: "pending" });
        await logActivity(tx, { userId: null, entityType: "listing", entityId: id, action: "created", diff: { via: "publicar", photos: claimed }, ipHash: input.ipHash });
        return { listingId: id, photos: claimed };
      }));
      break;
    } catch (error) {
      const e = error as { code?: string; cause?: { code?: string } };
      if ((e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY") && attempt < 5) continue;
      throw error;
    }
  }
  await transition({ listingId, action: "submit", actor: { kind: "manage_token", listingId, ipHash: input.ipHash } });
  return { ok: true, listingId, photos };
}
