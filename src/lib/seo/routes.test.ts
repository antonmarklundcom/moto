import { describe, expect, it } from "vitest";
import { parseSearchParams } from "@/lib/listings/filters";
import { RESERVED_SLUGS } from "@/lib/slug";
import {
  absoluteUrl,
  classifyMotosPath,
  facetRoute,
  listingPageHref,
  motosRoutePath,
  pagePath,
  parseListingParam,
  paths,
} from "./routes";

describe("paths (SEO_ARCHITECTURE.md §1)", () => {
  it("patrones de la taxonomía", () => {
    expect(paths.motos).toBe("/motos");
    expect(paths.brand("honda")).toBe("/motos/honda");
    expect(paths.model("honda", "cg-150-titan")).toBe("/motos/honda/cg-150-titan");
    expect(paths.category("scooter")).toBe("/motos/tipo/scooter");
    expect(paths.city("asuncion")).toBe("/motos/ciudad/asuncion");
    expect(paths.brandCity("honda", "asuncion")).toBe("/motos/honda/ciudad/asuncion");
    expect(paths.categoryCity("scooter", "luque")).toBe("/motos/tipo/scooter/ciudad/luque");
    expect(paths.condition("new")).toBe("/motos/nuevas");
    expect(paths.condition("used")).toBe("/motos/usadas");
    expect(paths.enCuotas).toBe("/motos/en-cuotas");
    expect(paths.dealer("motocenter-asuncion")).toBe("/comercios/motocenter-asuncion");
    expect(paths.guide("transferencia-de-chapa-moto-paraguay")).toBe("/guias/transferencia-de-chapa-moto-paraguay");
  });

  it("ficha: /aviso/<slug>-<ref> con el ref en minúsculas", () => {
    expect(paths.listing({ slug: "honda-cg-150-titan-2022-asuncion", publicRef: "A3F9K2P7" })).toBe(
      "/aviso/honda-cg-150-titan-2022-asuncion-a3f9k2p7",
    );
    expect(() => paths.listing({ slug: "x", publicRef: "0OIL1111" })).toThrow();
  });

  it("WhatsApp siempre por /ir/wa/* (ADR-07)", () => {
    expect(paths.whatsappListing(42)).toBe("/ir/wa/42");
    expect(paths.whatsappDealer(7)).toBe("/ir/wa/comercio/7");
    expect(paths.whatsappGeneral()).toBe("/ir/wa/general");
    expect(paths.whatsappGeneral("Honda CG en Luque")).toBe("/ir/wa/general?texto=Honda+CG+en+Luque");
    expect(() => paths.whatsappListing(0)).toThrow();
  });

  it("un slug reservado (G-15) o mal formado nunca llega a una URL", () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(() => paths.brand(reserved)).toThrow(/reservado/);
      expect(() => paths.city(reserved)).toThrow(/reservado/);
      expect(() => paths.model("honda", reserved)).toThrow(/reservado/);
    }
    expect(() => paths.brand("Honda")).toThrow();
    expect(() => paths.brand("honda/../x")).toThrow();
    expect(() => paths.brand("")).toThrow();
  });
});

describe("parseListingParam", () => {
  it("separa slug y ref (ref en mayúsculas)", () => {
    expect(parseListingParam("honda-cg-150-2022-asuncion-a3f9k2p7")).toEqual({
      slug: "honda-cg-150-2022-asuncion",
      ref: "A3F9K2P7",
    });
  });
  it("rechaza lo inválido", () => {
    expect(parseListingParam("sin-ref")).toBeNull();
    expect(parseListingParam("a3f9k2p7")).toBeNull();
    expect(parseListingParam("honda-a3f9k2p")).toBeNull();
    expect(parseListingParam("honda-a3f9k2p0")).toBeNull(); // 0 no está en el alfabeto
    expect(parseListingParam("Honda!-a3f9k2p7")).toBeNull();
  });
  it("ida y vuelta con paths.listing", () => {
    const url = paths.listing({ slug: "yamaha-ybr-125", publicRef: "ZZ22XX33" });
    expect(parseListingParam(url.replace("/aviso/", ""))).toEqual({ slug: "yamaha-ybr-125", ref: "ZZ22XX33" });
  });
});

