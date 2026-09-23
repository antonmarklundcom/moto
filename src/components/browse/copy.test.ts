import { describe, expect, it } from "vitest";
import { browseCopy, resultsLabel } from "./copy";
import { browseRouteFrom } from "./route";

const honda = { name: "Honda", slug: "honda" };
const luque = { name: "Luque", slug: "luque" };
const scooter = { name: "Scooter", slug: "scooter" };

describe("browseCopy (SEO_ARCHITECTURE §9)", () => {
  it("marca: título y descripción de la plantilla, con el conteo real", () => {
    const c = browseCopy("brand", { brand: honda }, 47);
    expect(c.title).toBe("Motos Honda en Paraguay — 47 publicadas");
    expect(c.description).toBe("Encontrá motos Honda en Paraguay. Precios en guaraníes, nuevas y usadas, contacto directo por WhatsApp.");
    expect(c.crumbs).toEqual([
      { name: "Motos", href: "/motos" },
      { name: "Honda", href: "/motos/honda" },
    ]);
  });

  it("con 0 publicaciones el título omite el conteo; singular con 1; miles con punto", () => {
    expect(browseCopy("city", { city: luque }, 0).title).toBe("Motos en Luque");
    expect(browseCopy("city", { city: luque }, 1).title).toBe("Motos en Luque — 1 publicada");
    expect(browseCopy("motos", {}, 1234).title).toBe("Motos en venta en Paraguay — 1.234 publicadas");
  });

  it("cruces y condición: h1, migas con las rutas del contrato", () => {
    const bc = browseCopy("brand_city", { brand: honda, city: luque }, 12);
    expect(bc.h1).toBe("Motos Honda en Luque");
    expect(bc.crumbs.map((c) => c.href)).toEqual(["/motos", "/motos/honda", "/motos/honda/ciudad/luque"]);
    const cc = browseCopy("category_city", { category: scooter, city: luque }, 3);
    expect(cc.crumbs.map((c) => c.href)).toEqual(["/motos", "/motos/tipo/scooter", "/motos/tipo/scooter/ciudad/luque"]);
    expect(browseCopy("condition", { condition: "new" }, 20).h1).toBe("Motos 0 km en Paraguay");
    expect(browseCopy("condition", { condition: "used" }, 20).crumbs[1].href).toBe("/motos/usadas");
  });

  it("descripciones entre 100 y 160 caracteres y sin números inventados", () => {
    for (const c of [
      browseCopy("motos", {}, 5),
      browseCopy("category", { category: scooter }, 5),
      browseCopy("city", { city: luque }, 5),
      browseCopy("brand_city", { brand: honda, city: luque }, 5),
      browseCopy("condition", { condition: "new" }, 5),
    ]) {
      expect(c.description.length).toBeGreaterThanOrEqual(100);
      expect(c.description.length).toBeLessThanOrEqual(160);
      expect(c.description.replace("0 km", "")).not.toMatch(/\d/);
    }
  });

  it("resultsLabel", () => {
    expect(resultsLabel(0)).toBe("Ninguna moto");
    expect(resultsLabel(1)).toBe("1 moto");
    expect(resultsLabel(2500)).toBe("2.500 motos");
  });
});

describe("browseRouteFrom: combinaciones prohibidas (§2.3) y slugs reservados → null", () => {
  it("rutas válidas", () => {
    expect(browseRouteFrom(["honda"], "brand")).toEqual({ kind: "brand", brand: "honda" });
    expect(browseRouteFrom(["honda", "ciudad", "luque"], "brand_city")).toEqual({ kind: "brand_city", brand: "honda", city: "luque" });
    expect(browseRouteFrom(["tipo", "scooter", "ciudad", "luque"], "category_city")).toEqual({
      kind: "category_city",
      category: "scooter",
      city: "luque",
    });
    expect(browseRouteFrom(["nuevas"], "condition")).toEqual({ kind: "condition", condition: "new" });
  });
  it("prohibidas o del tipo equivocado", () => {
    expect(browseRouteFrom(["tipo"], "brand")).toBeNull();
    expect(browseRouteFrom(["page"], "brand")).toBeNull();
    expect(browseRouteFrom(["Honda"], "brand")).toBeNull();
    expect(browseRouteFrom(["honda", "cg-150"], "brand")).toBeNull();
    expect(browseRouteFrom(["en-cuotas"], "brand")).toBeNull();
    expect(browseRouteFrom(["nuevas"], "brand")).toBeNull();
    expect(browseRouteFrom(["honda", "ciudad", "en-cuotas"], "brand_city")).toBeNull();
  });
});
