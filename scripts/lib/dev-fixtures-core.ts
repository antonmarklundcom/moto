// Núcleo puro de scripts/dev-fixtures.ts (G-21): la guarda y el plan de
// publicaciones falsas. Sin base de datos ni fs, para poder probarlo.
//
// ADR-12 / ADR-24: no hay datos de demostración en producción ni en staging.
// Estas publicaciones existen sólo para desarrollar y probar páginas en local;
// todas llevan el prefijo "[DEV]" en el título y los comercios, el slug "dev-".

export const DEV_TITLE_PREFIX = "[DEV]";
export const DEV_DEALER_SLUG_PREFIX = "dev-";
export const DEV_EXTERNAL_REF_PREFIX = "DEV-";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type GuardEnv = {
  NODE_ENV?: string;
  ALLOW_DEV_FIXTURES?: string;
  DATABASE_URL?: string;
};

/**
 * Devuelve `null` si se puede correr, o el motivo por el que no. Exige las
 * tres condiciones: no producción, bandera explícita, y base en esta máquina.
 * Se compara contra una lista de hosts locales (no contra "el host de
 * producción", que esta sesión no conoce): cualquier host remoto se rechaza.
 */
export function fixturesRefusalReason(env: GuardEnv): string | null {
  if (env.NODE_ENV === "production") {
    return "NODE_ENV=production: las publicaciones de prueba nunca van a producción (ADR-12).";
  }
  if (env.ALLOW_DEV_FIXTURES !== "1") {
    return "Falta ALLOW_DEV_FIXTURES=1 en el entorno.";
  }
  if (!env.DATABASE_URL) {
    return "DATABASE_URL no está definida.";
  }
  let host: string;
  try {
    host = new URL(env.DATABASE_URL).hostname;
  } catch {
    return "DATABASE_URL no es una URL válida.";
  }
  if (!LOCAL_HOSTS.has(host)) {
    return `DATABASE_URL apunta a "${host}", que no es una base local. Sólo localhost/127.0.0.1.`;
  }
  return null;
}

// PRNG determinístico (mulberry32): el mismo plan en cada corrida, para que
// las páginas y las pruebas vean siempre los mismos conteos.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CatalogInput = {
  /** Marcas con al menos un modelo activo, en orden de sort_order. */
  brands: Array<{ slug: string; models: Array<{ slug: string; name: string; engineCc: number | null }> }>;
  /** Ciudades activas en orden de sort_order. */
  cities: string[];
  categories: string[];
};

export type FixtureStatus =
  | "published"
  | "sold"
  | "expired"
  | "pending_review"
  | "paused"
  | "rejected"
  | "draft";

export type FixtureListing = {
  key: string;
  brandSlug: string;
  modelSlug: string;
  modelName: string;
  citySlug: string;
  categorySlug: string;
  /** Índice en DEV_DEALERS, o null = particular. */
  dealerIndex: number | null;
  condition: "new" | "used";
  year: number | null;
  mileageKm: number | null;
  engineCc: number | null;
  priceGs: number | null;
  hasFinancingOnly: boolean;
  downPaymentGs: number | null;
  installmentGs: number | null;
  installmentCount: number | null;
  documentationStatus: "al_dia" | "transferencia_pendiente" | "no_declara" | null;
  contactWhatsapp: boolean;
  status: FixtureStatus;
  /** Días atrás de published_at (y de sold_at si status = sold). */
  publishedDaysAgo: number;
  soldDaysAgo: number | null;
  isFeatured: boolean;
  /** Grupo de borde de umbral al que pertenece, para las pruebas. */
  edge: string | null;
};

export const DEV_DEALERS = [
  { slug: "dev-comercio-uno", name: `${DEV_TITLE_PREFIX} Comercio Uno`, cityIndex: 0, ttlDays: 30 },
  { slug: "dev-comercio-dos", name: `${DEV_TITLE_PREFIX} Comercio Dos`, cityIndex: 1, ttlDays: 30 },
  { slug: "dev-comercio-tres", name: `${DEV_TITLE_PREFIX} Comercio Tres`, cityIndex: 9, ttlDays: null },
] as const;

export const FIXTURE_TOTAL = 200;

const THIS_YEAR = 2026;

/**
 * Arma el plan de ~200 publicaciones. Además de un relleno aleatorio
 * reproducible, fija grupos en los bordes de los umbrales de
 * SEO_ARCHITECTURE.md §2.1 para que haya páginas de los dos lados:
 * - `brand-city-over`: 12 publicadas de la 1.ª marca/modelo en la 1.ª ciudad (≥ 10).
 * - `brand-under`: la última marca tiene sólo 4 publicadas en total (< 5).
 * - `model-under`: un modelo con sólo 2 publicadas (< 3).
 * - `city-under`: la última ciudad tiene sólo 7 publicadas (< 8).
 * El relleno nunca toca la marca, el modelo ni la ciudad de esos grupos "under".
 */
