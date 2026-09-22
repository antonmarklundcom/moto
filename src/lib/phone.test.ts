import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, isWhatsAppCapable, normalizePhone } from "./phone";

// TEST_PLAN.md §2 punto 2: los cuatro formatos de entrada deben normalizar
// al mismo E.164. Entradas inválidas → error, nunca un valor a medias.
describe("normalizePhone", () => {
  const expected = "+595981123456";

  it.each([
    ["0981 123 456"],
    ["0981123456"],
    ["+595 981 123456"],
    ["595981123456"],
  ])("normaliza \"%s\" a +595981123456", (input) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("acepta el número nacional sin 0 ni código de país", () => {
    expect(normalizePhone("981123456")).toBe(expected);
  });

  it("rechaza una cadena vacía", () => {
    expect(() => normalizePhone("")).toThrow();
  });

  it("rechaza un número demasiado corto", () => {
    expect(() => normalizePhone("0981123")).toThrow();
  });

  it("rechaza un fijo por defecto (sólo celulares, F-7)", () => {
    expect(() => normalizePhone("0211234567")).toThrow();
  });

  it("acepta el prefijo internacional 00595", () => {
    expect(normalizePhone("00595 981 123 456")).toBe(expected);
  });

  it("rechaza un código de país distinto de 595", () => {
    expect(() => normalizePhone("+54981123456")).toThrow();
  });

  it("nunca devuelve un valor a medias: o lanza, o devuelve E.164 completo", () => {
    try {
      normalizePhone("no es un teléfono");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});

describe("normalizePhone con allowLandline (F-7)", () => {
  it.each([
    ["021 123 456", "+59521123456"],
    ["021 1234567", "+595211234567"],
    ["+595 21 123456", "+59521123456"],
    ["061 500 000", "+59561500000"],
  ])("normaliza el fijo \"%s\" a %s", (input, output) => {
    expect(normalizePhone(input, { allowLandline: true })).toBe(output);
  });

  it("sigue aceptando celulares", () => {
    expect(normalizePhone("0981 123 456", { allowLandline: true })).toBe("+595981123456");
  });

  it("rechaza fijos demasiado cortos o largos", () => {
    expect(() => normalizePhone("021 12345", { allowLandline: true })).toThrow();
    expect(() => normalizePhone("021 12345678", { allowLandline: true })).toThrow();
  });
});

describe("isWhatsAppCapable", () => {
  it("celular → true", () => {
    expect(isWhatsAppCapable("+595981123456")).toBe(true);
  });

  it("fijo → false", () => {
    expect(isWhatsAppCapable("+59521123456")).toBe(false);
  });

  it("otro país → false", () => {
    expect(isWhatsAppCapable("+54981123456")).toBe(false);
  });
});

describe("formatPhoneDisplay", () => {
  it("celular → 0981 123 456 (CLAUDE.md §3.2)", () => {
    expect(formatPhoneDisplay("+595981123456")).toBe("0981 123 456");
  });

  it("fijo de Asunción", () => {
    expect(formatPhoneDisplay("+59521123456")).toBe("021 123 456");
    expect(formatPhoneDisplay("+595211234567")).toBe("021 123 4567");
  });

  it("rechaza algo que no es E.164 paraguayo", () => {
    expect(() => formatPhoneDisplay("0981123456")).toThrow();
  });
});
