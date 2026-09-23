import { describe, expect, it } from "vitest";
import { approvalMessage, fraudKeywords, isPriceOutlier, median, REJECTION_CODES, REJECTION_TEXT } from "./texts";

describe("textos de moderación", () => {
  it("un aviso por código (salvo «otro», que exige nota), sin exclamaciones múltiples", () => {
    expect(REJECTION_CODES).toHaveLength(12);
    for (const c of REJECTION_CODES) {
      if (c === "otro") expect(REJECTION_TEXT[c]).toBe("");
      else expect(REJECTION_TEXT[c].length).toBeGreaterThan(40);
      expect(REJECTION_TEXT[c]).not.toMatch(/!!|contactar/i);
    }
    // sospecha_fraude nunca dice qué señal se vio.
    expect(REJECTION_TEXT.sospecha_fraude).not.toMatch(/precio|foto|tel[eé]fono|ip/i);
  });

  it("mensaje de aprobación con el enlace privado", () => {
    const m = approvalMessage({ title: "Honda XR 150L", listingUrl: "https://moto.com.py/aviso/x-abcdefgh", manageUrl: "https://moto.com.py/mi-aviso/TOKEN" });
    expect(m).toContain("https://moto.com.py/mi-aviso/TOKEN");
    expect(m).toContain("No lo compartas");
  });

  it("palabras de fraude (T&S §2 patrones 1 y 2), sin falsos positivos obvios", () => {
    expect(fraudKeywords("Estoy en Brasil, te la envío")).toHaveLength(2);
    expect(fraudKeywords("Reservá con 500.000 por transferencia adelantada")).not.toHaveLength(0);
    expect(fraudKeywords("Dejá una seña y la guardo")).not.toHaveLength(0);
    expect(fraudKeywords("Tiene señalero nuevo y buena señal de GPS")).toEqual([]);
    expect(fraudKeywords(null)).toEqual([]);
  });

  it("mediana y precio fuera de rango sólo con N ≥ 5", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBeNull();
    expect(isPriceOutlier(6_000_000, 10_000_000, 5)).toBe(true);
    expect(isPriceOutlier(7_000_000, 10_000_000, 5)).toBe(false);
    expect(isPriceOutlier(1_000_000, 10_000_000, 4)).toBe(false);
  });
});
