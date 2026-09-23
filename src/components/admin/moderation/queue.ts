// Cola de moderación (ADMIN_SPEC.md §3): una publicación a la vez, señales de
// riesgo primero y después FIFO.
import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { brands, categories, cities, dealers, listingImages, listings, models, modelSuggestions } from "@/db/schema";
import { getStorage } from "@/lib/storage";
import { type Signals, signalsFor } from "./signals";

const subjectCols = {
  id: listings.id,
  title: listings.title,
  modelId: listings.modelId,
  condition: listings.condition,
  year: listings.year,
  priceGs: listings.priceGs,
  contactPhoneE164: listings.contactPhoneE164,
  submittedIp: listings.submittedIp,
  description: listings.description,
  createdAt: listings.createdAt,
};

export type QueueEntry = { id: number; title: string; score: number; hoursInQueue: number; slaAlert: boolean };

export async function pendingQueue(now: Date = new Date()): Promise<QueueEntry[]> {
  const rows = await db
    .select(subjectCols)
    .from(listings)
    .where(and(eq(listings.status, "pending_review"), isNull(listings.deletedAt)))
    .orderBy(asc(listings.createdAt), asc(listings.id))
    .limit(200);
  const withSignals = await Promise.all(rows.map(async (r) => ({ r, s: await signalsFor(r, now) })));
  return withSignals
    .map(({ r, s }) => ({ id: r.id, title: r.title, score: s.score, hoursInQueue: s.hoursInQueue, slaAlert: s.slaAlert, createdAt: r.createdAt }))
    .sort((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
    .map((e) => ({ id: e.id, title: e.title, score: e.score, hoursInQueue: e.hoursInQueue, slaAlert: e.slaAlert }));
}

export type ModerationItem = NonNullable<Awaited<ReturnType<typeof moderationItem>>>;

export async function moderationItem(id: number, now: Date = new Date()) {
  const [row] = await db
    .select({
      l: listings,
      brandName: brands.name,
      modelName: models.name,
      cityName: cities.name,
      categoryName: categories.name,
      dealerName: dealers.name,
      dealerAutoApprove: dealers.autoApprove,
    })
    .from(listings)
    .innerJoin(brands, eq(brands.id, listings.brandId))
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .leftJoin(models, eq(models.id, listings.modelId))
    .leftJoin(dealers, eq(dealers.id, listings.dealerId))
    .where(eq(listings.id, id));
  if (!row) return null;
  const storage = getStorage();
  const [images, modelOptions, suggestion, signals] = await Promise.all([
    db.select().from(listingImages).where(eq(listingImages.listingId, id)).orderBy(asc(listingImages.sortOrder), asc(listingImages.id)),
    row.l.modelId === null
      ? db
          .select({ id: models.id, name: models.name })
          .from(models)
          .where(and(eq(models.brandId, row.l.brandId), eq(models.isActive, true)))
          .orderBy(asc(models.name))
      : Promise.resolve([] as Array<{ id: number; name: string }>),
    db
      .select({ id: modelSuggestions.id, rawText: modelSuggestions.rawText })
      .from(modelSuggestions)
      .where(and(eq(modelSuggestions.listingId, id), eq(modelSuggestions.status, "pending")))
      .limit(1),
    signalsFor(row.l, now),
  ]);
  return {
    listing: row.l,
    names: {
      brand: row.brandName,
      model: row.modelName ?? row.l.modelRaw,
      city: row.cityName,
      category: row.categoryName,
      dealer: row.dealerName,
    },
    dealerAutoApprove: row.dealerAutoApprove,
    images: images.map((i) => ({ id: i.id, url: storage.url(i.storagePath), isCatalogPhoto: i.isCatalogPhoto, width: i.width, height: i.height })),
    modelOptions,
    suggestion: suggestion[0] ?? null,
    signals: signals as Signals,
  };
}
