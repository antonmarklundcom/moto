// Fichas de prueba para tests/e2e/detail.spec.ts: una por estado, sacadas de
// `npm run fixtures`, más una vendida hace > 12 meses y una borrada (creadas
// acá con título [DEV], las borra el próximo fixtures). Imprime JSON. Sólo local.
import "dotenv/config";

import { fixturesRefusalReason } from "../../../scripts/lib/dev-fixtures-core";

async function main() {
  const refusal = fixturesRefusalReason({ ...process.env, NODE_ENV: "development" });
  if (refusal) throw new Error(`detail-targets: ${refusal}`);
  const { and, eq, gt, isNotNull, isNull, like } = await import("drizzle-orm");
  const { closeDb, db } = await import("../../../src/db");
  const { listings, reports } = await import("../../../src/db/schema");
  const { publicRef } = await import("../../../src/lib/slug");
  const DAY = 86_400_000;
  const path = (l: { slug: string; publicRef: string }) => `/aviso/${l.slug}-${l.publicRef.toLowerCase()}`;
  const one = async (...conds: Parameters<typeof and>) => {
    const [row] = await db.select().from(listings).where(and(like(listings.title, "[DEV]%"), isNull(listings.deletedAt), ...conds)).limit(1);
    if (!row) throw new Error("detail-targets: faltan fixtures (npm run fixtures)");
    return row;
  };
  // El límite de denuncias por IP y día (5) cuenta las de corridas anteriores
  // desde 127.0.0.1: se borran las de hoy sobre fichas [DEV] para que la prueba se pueda repetir.
  const { inArray, gte } = await import("drizzle-orm");
  const devIds = (await db.select({ id: listings.id }).from(listings).where(like(listings.title, "[DEV]%"))).map((r) => r.id);
  if (devIds.length) await db.delete(reports).where(and(inArray(reports.listingId, devIds), gte(reports.createdAt, new Date(Date.now() - DAY))));

  const published = await one(eq(listings.status, "published"), eq(listings.contactWhatsapp, true), isNotNull(listings.modelId));
  const callsOnly = await one(eq(listings.status, "published"), eq(listings.contactWhatsapp, false));
  const sold = await one(eq(listings.status, "sold"), gt(listings.soldAt, new Date(Date.now() - 80 * DAY)));
  const expired = await one(eq(listings.status, "expired"));

  const clone = async (key: string, extra: Partial<typeof listings.$inferInsert>) => {
    const slug = `dev-e2e-${key}`;
    const [existing] = await db.select().from(listings).where(eq(listings.slug, slug));
    if (existing) return existing;
    const { id: _id, slug: _s, publicRef: _r, manageTokenHash: _m, createdAt: _c, updatedAt: _u, ...rest } = published;
    void _id; void _s; void _r; void _m; void _c; void _u;
    await db.insert(listings).values({ ...rest, slug, publicRef: publicRef(), externalRef: null, title: `[DEV] E2E ${key}`, ...extra });
    const [row] = await db.select().from(listings).where(eq(listings.slug, slug));
    return row;
  };
  const oldSold = await clone("vendida-hace-mas-de-un-ano", { status: "sold", soldAt: new Date(Date.now() - 400 * DAY) });
  const deleted = await clone("borrada", { deletedAt: new Date() });

  console.log(
    JSON.stringify({
      published: path(published),
      publishedRef: published.publicRef.toLowerCase(),
      publishedPhone: published.contactPhoneE164,
      callsOnly: path(callsOnly),
      sold: path(sold),
      expired: path(expired),
      oldSold: path(oldSold),
      deleted: path(deleted),
    }),
  );
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
