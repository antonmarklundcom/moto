import { describe, expect, it } from "vitest";
import { isReservedSlug } from "@/lib/slug";
import { brandSeeds } from "./brands";
import { categorySeeds } from "./categories";
import { citySeeds } from "./cities";
import { modelSeeds } from "./models";

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Slugs sembrados antes de R0. Un slug publicado nunca cambia
// (DATABASE_SCHEMA.md, convenciones): se puede desactivar una fila, no borrarla.
const BRAND_SLUGS_BEFORE_R0 = ["honda", "yamaha", "suzuki", "bajaj", "tvs", "kenton", "zanella"];
const MODEL_SLUGS_BEFORE_R0 = [
  "yamaha/xtz-125", "yamaha/xtz-150", "yamaha/xtz-250", "yamaha/ybr-125z", "yamaha/crypton",
  "bajaj/boxer-150", "bajaj/rouser-ns-200", "bajaj/dominar-400",
  "suzuki/v-strom-250", "suzuki/v-strom-650", "suzuki/v-strom-800", "suzuki/v-strom-1050",
  "suzuki/dr-650", "suzuki/gixxer-150", "tvs/raider-125", "kenton/classic-125",
  "honda/cg-150-titan", "honda/xr-150", "honda/wave", "honda/cb-125",
];

const modelKey = (m: { brandSlug: string; slug: string }) => `${m.brandSlug}/${m.slug}`;

describe("semilla de catálogo", () => {
  it("todo slug tiene forma válida y no es reservado (G-15)", () => {
    const all = [
      ...brandSeeds.map((b) => b.slug),
      ...modelSeeds.map((m) => m.slug),
      ...citySeeds.map((c) => c.slug),
      ...categorySeeds.map((c) => c.slug),
    ];
    for (const slug of all) {
      expect(slug, slug).toMatch(SLUG_SHAPE);
      expect(isReservedSlug(slug), slug).toBe(false);
    }
  });

  it("no hay slugs duplicados", () => {
    const brands = brandSeeds.map((b) => b.slug);
    const models = modelSeeds.map(modelKey);
    expect(new Set(brands).size).toBe(brands.length);
    expect(new Set(models).size).toBe(models.length);
    expect(new Set(citySeeds.map((c) => c.slug)).size).toBe(citySeeds.length);
    expect(new Set(categorySeeds.map((c) => c.slug)).size).toBe(categorySeeds.length);
  });

  it("cada modelo apunta a una marca sembrada, y un modelo activo a una marca activa", () => {
    const brandBySlug = new Map(brandSeeds.map((b) => [b.slug, b]));
    for (const model of modelSeeds) {
      const brand = brandBySlug.get(model.brandSlug);
      expect(brand, modelKey(model)).toBeDefined();
      if (model.isActive) expect(brand!.isActive, modelKey(model)).toBe(true);
    }
  });

  it("inactivo ⇔ nota [VERIFICAR] (ADR-11)", () => {
    for (const row of [...brandSeeds, ...modelSeeds]) {
      const flagged = row.note?.includes("[VERIFICAR") ?? false;
      expect(flagged, row.slug).toBe(!row.isActive);
    }
  });

  it("ningún slug anterior a R0 desapareció", () => {
    const brands = new Set(brandSeeds.map((b) => b.slug));
    const models = new Set(modelSeeds.map(modelKey));
    for (const slug of BRAND_SLUGS_BEFORE_R0) expect(brands.has(slug), slug).toBe(true);
    for (const key of MODEL_SLUGS_BEFORE_R0) expect(models.has(key), key).toBe(true);
  });
});
