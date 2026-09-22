import { describe, expect, it } from "vitest";
import { parseVariantPath, pickVariantWidth, variantPath, variantPrefix, variantWidthsFor } from "./variants";

const H = "ab".repeat(32);

describe("variantes", () => {
  it("anchos: no agranda, la mayor lleva el ancho real", () => {
    expect(variantWidthsFor(4000)).toEqual([320, 640, 1024, 1600]);
    expect(variantWidthsFor(1600)).toEqual([320, 640, 1024, 1600]);
    expect(variantWidthsFor(900)).toEqual([320, 640, 900]);
    expect(variantWidthsFor(640)).toEqual([320, 640]);
    expect(variantWidthsFor(200)).toEqual([200]);
  });

  it("parsea la ruta de la variante mayor y rechaza lo demás", () => {
    const prefix = variantPrefix(H);
    expect(prefix).toBe(`listings/ab/${H.slice(0, 32)}`);
    expect(parseVariantPath(variantPath(prefix, 900))).toEqual({ prefix, maxWidth: 900, widths: [320, 640, 900] });
    expect(parseVariantPath("dev-fixtures/placeholder-1.png")).toBeNull();
    expect(parseVariantPath(`${prefix}-2000.webp`)).toBeNull();
    expect(parseVariantPath(`../${prefix}-640.webp`)).toBeNull();
  });

  it("elige la variante más chica que cubre el ancho pedido", () => {
    const w = [320, 640, 1024, 1600];
    expect(pickVariantWidth(w, 16)).toBe(320);
    expect(pickVariantWidth(w, 320)).toBe(320);
    expect(pickVariantWidth(w, 321)).toBe(640);
    expect(pickVariantWidth(w, 1080)).toBe(1600);
    expect(pickVariantWidth(w, 3840)).toBe(1600);
  });
});
