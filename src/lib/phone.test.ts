import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

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

  it("rechaza un número que no es celular paraguayo (no empieza con 9)", () => {
    expect(() => normalizePhone("0211234567")).toThrow();
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
