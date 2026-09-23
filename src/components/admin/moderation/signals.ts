// Señales de riesgo de la cola (ADMIN_SPEC.md §3, T&S §3). Ordenan la cola;
// ninguna rechaza sola: la decisión es humana.
import "server-only";

import { and, asc, eq, gte, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { listingImages, listings } from "@/db/schema";
import { formatGuaranies } from "@/lib/format";
import { liveCondition } from "@/lib/listings/query";
import { fraudKeywords, isPriceOutlier, median, MIN_MEDIAN_N, SLA_ALERT_HOURS } from "./texts";

export type Related = { id: number; title: string; status: string; publicRef: string; dealerId: number | null };

export type Signals = {
  price: { median: string | null; n: number; outlier: boolean; text: string };
  samePhone: Related[];
  phoneRejectedBefore: boolean;
  sameIp24h: number;
  /** Otras publicaciones con una foto igual (mismo `content_hash`), ignorando fotos de catálogo (G-12). */
  duplicatePhotos: Related[];
  /** Mismo modelo, año y precio (patrón 6). */
  lookalikes: Related[];
  fraudWords: string[];
  hoursInQueue: number;
  slaAlert: boolean;
  /** Cuántas señales se prendieron: ordena la cola (más primero). */
  score: number;
};

type Subject = {
  id: number;
  modelId: number | null;
  condition: "new" | "used";
  year: number | null;
  priceGs: number | null;
  contactPhoneE164: string;
  submittedIp: string | null;
  description: string | null;
  title: string;
  createdAt: Date;
};

const relatedCols = {
  id: listings.id,
  title: listings.title,
  status: listings.status,
  publicRef: listings.publicRef,
  dealerId: listings.dealerId,
};

export async function signalsFor(l: Subject, now: Date = new Date()): Promise<Signals> {
  const DAY = 86_400_000;
  const [priceRows, samePhone, sameIpRows, dupRows, lookalikes] = await Promise.all([
    l.modelId
      ? db
          .select({ p: listings.priceGs })
          .from(listings)
          .where(and(liveCondition(now, "available"), eq(listings.modelId, l.modelId), eq(listings.condition, l.condition), isNotNull(listings.priceGs), ne(listings.id, l.id)))
      : Promise.resolve([] as Array<{ p: number | null }>),
    db
      .select(relatedCols)
      .from(listings)
      .where(and(eq(listings.contactPhoneE164, l.contactPhoneE164), ne(listings.id, l.id), isNull(listings.deletedAt)))
      .orderBy(asc(listings.id))
      .limit(20),
    l.submittedIp
      ? db
          .select({ id: listings.id })
          .from(listings)
          .where(and(eq(listings.submittedIp, l.submittedIp as string), gte(listings.createdAt, new Date(now.getTime() - DAY))))
      : Promise.resolve([] as Array<{ id: number }>),
    duplicatePhotoListings(l.id),
    l.modelId && l.priceGs
      ? db
          .select(relatedCols)
          .from(listings)
          .where(
            and(
              eq(listings.modelId, l.modelId),
              l.year === null ? isNull(listings.year) : eq(listings.year, l.year),
              eq(listings.priceGs, l.priceGs),
              ne(listings.id, l.id),
              isNull(listings.deletedAt),
              inArray(listings.status, ["published", "pending_review", "paused"]),
            ),
          )
          .limit(10)
      : Promise.resolve([] as Related[]),
  ]);

  const prices = priceRows.map((r) => Number(r.p)).filter((p) => p > 0);
  const med = median(prices);
  const outlier = isPriceOutlier(l.priceGs, med, prices.length);
  const priceText =
    prices.length < MIN_MEDIAN_N
      ? `Sin referencia suficiente (${prices.length} publicadas del modelo con precio).`
      : `Mediana del modelo: ${formatGuaranies(med)} sobre ${prices.length} publicadas.${outlier ? " Esta está más de 35 % por debajo." : ""}`;
  const hoursInQueue = Math.floor((now.getTime() - l.createdAt.getTime()) / 3_600_000);
  const words = fraudKeywords(`${l.title} ${l.description ?? ""}`);
  const phoneRejectedBefore = samePhone.some((r) => r.status === "rejected");
  // Una 0 km de comercio comparte modelo y precio con otras del mismo comercio: no es duplicado (G-12).
  const lookalikesFiltered = l.condition === "new" ? [] : lookalikes;

  const flags = [
    outlier,
    phoneRejectedBefore,
    sameIpRows.length > 3,
    dupRows.length > 0,
    lookalikesFiltered.length > 0,
    words.length > 0,
  ];
  return {
    price: { median: formatGuaranies(med), n: prices.length, outlier, text: priceText },
    samePhone,
    phoneRejectedBefore,
    sameIp24h: sameIpRows.length,
    duplicatePhotos: dupRows,
    lookalikes: lookalikesFiltered,
    fraudWords: words,
    hoursInQueue,
    slaAlert: hoursInQueue >= SLA_ALERT_HOURS,
    score: flags.filter(Boolean).length,
  };
}

/**
 * Publicaciones con al menos una foto igual (mismo `content_hash`) a una foto
 * propia de esta. G-12: las fotos de catálogo no cuentan, ni de un lado ni del
 * otro (la misma foto oficial la usan todos los comercios para su 0 km).
 */
export async function duplicatePhotoListings(listingId: number): Promise<Related[]> {
  const own = await db
    .select({ hash: listingImages.contentHash })
    .from(listingImages)
    .where(and(eq(listingImages.listingId, listingId), eq(listingImages.isCatalogPhoto, false)));
  const hashes = [...new Set(own.map((r) => r.hash))];
  if (hashes.length === 0) return [];
  const rows = await db
    .selectDistinct(relatedCols)
    .from(listingImages)
    .innerJoin(listings, eq(listings.id, listingImages.listingId))
    .where(
      and(
        inArray(listingImages.contentHash, hashes),
        eq(listingImages.isCatalogPhoto, false),
        ne(listingImages.listingId, listingId),
      ),
    )
    .limit(20);
  return rows;
}
