import { describe, expect, it } from "vitest";
import { MAX_PAGES, normalizeQuery, parseAmount, parseCcRange, parsePage, parseSearchParams, toQueryEntries } from "./filters";

describe("parseSearchParams", () => {
  it("sin parámetros: sin filtros, orden por defecto, página 1, indexable", () => {
    const p = parseSearchParams({});
    expect(p).toEqual({ filters: {}, facets: {}, sort: "recientes", page: 1, hasFilterParams: false, hasPageParam: false });
  });

  it("lee todos los filtros de SEO_ARCHITECTURE.md §3.1", () => {
    const p = parseSearchParams(
      new URLSearchParams(
        "marca=honda&modelo=cg-150-titan&tipo=scooter&ciudad=luque&condicion=usada&precio_min=5.000.000&precio_max=15000000&anio_min=2019&km_max=30000&cilindrada=125-250&entrega_max=2000000&cuota_max=650000&q=  cg  150 &orden=precio_asc&page=3",
      ),
    );
    expect(p.filters).toEqual({
      condition: "used",
      priceMin: 5_000_000,
      priceMax: 15_000_000,
      yearMin: 2019,
      kmMax: 30_000,
      ccMin: 125,
      ccMax: 250,
      downPaymentMax: 2_000_000,
      installmentMax: 650_000,
      q: "cg 150",
    });
    expect(p.facets).toEqual({ brand: "honda", model: "cg-150-titan", category: "scooter", city: "luque" });
    expect(p.sort).toBe("precio_asc");
    expect(p.page).toBe(3);
    expect(p.hasFilterParams).toBe(true);
  });

  it("un filtro con valor inválido se ignora, pero la URL igual cuenta como filtrada (noindex)", () => {
    const p = parseSearchParams({ precio_max: "barato", orden: "cualquiera" });
    expect(p.filters).toEqual({});
    expect(p.sort).toBe("recientes");
    expect(p.hasFilterParams).toBe(true);
  });

  it("?page= solo no es filtro", () => {
    const p = parseSearchParams({ page: "2" });
    expect(p.hasFilterParams).toBe(false);
    expect(p.hasPageParam).toBe(true);
    expect(p.page).toBe(2);
  });

  it("parámetros ajenos (utm, fbclid) no son filtros", () => {
    expect(parseSearchParams({ utm_source: "wa", fbclid: "x" }).hasFilterParams).toBe(false);
  });

  it("parámetro repetido: vale el primero", () => {
    expect(parseSearchParams({ marca: ["yamaha", "honda"] }).facets.brand).toBe("yamaha");
  });

  it("slugs reservados o mal formados en facetas se descartan (G-15)", () => {
    expect(parseSearchParams({ marca: "ciudad", tipo: "../x", ciudad: "Asunción" }).facets).toEqual({});
  });
});

describe("parsers", () => {
  it("parseAmount acepta el formato visible de guaraníes", () => {
    expect(parseAmount("Gs. 12.500.000")).toBe(12_500_000);
    expect(parseAmount("12 500 000")).toBe(12_500_000);
    expect(parseAmount("-5")).toBeUndefined();
    expect(parseAmount("1e9")).toBeUndefined();
    expect(parseAmount("")).toBeUndefined();
  });

  it("parseCcRange", () => {
    expect(parseCcRange("150")).toEqual({ ccMin: 150, ccMax: 150 });
    expect(parseCcRange("-125")).toEqual({ ccMax: 125 });
    expect(parseCcRange("250-")).toEqual({ ccMin: 250 });
    expect(parseCcRange("300-100")).toEqual({});
    expect(parseCcRange("-")).toEqual({});
    expect(parseCcRange("abc")).toEqual({});
  });

  it("parsePage: 1…50, lo demás es 404", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("1")).toBe(1);
    expect(parsePage(String(MAX_PAGES))).toBe(MAX_PAGES);
    expect(parsePage(String(MAX_PAGES + 1))).toBeNull();
    expect(parsePage("0")).toBeNull();
    expect(parsePage("2.5")).toBeNull();
    expect(parsePage("abc")).toBeNull();
  });

  it("normalizeQuery", () => {
    expect(normalizeQuery("  honda \n\t cg ")).toBe("honda cg");
    expect(normalizeQuery("   ")).toBeUndefined();
    expect(normalizeQuery("x".repeat(300))?.length).toBe(100);
  });
});

describe("toQueryEntries", () => {
  it("ida y vuelta estable, sin orden por defecto ni página 1", () => {
    const parsed = parseSearchParams({ q: "cg", precio_max: "15000000", cilindrada: "150", condicion: "nueva", orden: "recientes" });
    expect(toQueryEntries({ ...parsed, page: 1 })).toEqual([
      ["condicion", "nueva"],
      ["precio_max", "15000000"],
      ["cilindrada", "150"],
      ["q", "cg"],
    ]);
    const again = parseSearchParams(new URLSearchParams(toQueryEntries({ ...parsed, page: 4 })));
    expect(again.filters).toEqual(parsed.filters);
    expect(again.page).toBe(4);
  });
});
