// Filas de prueba para las pruebas de integración de A1 (*.int.test.ts).
// Sólo las importan pruebas; cada archivo borra lo suyo en afterAll.
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, brands, categories, cities, dealers, listingImages, listings, models, users } from "@/db/schema";
import { publicRef } from "@/lib/slug";
import { hashPassword } from "./password";
import { sealSession } from "./session-seal";
import type { Role, SessionUser } from "./roles";

export const TEST_PASSWORD = "clave-de-prueba-larga";

export async function createFixtures(tag: string) {
  const [city] = await db.select({ id: cities.id }).from(cities).limit(1);
  const [model] = await db
    .select({ id: models.id, brandId: models.brandId })
    .from(models)
    .innerJoin(brands, eq(brands.id, models.brandId))
    .limit(1);
  const [category] = await db.select({ id: categories.id }).from(categories).limit(1);
  if (!city || !model || !category) {
    throw new Error("La base de pruebas no tiene catálogo. Correr npm run seed:catalog contra TEST_DATABASE_URL.");
  }
  const base = { brandId: model.brandId, modelId: model.id, categoryId: category.id, cityId: city.id };
  const ids = { dealers: [] as number[], users: [] as number[], listings: [] as number[] };
  const passwordHash = await hashPassword(TEST_PASSWORD, 4); // coste bajo: sólo pruebas

  return {
    base,
    ids,
    async dealer(opts: { autoApprove?: boolean; ttlDays?: number | null } = {}) {
      const n = ids.dealers.length + 1;
      const [res] = await db.insert(dealers).values({
        name: `[DEV] Comercio ${tag}-${n}`,
        slug: `dev-${tag}-${n}`,
        cityId: city.id,
        phoneE164: "+595981000000",
        phoneRaw: "0981 000 000",
        autoApprove: opts.autoApprove ?? false,
        listingTtlDays: opts.ttlDays ?? null,
      });
      ids.dealers.push(res.insertId);
      return res.insertId;
    },
    async user(role: Role, opts: { dealerId?: number | null; isActive?: boolean } = {}): Promise<SessionUser> {
      const n = ids.users.length + 1;
      const email = `${tag}-${n}-${role}@example.com`;
      const [res] = await db.insert(users).values({
        email,
        name: `[DEV] ${role} ${n}`,
        passwordHash,
        role,
        dealerId: opts.dealerId ?? null,
        isActive: opts.isActive ?? true,
      });
      ids.users.push(res.insertId);
      return { id: res.insertId, email, name: `[DEV] ${role} ${n}`, role, dealerId: opts.dealerId ?? null };
    },
    async listing(extra: Partial<typeof listings.$inferInsert> = {}, opts: { image?: boolean } = {}) {
      const n = ids.listings.length + 1;
      const [res] = await db.insert(listings).values({
        slug: `dev-${tag}-${n}`,
        publicRef: publicRef(),
        title: `[DEV] prueba ${tag} ${n}`,
        ...base,
        condition: "used",
        priceGs: 12_500_000,
        contactPhoneE164: "+595981123456",
        contactPhoneRaw: "0981 123 456",
        ...extra,
      });
      ids.listings.push(res.insertId);
      if (opts.image ?? true) {
        await db.insert(listingImages).values({
          listingId: res.insertId,
          storagePath: `dev/${tag}/${n}.webp`,
          contentHash: "0".repeat(64),
        });
      }
      return res.insertId;
    },
    async cleanup() {
      const conds = [];
      if (ids.listings.length) conds.push(and(eq(activityLog.entityType, "listing"), inArray(activityLog.entityId, ids.listings)));
      if (ids.users.length) conds.push(inArray(activityLog.userId, ids.users));
      if (conds.length) await db.delete(activityLog).where(or(...conds));
      if (ids.listings.length) await db.delete(listings).where(inArray(listings.id, ids.listings));
      if (ids.users.length) await db.delete(users).where(inArray(users.id, ids.users));
      if (ids.dealers.length) await db.delete(dealers).where(inArray(dealers.id, ids.dealers));
    },
  };
}

/** Header Cookie con una sesión válida del usuario, como la que deja el login. */
export async function sessionCookieFor(userId: number): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? "";
  return `moto_admin=${encodeURIComponent(await sealSession(userId, secret))}`;
}

export async function activityFor(listingId: number) {
  return db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.entityType, "listing"), eq(activityLog.entityId, listingId)))
    .orderBy(activityLog.id);
}
