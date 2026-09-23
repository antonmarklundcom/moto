import { describe, expect, it } from "vitest";
import { formatDatePy, isoDatePy, parseReportRange, reconfirmMessage, reportMessage } from "./messages";

describe("mensajes para el comercio", () => {
  it("fecha en hora de Paraguay (UTC−3)", () => {
    expect(formatDatePy(new Date("2026-09-24T02:59:00Z"))).toBe("23/09/2026");
    expect(formatDatePy(new Date("2026-09-24T03:00:00Z"))).toBe("24/09/2026");
    expect(isoDatePy(new Date("2026-01-01T01:00:00Z"))).toBe("2025-12-31");
  });

  it("reporte: los números tal cual, con separador de miles, y el rango", () => {
    const text = reportMessage({
      dealerName: "Motos del Centro",
      from: new Date("2026-08-24T03:00:00Z"),
      to: new Date("2026-09-24T03:00:00Z"),
      publishedNow: 12,
      views: 1234,
      whatsappClicks: 0,
      financingLeads: 3,
    });
    expect(text).toContain("*Reporte de Motos del Centro en moto.com.py*");
    expect(text).toContain("Del 24/08/2026 al 23/09/2026");
    expect(text).toContain("Visitas a tus motos: 1.234");
    expect(text).toContain("Consultas por WhatsApp: 0");
    expect(text).toContain("Pedidos de financiación: 3");
    expect(text).not.toMatch(/más de|aprox|~/i);
  });

  it("reconfirmar: referencia del comercio, título y precio o cuotas", () => {
    const text = reconfirmMessage("Motos del Centro", [
      { externalRef: "HX-1", publicRef: "ABCDEFGH", title: "Honda Wave 110S 0 km", priceGs: 9_500_000, downPaymentGs: null, installmentGs: null, installmentCount: null },
      { externalRef: null, publicRef: "JKMNPQRS", title: "Honda XR 150L", priceGs: null, downPaymentGs: 0, installmentGs: 480_000, installmentCount: 24 },
    ]);
    expect(text).toContain("tus 2 motos publicadas");
    expect(text).toContain("• HX-1 · Honda Wave 110S 0 km · Gs. 9.500.000");
    expect(text).toContain("• JKMNPQRS · Honda XR 150L · 24 cuotas de Gs. 480.000");
    expect(reconfirmMessage("X", [])).toContain("no tenés motos publicadas");
  });

  it("rango del reporte: por defecto 30 días; fechas de Paraguay, ambas incluidas; inválido → por defecto", () => {
    const now = new Date("2026-09-23T15:00:00Z");
    expect(parseReportRange(undefined, undefined, now)).toEqual({ from: new Date("2026-08-24T15:00:00Z"), to: now, custom: false });
    expect(parseReportRange("2026-09-01", "2026-09-10", now)).toEqual({
      from: new Date("2026-09-01T03:00:00Z"),
      to: new Date("2026-09-11T03:00:00Z"),
      custom: true,
    });
    expect(parseReportRange("2026-02-30", "2026-03-01", now).custom).toBe(false);
    expect(parseReportRange("2026-09-10", "2026-09-01", now).custom).toBe(false);
    expect(parseReportRange("2024-01-01", "2026-09-01", now).custom).toBe(false);
  });
});