describe("classifyMotosPath — combinaciones de §2.3 → 404", () => {
  it("rutas válidas", () => {
    expect(classifyMotosPath([])).toEqual({ kind: "motos" });
    expect(classifyMotosPath(["en-cuotas"])).toEqual({ kind: "en_cuotas" });
    expect(classifyMotosPath(["nuevas"])).toEqual({ kind: "condition", condition: "new" });
    expect(classifyMotosPath(["usadas"])).toEqual({ kind: "condition", condition: "used" });
    expect(classifyMotosPath(["honda"])).toEqual({ kind: "brand", brand: "honda" });
    expect(classifyMotosPath(["honda", "cg-150"])).toEqual({ kind: "model", brand: "honda", model: "cg-150" });
    expect(classifyMotosPath(["tipo", "scooter"])).toEqual({ kind: "category", category: "scooter" });
    expect(classifyMotosPath(["ciudad", "luque"])).toEqual({ kind: "city", city: "luque" });
    expect(classifyMotosPath(["honda", "ciudad", "luque"])).toEqual({ kind: "brand_city", brand: "honda", city: "luque" });
    expect(classifyMotosPath(["tipo", "scooter", "ciudad", "luque"])).toEqual({
      kind: "category_city",
      category: "scooter",
      city: "luque",
    });
  });

  it("prohibidas: marca × modelo × ciudad, año o precio como segmento, 3+ facetas", () => {
    expect(classifyMotosPath(["honda", "cg-150", "ciudad", "luque"])).toBeNull();
    expect(classifyMotosPath(["honda", "cg-150", "2019"])).toBeNull();
    expect(classifyMotosPath(["honda", "cg-150", "hasta-15000000"])).toBeNull();
    expect(classifyMotosPath(["tipo", "scooter", "ciudad", "luque", "honda"])).toBeNull();
    expect(classifyMotosPath(["honda", "ciudad", "luque", "tipo", "scooter"])).toBeNull();
    expect(classifyMotosPath(["tipo", "scooter", "ciudad"])).toBeNull();
    expect(classifyMotosPath(["tipo"])).toBeNull();
    expect(classifyMotosPath(["ciudad"])).toBeNull();
    expect(classifyMotosPath(["page"])).toBeNull();
    expect(classifyMotosPath(["tipo", "ciudad"])).toBeNull();
    expect(classifyMotosPath(["Honda"])).toBeNull();
  });

  it("motosRoutePath es la inversa", () => {
    const samples = [[], ["en-cuotas"], ["usadas"], ["honda"], ["honda", "cg-150"], ["tipo", "scooter"], ["ciudad", "luque"], ["honda", "ciudad", "luque"], ["tipo", "scooter", "ciudad", "luque"]];
    for (const segments of samples) {
      const route = classifyMotosPath(segments);
      expect(route).not.toBeNull();
      expect(motosRoutePath(route!)).toBe(segments.length ? `/motos/${segments.join("/")}` : "/motos");
    }
  });
});

describe("facetRoute (buscador → URL limpia)", () => {
  it("una o dos facetas con página propia", () => {
    expect(facetRoute({})).toEqual({ kind: "motos" });
    expect(facetRoute({ brand: "honda" })).toEqual({ kind: "brand", brand: "honda" });
    expect(facetRoute({ brand: "honda", model: "cg-150" })).toEqual({ kind: "model", brand: "honda", model: "cg-150" });
    expect(facetRoute({ brand: "honda", city: "luque" })).toEqual({ kind: "brand_city", brand: "honda", city: "luque" });
    expect(facetRoute({ category: "scooter", city: "luque" })).toEqual({ kind: "category_city", category: "scooter", city: "luque" });
    expect(facetRoute({ condition: "used" })).toEqual({ kind: "condition", condition: "used" });
  });
  it("sin página propia → null (queda como filtro noindex)", () => {
    expect(facetRoute({ brand: "honda", model: "cg-150", city: "luque" })).toBeNull();
    expect(facetRoute({ brand: "honda", category: "scooter" })).toBeNull();
    expect(facetRoute({ brand: "honda", condition: "new" })).toBeNull();
    expect(facetRoute({ model: "cg-150" })).toBeNull();
    expect(facetRoute({ brand: "honda", category: "scooter", city: "luque" })).toBeNull();
  });
});

describe("paginación y URLs absolutas", () => {
  it("pagePath: la página 1 es la URL limpia", () => {
    expect(pagePath("/motos/honda", 1)).toBe("/motos/honda");
    expect(pagePath("/motos/honda", 2)).toBe("/motos/honda?page=2");
    expect(() => pagePath("/motos", 51)).toThrow();
  });
  it("listingPageHref conserva los filtros", () => {
    const parsed = parseSearchParams({ precio_max: "15000000", orden: "precio_asc" });
    expect(listingPageHref("/motos/honda", parsed, 2)).toBe("/motos/honda?precio_max=15000000&orden=precio_asc&page=2");
    expect(listingPageHref("/motos/honda", parsed, 1)).toBe("/motos/honda?precio_max=15000000&orden=precio_asc");
  });
  it("absoluteUrl", () => {
    expect(absoluteUrl("/motos", "https://moto.com.py")).toBe("https://moto.com.py/motos");
    expect(absoluteUrl("/", "https://moto.com.py/")).toBe("https://moto.com.py");
    expect(() => absoluteUrl("motos", "https://moto.com.py")).toThrow();
  });
});
