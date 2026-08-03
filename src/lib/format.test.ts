import { describe, expect, it } from "vitest";
import { formatFinancing, formatGuaranies } from "./format";

// TEST_PLAN.md §2 punto 1: "12500000 → 'Gs. 12.500.000'". Casos: cero, nulo,
// números de 4 y 10 dígitos.
describe("formatGuaranies", () => {
  it("formatea un monto de 8 dígitos", () => {
    expect(formatGuaranies(12_500_000)).toBe("Gs. 12.500.000");
  });

  it("formatea cero", () => {
    expect(formatGuaranies(0)).toBe("Gs. 0");
  });

  it("devuelve null para null", () => {
    expect(formatGuaranies(null)).toBeNull();
  });

  it("devuelve null para undefined", () => {
    expect(formatGuaranies(undefined)).toBeNull();
  });

  it("formatea un número de 4 dígitos", () => {
    expect(formatGuaranies(1234)).toBe("Gs. 1.234");
  });

  it("formatea un número de 10 dígitos", () => {
    expect(formatGuaranies(1_234_567_890)).toBe("Gs. 1.234.567.890");
  });

  it("rechaza montos negativos", () => {
    expect(() => formatGuaranies(-100)).toThrow();
  });

  it("rechaza montos no enteros", () => {
    expect(() => formatGuaranies(100.5)).toThrow();
  });
});

describe("formatFinancing", () => {
  it("arma el texto de entrega + cuotas (CONTENT_STRATEGY.md §1.5)", () => {
    expect(
      formatFinancing({
        downPaymentGs: 2_000_000,
        installmentCount: 24,
        installmentGs: 650_000,
      }),
    ).toBe("Entrega Gs. 2.000.000 + 24 cuotas de Gs. 650.000");
  });

  it("rechaza cantidad de cuotas inválida", () => {
    expect(() =>
      formatFinancing({ downPaymentGs: 100, installmentCount: 0, installmentGs: 100 }),
    ).toThrow();
  });
});
