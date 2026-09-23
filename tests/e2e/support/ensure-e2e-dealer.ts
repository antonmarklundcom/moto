// Alta idempotente del comercio de prueba de tests/e2e/admin-import.spec.ts
// (slug `e2e-comercio`, con bloque de autorización). Sólo base local.
import "dotenv/config";

import { fixturesRefusalReason } from "../../../scripts/lib/dev-fixtures-core";

async function main() {
  const refusal = fixturesRefusalReason({ ...process.env, NODE_ENV: "development" });
  if (refusal) throw new Error(`ensure-e2e-dealer: ${refusal}`);
  const { eq } = await import("drizzle-orm");
  const { closeDb, db } = await import("../../../src/db");
  const { cities, dealers } = await import("../../../src/db/schema");
  const [existing] = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.slug, "e2e-comercio"));
  if (!existing) {
    const [city] = await db.select({ id: cities.id }).from(cities).limit(1);
    await db.insert(dealers).values({
      name: "[DEV] Comercio E2E",
      slug: "e2e-comercio",
      cityId: city.id,
      phoneE164: "+595981000321",
      phoneRaw: "0981 000 321",
      status: "active",
      authorizationNote: "[DEV] autorización de prueba",
      authorizationDate: "2026-09-01",
    });
  }
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
