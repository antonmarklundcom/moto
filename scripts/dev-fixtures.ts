// Publicaciones falsas para desarrollo local (G-21). Uso:
//   npm run fixtures           → borra las anteriores y carga ~200 nuevas
//   npm run fixtures -- --clean → sólo borra
//
// Se niega a correr en producción, sin ALLOW_DEV_FIXTURES=1 o contra una base
// que no sea local (scripts/lib/dev-fixtures-core.ts). Todo lo que crea lleva
// "[DEV]" en el título o "dev-" en el slug, y es lo único que borra.
//
// tsx no carga .env solo (CLAUDE.md §2): se carga explícitamente, primero.
import "dotenv/config";

import { deflateSync } from "node:zlib";
import {
  DEV_DEALERS,
  DEV_DEALER_SLUG_PREFIX,
  DEV_EXTERNAL_REF_PREFIX,
  DEV_TITLE_PREFIX,
  fixtureTitle,
  fixturesRefusalReason,
  planFixtures,
} from "./lib/dev-fixtures-core";

const DAY_MS = 86_400_000;
// Números ficticios, sólo en la base local. No escribirles.
const DEV_MOBILE = (n: number) => `+59598100${String(n % 10_000).padStart(4, "0")}`;
const DEV_LANDLINE = "+59521000000";

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** PNG liso de un color. Un marcador de posición evidente, no una foto. */
function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // profundidad de bits
  ihdr.writeUInt8(2, 9); // RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main() {
  const refusal = fixturesRefusalReason(process.env);
  if (refusal) {
    console.error(`dev-fixtures: me niego a correr. ${refusal}`);
    process.exit(1);
  }

  // Import dinámico: la base se toca recién después de pasar la guarda.
  const { and, asc, eq, inArray, like, or, sql } = await import("drizzle-orm");
  const { closeDb, db } = await import("../src/db");
  const schema = await import("../src/db/schema");
  const { sha256Hex } = await import("../src/lib/hash");
  const { publicRef, slugify } = await import("../src/lib/slug");
  const { getStorage } = await import("../src/lib/storage");
  const { brands, categories, cities, dealers, listingImages, listings, models } = schema;

  // 1. Borrar lo anterior (sólo lo marcado como fixture).
  const devDealers = await db
    .select({ id: dealers.id })
    .from(dealers)
    .where(like(dealers.slug, `${DEV_DEALER_SLUG_PREFIX}%`));
  const devDealerIds = devDealers.map((d) => d.id);
  const oldListings = await db
    .select({ id: listings.id })
    .from(listings)
    .where(
      devDealerIds.length
        ? or(like(listings.title, `${DEV_TITLE_PREFIX}%`), inArray(listings.dealerId, devDealerIds))
        : like(listings.title, `${DEV_TITLE_PREFIX}%`),
    );
  const oldIds = oldListings.map((l) => l.id);
  if (oldIds.length) {
    for (const table of [
      schema.listingEvents,
      schema.reports,
      schema.featuredPurchases,
      schema.modelSuggestions,
      schema.leads,
    ] as const) {
      await db.delete(table).where(inArray(table.listingId, oldIds));
    }
    await db.delete(schema.pendingUploads).where(inArray(schema.pendingUploads.claimedListingId, oldIds));
    await db.delete(listingImages).where(inArray(listingImages.listingId, oldIds));
    await db.delete(listings).where(inArray(listings.id, oldIds));
  }
  if (devDealerIds.length) {
    await db.delete(schema.leads).where(inArray(schema.leads.dealerId, devDealerIds));
    await db.delete(schema.listingEvents).where(inArray(schema.listingEvents.dealerId, devDealerIds));
    await db.delete(schema.dealerPlans).where(inArray(schema.dealerPlans.dealerId, devDealerIds));
    await db.delete(dealers).where(inArray(dealers.id, devDealerIds));
  }
  console.log(`dev-fixtures: borradas ${oldIds.length} publicaciones y ${devDealerIds.length} comercios de prueba`);

  if (process.argv.includes("--clean")) {
    await closeDb();
    return;
  }

  // 2. Catálogo real (sólo activo).
  const brandRows = await db.select().from(brands).where(eq(brands.isActive, true)).orderBy(asc(brands.sortOrder));
  const modelRows = await db.select().from(models).where(eq(models.isActive, true)).orderBy(asc(models.id));
  const cityRows = await db.select().from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder));
  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder));

  const catalog = {
    brands: brandRows
      .map((b) => ({
        slug: b.slug,
        models: modelRows
          .filter((m) => m.brandId === b.id)
          .map((m) => ({ slug: m.slug, name: m.name, engineCc: m.engineCc })),
      }))
      .filter((b) => b.models.length > 0),
    cities: cityRows.map((c) => c.slug),
    categories: categoryRows.map((c) => c.slug),
  };
  const plan = planFixtures(catalog);

  const brandBySlug = new Map(brandRows.map((b) => [b.slug, b]));
  const modelByKey = new Map(
    modelRows.map((m) => [`${brandRows.find((b) => b.id === m.brandId)?.slug}/${m.slug}`, m]),
  );
  const cityBySlug = new Map(cityRows.map((c) => [c.slug, c]));
  const categoryBySlug = new Map(categoryRows.map((c) => [c.slug, c]));

  // 3. Comercios de prueba.
  const dealerIds: number[] = [];
  for (const dealer of DEV_DEALERS) {
    const city = cityRows[Math.min(dealer.cityIndex, cityRows.length - 1)];
    const [res] = await db.insert(dealers).values({
      name: dealer.name,
      slug: dealer.slug,
      cityId: city.id,
      phoneE164: DEV_MOBILE(dealerIds.length),
      phoneRaw: "0981 000 000",
      description: `${DEV_TITLE_PREFIX} Comercio ficticio para desarrollo local.`,
      status: "active",
      authorizationNote: `${DEV_TITLE_PREFIX} Sin autorización real: dato de desarrollo.`,
      listingTtlDays: dealer.ttlDays,
    });
    dealerIds.push(res.insertId);
  }

  // 4. Marcadores de imagen (4 colores, compartidos).
  const storage = getStorage();
  const palette: Array<[number, number, number]> = [
    [120, 130, 140],
    [150, 120, 110],
    [110, 140, 120],
    [140, 140, 100],
  ];
  const placeholders = [];
  for (const [i, color] of palette.entries()) {
    const data = solidPng(640, 480, color);
    const path = `dev-fixtures/placeholder-${i + 1}.png`;
    await storage.put({ path, data, contentType: "image/png" });
    placeholders.push({ path, bytes: data.length, contentHash: sha256Hex(data) });
  }

  // 5. Publicaciones.
  const now = Date.now();
  let inserted = 0;
  for (const item of plan) {
    const brand = brandBySlug.get(item.brandSlug)!;
    const model = modelByKey.get(`${item.brandSlug}/${item.modelSlug}`)!;
    const city = cityBySlug.get(item.citySlug)!;
    const category = categoryBySlug.get(item.categorySlug)!;
    const dealerId = item.dealerIndex === null ? null : dealerIds[item.dealerIndex];
    const ttl = item.dealerIndex === null ? 60 : (DEV_DEALERS[item.dealerIndex].ttlDays ?? 60);
    const title = fixtureTitle(item, brand.name);
    const hasPublished = !["draft", "pending_review", "rejected"].includes(item.status);
    const publishedAt = hasPublished ? new Date(now - item.publishedDaysAgo * DAY_MS) : null;
    const expiresAt = publishedAt
      ? new Date(
          item.status === "expired"
            ? now - DAY_MS
            : Math.max(publishedAt.getTime() + ttl * DAY_MS, now + DAY_MS),
        )
      : null;

    const [res] = await db.insert(listings).values({
      slug: `dev-${slugify(title.slice(DEV_TITLE_PREFIX.length))}-${item.key}`,
      publicRef: publicRef(),
      title,
      description: `${DEV_TITLE_PREFIX} Publicación ficticia para desarrollo local. No es una moto real.`,
      brandId: brand.id,
      modelId: model.id,
      categoryId: category.id,
      cityId: city.id,
      dealerId,
      condition: item.condition,
      year: item.year,
      mileageKm: item.mileageKm,
      engineCc: item.engineCc,
      priceGs: item.priceGs,
      hasFinancingOnly: item.hasFinancingOnly,
      downPaymentGs: item.downPaymentGs,
      installmentGs: item.installmentGs,
      installmentCount: item.installmentCount,
      isNegotiable: item.dealerIndex === null,
      acceptsTradeIn: item.key.endsWith("3"),
      contactPhoneE164: item.contactWhatsapp ? DEV_MOBILE(inserted) : DEV_LANDLINE,
      contactPhoneRaw: item.contactWhatsapp ? "0981 000 000" : "021 000 000",
      contactName: item.dealerIndex === null ? `${DEV_TITLE_PREFIX} Vendedor` : null,
      contactWhatsapp: item.contactWhatsapp,
      documentationStatus: item.documentationStatus,
      externalRef: dealerId ? `${DEV_EXTERNAL_REF_PREFIX}${item.key}` : null,
      status: item.status,
      rejectionReasonCode: item.status === "rejected" ? "datos_incompletos" : null,
      publishedAt,
      expiresAt,
      soldAt: item.soldDaysAgo !== null ? new Date(now - item.soldDaysAgo * DAY_MS) : null,
      lastVerifiedAt: dealerId && publishedAt ? publishedAt : null,
      isFeatured: item.isFeatured,
      featuredUntil: item.isFeatured ? new Date(now + 7 * DAY_MS) : null,
    });
    const listingId = res.insertId;
    const imageCount = item.status === "draft" ? 0 : 1 + (inserted % 3);
    for (let i = 0; i < imageCount; i += 1) {
      const ph = placeholders[(inserted + i) % placeholders.length];
      await db.insert(listingImages).values({
        listingId,
        storagePath: ph.path,
        width: 640,
        height: 480,
        bytes: ph.bytes,
        contentHash: ph.contentHash,
        altText: `${DEV_TITLE_PREFIX} imagen de relleno`,
        sortOrder: i,
      });
    }
    inserted += 1;
  }

  // 6. Resumen con conteos reales de la base.
  const summary = await db
    .select({ status: listings.status, n: sql<number>`count(*)` })
    .from(listings)
    .where(like(listings.title, `${DEV_TITLE_PREFIX}%`))
    .groupBy(listings.status);
  const [{ live }] = await db
    .select({ live: sql<number>`count(*)` })
    .from(listings)
    .where(
      and(
        like(listings.title, `${DEV_TITLE_PREFIX}%`),
        sql`(${listings.status} = 'published' OR (${listings.status} = 'sold' AND ${listings.soldAt} >= NOW() - INTERVAL 90 DAY))`,
        sql`${listings.deletedAt} IS NULL`,
      ),
    );
  console.log(
    `dev-fixtures: ${inserted} publicaciones, ${dealerIds.length} comercios. Vivas: ${live}. Por estado: ${summary
      .map((s) => `${s.status}=${s.n}`)
      .join(", ")}`,
  );
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
