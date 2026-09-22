import { describe, expect, it } from "vitest";
import {
  PUBLIC_REF_ALPHABET,
  RESERVED_SLUGS,
  isReservedSlug,
  parsePublicRef,
  publicRef,
  slugify,
  slugifyUnique,
  slugifyUniqueAsync,
} from "./slug";

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

describe("slugs reservados (G-15)", () => {
  it.each(["tipo", "ciudad", "nuevas", "usadas", "en-cuotas", "page"])("%s está reservado", (slug) => {
    expect(isReservedSlug(slug)).toBe(true);
  });

  it("la lista es exactamente la del contrato de rutas", () => {
    expect([...RESERVED_SLUGS].sort()).toEqual(
      ["ciudad", "en-cuotas", "nuevas", "page", "tipo", "usadas"],
    );
  });

  it("slugifyUnique nunca devuelve un slug reservado", () => {
    expect(slugifyUnique("Nuevas", () => false)).toBe("nuevas-2");
    expect(slugifyUnique("En cuotas", () => false)).toBe("en-cuotas-2");
  });

  it("un slug normal no está reservado", () => {
    expect(isReservedSlug("honda")).toBe(false);
  });
});

describe("slugifyUniqueAsync", () => {
  it("consulta de forma asíncrona y desambigua", async () => {
    const existing = new Set(["honda-cg-150", "honda-cg-150-2"]);
    await expect(
      slugifyUniqueAsync("Honda CG 150", async (c) => existing.has(c)),
    ).resolves.toBe("honda-cg-150-3");
  });

  it("salta los reservados", async () => {
    await expect(slugifyUniqueAsync("Ciudad", async () => false)).resolves.toBe("ciudad-2");
  });

  it("se rinde tras maxAttempts en vez de colgarse", async () => {
    await expect(slugifyUniqueAsync("x", async () => true, 5)).rejects.toThrow();
  });
});

describe("publicRef", () => {
  it("8 caracteres del alfabeto sin ambiguos", () => {
    for (let i = 0; i < 500; i += 1) {
      const ref = publicRef();
      expect(ref).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    }
  });

  it("el alfabeto no tiene 0, O, 1, I ni L", () => {
    expect(PUBLIC_REF_ALPHABET).not.toMatch(/[0O1IL]/);
  });

  it("parsePublicRef acepta minúsculas (URL) y devuelve mayúsculas", () => {
    expect(parsePublicRef("a3f9k2p7")).toBe("A3F9K2P7");
  });

  it("parsePublicRef rechaza caracteres ambiguos o largo incorrecto", () => {
    expect(parsePublicRef("A3F9K2P0")).toBeNull();
    expect(parsePublicRef("A3F9K2P")).toBeNull();
  });
});

describe("fuente de slug.ts (F-8)", () => {
  it("no contiene caracteres combinantes literales", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("./slug.ts", import.meta.url), "utf8");
    expect([...source].some((c) => c.charCodeAt(0) >= 0x300 && c.charCodeAt(0) <= 0x36f)).toBe(false);
  });
});
