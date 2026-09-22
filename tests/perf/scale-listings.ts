// Escala las publicaciones [DEV] de moto_dev a ~10.000 filas para medir las
// consultas de listado con EXPLAIN (T-101, BUILD_PLAN.md A2). Sólo local:
// misma guarda que scripts/dev-fixtures.ts. Todo lo que crea lleva "[DEV]" en
// el título, y `npm run fixtures` lo borra.
//
//   npm run fixtures && npx tsx tests/perf/scale-listings.ts [total]
import "dotenv/config";

import { fixturesRefusalReason } from "../../scripts/lib/dev-fixtures-core";

async function main() {
  const refusal = fixturesRefusalReason(process.env);
  if (refusal) {
    console.error(`scale-listings: me niego a correr. ${refusal}`);
    process.exit(1);
  }
  const target = Number(process.argv[2] ?? 10_000);
  const { db, closeDb } = await import("../../src/db");
  const { sql } = await import("drizzle-orm");

  const [[{ n }]] = (await db.execute(sql`SELECT COUNT(*) AS n FROM listings WHERE title LIKE '[DEV]%'`)) as unknown as [[{ n: number }]];
  let current = Number(n);
  if (current === 0) throw new Error("Primero: npm run fixtures");
  let round = 0;
  while (current < target) {
    round += 1;
    const batch = Math.min(current, target - current);
    // Copia filas [DEV] existentes con slug y ref nuevos. Ref = "S" + hex de
    // (id·50 + ronda) con 0→W y 1→X: único y dentro del alfabeto de public_ref.
    await db.execute(sql`
      INSERT INTO listings (slug, public_ref, title, description, brand_id, model_id, model_raw, category_id, city_id,
        dealer_id, \`condition\`, year, mileage_km, engine_cc, price_gs, has_financing_only, down_payment_gs,
        installment_gs, installment_count, contact_phone_e164, contact_phone_raw, contact_whatsapp, documentation_status,
        status, published_at, expires_at, sold_at, is_featured, deleted_at)
      SELECT CONCAT(slug, '-s', ${round}, '-', id),
        CONCAT('S', REPLACE(REPLACE(LPAD(HEX(id * 50 + ${round}), 7, '0'), '0', 'W'), '1', 'X')),
        title, description, brand_id, model_id, model_raw, category_id, city_id,
        dealer_id, \`condition\`, year, mileage_km, engine_cc, price_gs, has_financing_only, down_payment_gs,
        installment_gs, installment_count, contact_phone_e164, contact_phone_raw, contact_whatsapp, documentation_status,
        status, published_at - INTERVAL ${round} HOUR, expires_at, sold_at, is_featured, deleted_at
      FROM listings WHERE title LIKE '[DEV]%' ORDER BY id LIMIT ${batch}`);
    const [[{ n: after }]] = (await db.execute(sql`SELECT COUNT(*) AS n FROM listings WHERE title LIKE '[DEV]%'`)) as unknown as [[{ n: number }]];
    current = Number(after);
    console.log(`ronda ${round}: ${current} publicaciones [DEV]`);
  }
  await db.execute(sql`ANALYZE TABLE listings`);
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
