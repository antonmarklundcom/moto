// tsx no carga .env solo (CLAUDE.md §2) — se carga explícitamente acá.
// Import de solo efecto: debe ser el primero para correr antes que cualquier
// módulo que lea process.env al cargarse (los imports de ES se evalúan en orden).
import "dotenv/config";

import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { brands, categories, cities, models } from "../src/db/schema";
import { seedCatalog } from "../src/db/seed-catalog";

async function main() {
  await seedCatalog();

  const [{ count: cityCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cities);
  const [{ count: categoryCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(categories);
  const [{ count: brandCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(brands);
  const [{ count: modelCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(models);

  console.log(
    `Totales en base — ciudades: ${cityCount}, categorías: ${categoryCount}, marcas: ${brandCount}, modelos: ${modelCount}`,
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
