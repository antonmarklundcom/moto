// tsx no carga .env solo (CLAUDE.md §2) — se carga explícitamente acá.
// Import de solo efecto: debe ser el primero para correr antes que cualquier
// módulo que lea process.env al cargarse (los imports de ES se evalúan en orden).
import "dotenv/config";

import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { brands, categories, cities, models } from "../src/db/schema";
import { brandSeeds } from "../src/db/seed-data/brands";
import { categorySeeds } from "../src/db/seed-data/categories";
import { citySeeds } from "../src/db/seed-data/cities";
import { modelSeeds } from "../src/db/seed-data/models";

async function seedCities() {
  for (const city of citySeeds) {
    await db
      .insert(cities)
      .values({
        name: city.name,
        slug: city.slug,
        department: city.department,
        isMetroAsuncion: city.isMetroAsuncion,
        sortOrder: city.sortOrder,
        isActive: true,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: city.name,
          department: city.department,
          isMetroAsuncion: city.isMetroAsuncion,
          sortOrder: city.sortOrder,
        },
      });
  }
  console.log(`cities: ${citySeeds.length} procesadas`);
}

async function seedCategories() {
  for (const category of categorySeeds) {
    await db
      .insert(categories)
      .values({
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        isActive: true,
      })
      .onDuplicateKeyUpdate({
        set: { name: category.name, sortOrder: category.sortOrder },
      });
  }
  console.log(`categories: ${categorySeeds.length} procesadas`);
}

async function seedBrands() {
  for (const brand of brandSeeds) {
    await db
      .insert(brands)
      .values({
        name: brand.name,
        slug: brand.slug,
        introHtml: brand.note ?? null,
        isActive: brand.isActive,
        sortOrder: brand.sortOrder,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: brand.name,
          introHtml: brand.note ?? null,
          isActive: brand.isActive,
          sortOrder: brand.sortOrder,
        },
      });
  }
  console.log(`brands: ${brandSeeds.length} procesadas`);
}

async function seedModels() {
  for (const model of modelSeeds) {
    const [brand] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, model.brandSlug))
      .limit(1);

    if (!brand) {
      throw new Error(
        `Modelo "${model.name}" referencia una marca inexistente: ${model.brandSlug}. Sembrá marcas antes de modelos.`,
      );
    }

    await db
      .insert(models)
      .values({
        brandId: brand.id,
        name: model.name,
        slug: model.slug,
        engineCc: model.engineCc ?? null,
        introHtml: model.note ?? null,
        isActive: model.isActive,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: model.name,
          engineCc: model.engineCc ?? null,
          introHtml: model.note ?? null,
          isActive: model.isActive,
        },
      });
  }
  console.log(`models: ${modelSeeds.length} procesados`);
}

async function main() {
  await seedCities();
  await seedCategories();
  await seedBrands();
  await seedModels();

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
