import { describe, expect, it } from "vitest";
import { slugify, slugifyUnique } from "./slug";

// TEST_PLAN.md §2 punto 7: slug estable, sin acentos, con desambiguación al
// colisionar.
describe("slugify", () => {
  it("quita acentos y tildes", () => {
    expect(slugify("Honda CG 150 Titán")).toBe("honda-cg-150-titan");
  });

  it("normaliza la ñ", () => {
    expect(slugify("Ñemby")).toBe("nemby");
  });

  it("colapsa espacios y símbolos en un solo guion", () => {
    expect(slugify("  Múltiples   Espacios / Símbolos!! ")).toBe("multiples-espacios-simbolos");
  });

  it("es estable: la misma entrada siempre da el mismo slug", () => {
    expect(slugify("Yamaha XTZ 250")).toBe(slugify("Yamaha XTZ 250"));
  });

  it("rechaza una entrada que no produce ningún carácter válido", () => {
    expect(() => slugify("¡¡¡???")).toThrow();
  });
});

describe("slugifyUnique", () => {
  it("devuelve el slug base si no colisiona", () => {
    expect(slugifyUnique("Honda CG 150", () => false)).toBe("honda-cg-150");
  });

  it("desambigua con -2 si el slug base ya existe", () => {
    const existing = new Set(["honda-cg-150"]);
    expect(slugifyUnique("Honda CG 150", (c) => existing.has(c))).toBe("honda-cg-150-2");
  });

  it("sigue incrementando hasta encontrar uno libre", () => {
    const existing = new Set(["honda-cg-150", "honda-cg-150-2", "honda-cg-150-3"]);
    expect(slugifyUnique("Honda CG 150", (c) => existing.has(c))).toBe("honda-cg-150-4");
  });
});
