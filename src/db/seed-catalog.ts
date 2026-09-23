// Siembra idempotente del catálogo (ciudades, categorías, marcas, modelos) desde
// src/db/seed-data. La usan `npm run seed:catalog` y el arranque automático
// (src/lib/boot), que sólo la corre con la tabla de marcas vacía.
import { eq } from "drizzle-orm";
import { db } from "./index";
import { brands, categories, cities, models } from "./schema";
import { brandSeeds } from "./seed-data/brands";
import { categorySeeds } from "./seed-data/categories";
import { citySeeds } from "./seed-data/cities";
import { modelSeeds } from "./seed-data/models";

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
        isActive: brand.isActive,
        sortOrder: brand.sortOrder,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: brand.name,
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
        isActive: model.isActive,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: model.name,
          engineCc: model.engineCc ?? null,
          isActive: model.isActive,
        },
      });
  }
  console.log(`models: ${modelSeeds.length} procesados`);
}

export async function seedCatalog(): Promise<void> {
  await seedCities();
  await seedCategories();
  await seedBrands();
  await seedModels();
}
