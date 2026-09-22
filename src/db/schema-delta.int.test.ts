import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leadIdempotencyKey } from "@/lib/hash";
import { publicRef } from "@/lib/slug";
import { closeDb, db } from "./index";
import { cities, brands, categories, dealers, jobRuns, leads, listings } from "./schema";

// Restricciones de la migración 0001 (ADR-17) y el UNIQUE de leads
// (TEST_PLAN.md §3). Crea sus propias filas y las borra al final.
const TAG = `int-${Date.now()}`;
let dealerId: number;
let base: { brandId: number; categoryId: number; cityId: number };
const listingIds: number[] = [];

async function insertListing(extra: Partial<typeof listings.$inferInsert> = {}) {
  const n = listingIds.length + 1;
  const [res] = await db.insert(listings).values({
    slug: `${TAG}-${n}`,
    publicRef: publicRef(),
    title: `[DEV] prueba ${n}`,
    ...base,
    condition: "used",
    contactPhoneE164: "+595981000000",
    contactPhoneRaw: "0981 000 000",
    ...extra,
  });
  listingIds.push(res.insertId);
  return res.insertId;
}

function duplicateKeyError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code === "ER_DUP_ENTRY" || (error as { code?: string }).code === "ER_DUP_ENTRY";
}

describe("migración 0001 (ADR-17)", () => {
  beforeAll(async () => {
    const [city] = await db.select({ id: cities.id }).from(cities).limit(1);
    const [brand] = await db.select({ id: brands.id }).from(brands).limit(1);
    const [category] = await db.select({ id: categories.id }).from(categories).limit(1);
    if (!city || !brand || !category) {
      throw new Error("La base de pruebas no tiene catálogo. Correr npm run seed:catalog contra TEST_DATABASE_URL.");
    }
    base = { brandId: brand.id, categoryId: category.id, cityId: city.id };
    const [res] = await db.insert(dealers).values({
      name: `Comercio ${TAG}`,
      slug: `comercio-${TAG}`,
      cityId: city.id,
      phoneE164: "+595981000000",
      phoneRaw: "0981 000 000",
      listingTtlDays: 30,
    });
    dealerId = res.insertId;
  });

  afterAll(async () => {
    if (listingIds.length) await db.delete(listings).where(inArray(listings.id, listingIds));
    if (dealerId) await db.delete(dealers).where(eq(dealers.id, dealerId));
    await db.delete(jobRuns).where(eq(jobRuns.job, TAG));
    await db.delete(leads).where(eq(leads.phoneRaw, TAG));
    await closeDb();
  });

  it("defaults: contact_whatsapp = true, documentation_status NULL", async () => {
    const id = await insertListing();
    const [row] = await db.select().from(listings).where(eq(listings.id, id));
    expect(row.contactWhatsapp).toBe(true);
    expect(row.documentationStatus).toBeNull();
    expect(row.externalRef).toBeNull();
    expect(row.manageTokenHash).toBeNull();
  });

  it("dealers.listing_ttl_days se guarda", async () => {
    const [row] = await db.select().from(dealers).where(eq(dealers.id, dealerId));
    expect(row.listingTtlDays).toBe(30);
  });

  it("UNIQUE(dealer_id, external_ref): re-importar la misma referencia choca (G-5)", async () => {
    await insertListing({ dealerId, externalRef: "STOCK-001" });
    await expect(insertListing({ dealerId, externalRef: "STOCK-001" })).rejects.toSatisfy(duplicateKeyError);
  });

  it("varios NULL en external_ref no chocan", async () => {
    await insertListing({ dealerId });
    await expect(insertListing({ dealerId })).resolves.toBeTypeOf("number");
  });

  it("job_runs.lock_key impide dos ejecuciones simultáneas del mismo job (ADR-19)", async () => {
    await db.insert(jobRuns).values({ job: TAG, lockKey: TAG, startedAt: new Date() });
    await expect(
      db.insert(jobRuns).values({ job: TAG, lockKey: TAG, startedAt: new Date() }),
    ).rejects.toSatisfy(duplicateKeyError);
    await db.update(jobRuns).set({ lockKey: null, status: "succeeded" }).where(eq(jobRuns.lockKey, TAG));
    await expect(
      db.insert(jobRuns).values({ job: TAG, lockKey: TAG, startedAt: new Date() }),
    ).resolves.toBeDefined();
    await db.update(jobRuns).set({ lockKey: null }).where(eq(jobRuns.job, TAG));
  });

  it("UNIQUE(leads.idempotency_key): el segundo insert falla limpio (TEST_PLAN.md §3)", async () => {
    const key = leadIdempotencyKey("+595981000000", `financing-${TAG}`);
    const lead = { type: "financing" as const, phoneE164: "+595981000000", phoneRaw: TAG, idempotencyKey: key };
    await db.insert(leads).values(lead);
    await expect(db.insert(leads).values(lead)).rejects.toSatisfy(duplicateKeyError);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.idempotencyKey, key));
    expect(Number(n)).toBe(1);
  });
});