export function planFixtures(catalog: CatalogInput, seed = 20260922): FixtureListing[] {
  if (catalog.brands.length < 3 || catalog.cities.length < 3 || catalog.categories.length < 1) {
    throw new Error("planFixtures: el catálogo necesita ≥ 3 marcas con modelos activos, ≥ 3 ciudades y ≥ 1 categoría.");
  }
  const random = seededRandom(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const roundGs = (value: number) => Math.round(value / 100_000) * 100_000;

  const firstBrand = catalog.brands[0];
  const lastBrand = catalog.brands[catalog.brands.length - 1];
  // Modelo "under": el 2.º modelo de la 2.ª marca si existe; si no, de la 1.ª.
  const underModelBrand = catalog.brands[1].models.length > 1 ? catalog.brands[1] : firstBrand;
  const underModel = underModelBrand.models[underModelBrand.models.length - 1];
  const firstCity = catalog.cities[0];
  const lastCity = catalog.cities[catalog.cities.length - 1];

  const listings: FixtureListing[] = [];

  function make(
    brand: CatalogInput["brands"][number],
    model: CatalogInput["brands"][number]["models"][number],
    citySlug: string,
    status: FixtureStatus,
    edge: string | null,
  ): FixtureListing {
    const n = listings.length + 1;
    const roll = random();
    const isNew = roll < 0.25;
    const financingOnly = !isNew && roll > 0.9 ? true : isNew && roll < 0.08;
    const dealerIndex = isNew || random() < 0.5 ? Math.floor(random() * DEV_DEALERS.length) : null;
    const cc = model.engineCc ?? 110;
    const basePrice = roundGs(cc * between(80_000, 120_000) + 4_000_000);
    const price = isNew ? basePrice : roundGs(basePrice * (0.45 + random() * 0.4));
    const offersInstallments = financingOnly || random() < 0.55;
    const installmentCount = offersInstallments ? pick([12, 18, 24, 30, 36]) : null;
    const downPayment = offersInstallments ? roundGs(price * pick([0, 0.1, 0.15, 0.2])) : null;
    const installment =
      offersInstallments && installmentCount
        ? roundGs(((price - (downPayment ?? 0)) * 1.45) / installmentCount) || 100_000
        : null;
    const publishedDaysAgo = between(0, 55);
    const soldDaysAgo =
      status === "sold" ? (edge === "sold-old" ? between(95, 140) : between(1, 60)) : null;
    const landlineOnly = dealerIndex !== null && random() < 0.05;

    return {
      key: `f${String(n).padStart(3, "0")}`,
      brandSlug: brand.slug,
      modelSlug: model.slug,
      modelName: model.name,
      citySlug,
      categorySlug: pick(catalog.categories),
      dealerIndex,
      condition: isNew ? "new" : "used",
      year: isNew ? (random() < 0.5 ? THIS_YEAR : null) : between(2012, THIS_YEAR - 1),
      mileageKm: isNew ? null : between(3, 90) * 1_000,
      engineCc: model.engineCc,
      priceGs: financingOnly ? null : price,
      hasFinancingOnly: financingOnly,
      downPaymentGs: downPayment,
      installmentGs: installment,
      installmentCount,
      documentationStatus: isNew ? null : pick(["al_dia", "al_dia", "transferencia_pendiente", "no_declara"] as const),
      contactWhatsapp: !landlineOnly,
      status,
      publishedDaysAgo: soldDaysAgo !== null ? Math.max(publishedDaysAgo, soldDaysAgo + 5) : publishedDaysAgo,
      soldDaysAgo,
      isFeatured: status === "published" && random() < 0.06,
      edge,
    };
  }

  // Grupos de borde.
  for (let i = 0; i < 12; i += 1) {
    listings.push(make(firstBrand, firstBrand.models[0], firstCity, "published", "brand-city-over"));
  }
  for (let i = 0; i < 4; i += 1) {
    listings.push(make(lastBrand, lastBrand.models[0], catalog.cities[1], "published", "brand-under"));
  }
  for (let i = 0; i < 2; i += 1) {
    listings.push(make(underModelBrand, underModel, catalog.cities[2], "published", "model-under"));
  }
  const fillBrands = catalog.brands.filter((b) => b.slug !== lastBrand.slug);
  for (let i = 0; i < 7; i += 1) {
    const brand = pick(fillBrands);
    const models = brand.models.filter((m) => m.slug !== underModel.slug);
    listings.push(make(brand, pick(models.length ? models : brand.models), lastCity, "published", "city-under"));
  }
  // Una vendida hace más de 90 días: ya no cuenta como viva.
  listings.push(make(firstBrand, firstBrand.models[0], firstCity, "sold", "sold-old"));

  // Relleno aleatorio reproducible.
  const fillCities = catalog.cities.filter((c) => c !== lastCity);
  const statusRoll: Array<[number, FixtureStatus]> = [
    [0.75, "published"],
    [0.83, "sold"],
    [0.88, "expired"],
    [0.92, "pending_review"],
    [0.95, "paused"],
    [0.98, "rejected"],
    [1, "draft"],
  ];
  while (listings.length < FIXTURE_TOTAL) {
    const brand = pick(fillBrands);
    const models = brand.models.filter((m) => m.slug !== underModel.slug);
    if (models.length === 0) continue;
    const r = random();
    const status = statusRoll.find(([limit]) => r < limit)![1];
    // Sesgo hacia Gran Asunción, como el mercado real.
    const city = random() < 0.4 ? fillCities[0] : pick(fillCities);
    listings.push(make(brand, pick(models), city, status, null));
  }

  return listings;
}

/** Título de la publicación: siempre con el prefijo [DEV]. */
export function fixtureTitle(listing: FixtureListing, brandName: string): string {
  const year = listing.year ? ` ${listing.year}` : "";
  const zeroKm = listing.condition === "new" ? " 0 km" : "";
  return `${DEV_TITLE_PREFIX} ${brandName} ${listing.modelName}${year}${zeroKm}`;
}
