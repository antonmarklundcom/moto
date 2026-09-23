import { describe, expect, it } from "vitest";
import { baseName, isCatalogPhotoName, naturalCompare, refForFile } from "./photo-names";

describe("fotos por nombre de archivo", () => {
  const refs = ["HX-1", "HX-10", "DEV-U01", "AB"];

  it("la referencia más larga que encabeza el nombre, con separador después", () => {
    expect(refForFile("HX-10.jpg", refs)).toBe("HX-10");
    expect(refForFile("hx-10-2.JPG", refs)).toBe("HX-10");
    expect(refForFile("HX-1_catalogo.png", refs)).toBe("HX-1");
    expect(refForFile("HX-1 (3).jpeg", refs)).toBe("HX-1");
    expect(refForFile("carpeta/sub/DEV-U01.webp", refs)).toBe("DEV-U01");
    expect(refForFile("C:\\fotos\\DEV-U01-2.jpg", refs)).toBe("DEV-U01");
  });

  it("sin separador no hay coincidencia: ABC no es AB", () => {
    expect(refForFile("ABC.jpg", refs)).toBeNull();
    expect(refForFile("HX-100.jpg", refs)).toBeNull();
    expect(refForFile("foto.jpg", refs)).toBeNull();
  });

  it("foto de catálogo por nombre", () => {
    expect(isCatalogPhotoName("HX-1-catalogo.jpg")).toBe(true);
    expect(isCatalogPhotoName("HX-1-Catálogo.jpg")).toBe(true);
    expect(isCatalogPhotoName("HX-1-2.jpg")).toBe(false);
  });

  it("orden natural: 2 antes que 10", () => {
    const names = ["HX-1-10.jpg", "HX-1-2.jpg", "HX-1.jpg", "HX-1-1.jpg"];
    expect([...names].sort(naturalCompare)).toEqual(["HX-1-1.jpg", "HX-1-2.jpg", "HX-1-10.jpg", "HX-1.jpg"]);
    expect(baseName("a/b/c.jpg")).toBe("c.jpg");
  });
});
