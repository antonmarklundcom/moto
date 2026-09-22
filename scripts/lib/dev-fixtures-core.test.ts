import { describe, expect, it } from "vitest";
import {
  DEV_TITLE_PREFIX,
  FIXTURE_TOTAL,
  fixtureTitle,
  fixturesRefusalReason,
  planFixtures,
  type CatalogInput,
} from "./dev-fixtures-core";

const LOCAL_URL = "mysql://moto:x@127.0.0.1:3306/moto_dev";

describe("fixturesRefusalReason (G-21)", () => {
  it("corre con las tres condiciones", () => {
    expect(
      fixturesRefusalReason({ NODE_ENV: "development", ALLOW_DEV_FIXTURES: "1", DATABASE_URL: LOCAL_URL }),
    ).toBeNull();
  });

  it("se niega en producción aunque tenga la bandera", () => {
    expect(
      fixturesRefusalReason({ NODE_ENV: "production", ALLOW_DEV_FIXTURES: "1", DATABASE_URL: LOCAL_URL }),
    ).toMatch(/production/);
  });

  it.each([[undefined], [""], ["0"], ["true"], ["yes"]])(
    "se niega sin ALLOW_DEV_FIXTURES=1 (valor: %s)",
    (flag) => {
      expect(fixturesRefusalReason({ ALLOW_DEV_FIXTURES: flag, DATABASE_URL: LOCAL_URL })).toMatch(
        /ALLOW_DEV_FIXTURES/,
      );
    },
  );

  it.each([
    ["mysql://u:p@srv123.hstgr.io:3306/u1_moto"],
    ["mysql://u:p@10.0.0.5/moto"],
    ["mysql://u:p@moto.com.py/moto"],
  ])("se niega con una base remota: %s", (url) => {
    expect(fixturesRefusalReason({ ALLOW_DEV_FIXTURES: "1", DATABASE_URL: url })).toMatch(/no es una base local/);
  });

  it("se niega sin DATABASE_URL o con una URL inválida", () => {
    expect(fixturesRefusalReason({ ALLOW_DEV_FIXTURES: "1" })).not.toBeNull();
    expect(fixturesRefusalReason({ ALLOW_DEV_FIXTURES: "1", DATABASE_URL: "no-url" })).not.toBeNull();
  });

  it("se niega con una base con nombre de Hostinger aunque el host sea localhost", () => {
    expect(
      fixturesRefusalReason({ ALLOW_DEV_FIXTURES: "1", DATABASE_URL: "mysql://u:p@localhost/u123456789_moto" }),
    ).toMatch(/Hostinger/);
  });

  it("se niega si SITE_URL es el sitio público", () => {
    expect(
      fixturesRefusalReason({ ALLOW_DEV_FIXTURES: "1", DATABASE_URL: LOCAL_URL, SITE_URL: "https://moto.com.py" }),
    ).toMatch(/SITE_URL/);
  });

  it("acepta SITE_URL local", () => {
    expect(
      fixturesRefusalReason({ ALLOW_DEV_FIXTURES: "1", DATABASE_URL: LOCAL_URL, SITE_URL: "http://localhost:3000" }),
    ).toBeNull();
  });

  it("acepta localhost", () => {
    expect(
      fixturesRefusalReason({ ALLOW_DEV_FIXTURES: "1", DATABASE_URL: "mysql://u:p@localhost/moto_dev" }),
    ).toBeNull();
  });
});

const catalog: CatalogInput = {
  brands: [
    { slug: "yamaha", models: [{ slug: "xtz-125", name: "XTZ 125", engineCc: 125 }, { slug: "ybr-125z", name: "YBR 125Z", engineCc: 125 }] },
    { slug: "suzuki", models: [{ slug: "gixxer-150", name: "Gixxer 150", engineCc: 150 }, { slug: "dr-650", name: "DR 650", engineCc: 650 }] },
    { slug: "bajaj", models: [{ slug: "boxer-150", name: "Boxer 150", engineCc: 150 }] },
    { slug: "kenton", models: [{ slug: "classic-125", name: "Classic 125", engineCc: 125 }] },
  ],
  cities: ["asuncion", "san-lorenzo", "luque", "capiata", "concepcion"],
  categories: ["naked", "scooter"],
};

// "Viva" según SEO_ARCHITECTURE.md §2.1.
const isLive = (l: ReturnType<typeof planFixtures>[number]) =>
  l.status === "published" || (l.status === "sold" && (l.soldDaysAgo ?? 999) <= 90);

describe("planFixtures", () => {
  const plan = planFixtures(catalog);

  it(`genera ${FIXTURE_TOTAL} publicaciones y es determinístico`, () => {
    expect(plan).toHaveLength(FIXTURE_TOTAL);
    expect(planFixtures(catalog)).toEqual(plan);
  });

  it("marca por debajo del umbral: la última marca tiene 4 vivas (< 5)", () => {
    expect(plan.filter((l) => l.brandSlug === "kenton" && isLive(l))).toHaveLength(4);
  });

  it("modelo por debajo del umbral: 2 vivas (< 3)", () => {
    expect(plan.filter((l) => l.modelSlug === "dr-650" && isLive(l))).toHaveLength(2);
  });

  it("ciudad por debajo del umbral: 7 vivas (< 8)", () => {
    expect(plan.filter((l) => l.citySlug === "concepcion" && isLive(l))).toHaveLength(7);
  });

  it("marca × ciudad por encima del umbral (≥ 10)", () => {
    expect(
      plan.filter((l) => l.brandSlug === "yamaha" && l.citySlug === "asuncion" && isLive(l)).length,
    ).toBeGreaterThanOrEqual(10);
  });

  it("incluye 0 km, sólo-cuota, particulares, comercios y 'solo llamadas'", () => {
    expect(plan.some((l) => l.condition === "new")).toBe(true);
    expect(plan.some((l) => l.hasFinancingOnly && l.priceGs === null && l.installmentGs !== null)).toBe(true);
    expect(plan.some((l) => l.dealerIndex === null)).toBe(true);
    expect(plan.some((l) => l.dealerIndex !== null)).toBe(true);
    expect(plan.some((l) => !l.contactWhatsapp)).toBe(true);
  });

  it("respeta la regla de integridad: sin precio ⇒ sólo cuota con cuota informada", () => {
    for (const l of plan.filter((x) => x.priceGs === null)) {
      expect(l.hasFinancingOnly).toBe(true);
      expect(l.installmentGs).not.toBeNull();
    }
  });

  it("usadas tienen año, km y documentación; 0 km no tienen documentación", () => {
    for (const l of plan) {
      if (l.condition === "used") {
        expect(l.year).not.toBeNull();
        expect(l.mileageKm).not.toBeNull();
        expect(l.documentationStatus).not.toBeNull();
      } else {
        expect(l.documentationStatus).toBeNull();
      }
    }
  });

  it("cubre todos los estados de la máquina de estados", () => {
    const statuses = new Set(plan.map((l) => l.status));
    for (const s of ["published", "sold", "expired", "pending_review", "paused", "rejected", "draft"]) {
      expect(statuses).toContain(s);
    }
  });

  it("incluye una vendida hace más de 90 días (no viva)", () => {
    expect(plan.some((l) => l.status === "sold" && (l.soldDaysAgo ?? 0) > 90)).toBe(true);
  });
});

describe("fixtureTitle", () => {
  it("siempre empieza con [DEV]", () => {
    for (const l of planFixtures(catalog).slice(0, 20)) {
      expect(fixtureTitle(l, "Yamaha").startsWith(`${DEV_TITLE_PREFIX} `)).toBe(true);
    }
  });
});
