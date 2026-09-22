import { describe, expect, it } from "vitest";
import imageLoader from "./image-loader";

const P = `listings/ab/${"ab".repeat(16)}`;

describe("imageLoader", () => {
  it("elige la variante más chica que cubre el ancho", () => {
    const src = `/media/${P}-1600.webp`;
    expect(imageLoader({ src, width: 256 })).toBe(`/media/${P}-320.webp`);
    expect(imageLoader({ src, width: 640 })).toBe(`/media/${P}-640.webp`);
    expect(imageLoader({ src, width: 828 })).toBe(`/media/${P}-1024.webp`);
    expect(imageLoader({ src, width: 3840 })).toBe(`/media/${P}-1600.webp`);
  });

  it("no pide variantes que no existen en una foto angosta", () => {
    const src = `/media/${P}-900.webp`;
    expect(imageLoader({ src, width: 1080 })).toBe(`/media/${P}-900.webp`);
    expect(imageLoader({ src, width: 700 })).toBe(`/media/${P}-900.webp`);
    expect(imageLoader({ src, width: 500 })).toBe(`/media/${P}-640.webp`);
  });

  it("sin variantes (fixtures PNG, public/) sirve el original", () => {
    expect(imageLoader({ src: "/media/dev-fixtures/placeholder-1.png", width: 640 })).toBe(
      "/media/dev-fixtures/placeholder-1.png?w=640",
    );
    expect(imageLoader({ src: "/logo.png?v=2", width: 320 })).toBe("/logo.png?v=2&w=320");
  });
});
