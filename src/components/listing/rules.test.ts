import { describe, expect, it } from "vitest";
import { isReportReason, listingDescription, listingTitle, publicState, REPORT_REASONS } from "./rules";

const now = new Date("2026-09-23T12:00:00Z");
const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
const base = { deletedAt: null, soldAt: null, expiresAt: null };

describe("publicState (SEO_ARCHITECTURE §4)", () => {
  it("publicada, vendida, vencida; > 12 meses → retirada (redirección)", () => {
    expect(publicState({ ...base, status: "published" }, now).kind).toBe("live");
    expect(publicState({ ...base, status: "sold", soldAt: days(100) }, now).kind).toBe("sold");
    expect(publicState({ ...base, status: "sold", soldAt: days(366) }, now).kind).toBe("retired");
    expect(publicState({ ...base, status: "expired", expiresAt: days(30) }, now).kind).toBe("expired");
    expect(publicState({ ...base, status: "expired", expiresAt: days(400) }, now).kind).toBe("retired");
  });
  it("borrada → gone; borrador, en moderación, pausada, rechazada → hidden (404)", () => {
    expect(publicState({ ...base, status: "published", deletedAt: days(1) }, now).kind).toBe("gone");
    for (const status of ["draft", "pending_review", "paused", "rejected"]) {
      expect(publicState({ ...base, status }, now).kind).toBe("hidden");
    }
  });
});

describe("textos", () => {
  it("título §9 sin segmentos inventados", () => {
    expect(listingTitle({ brandName: "Honda", modelName: "XR 150L", modelRaw: null, year: 2021, priceText: "Gs. 15.500.000", cityName: "Luque" })).toBe(
      "Honda XR 150L 2021 — Gs. 15.500.000 en Luque",
    );
    expect(listingTitle({ brandName: "Honda", modelName: null, modelRaw: null, year: null, priceText: null, cityName: "Luque" })).toBe("Honda en Luque");
  });
  it("descripción §9: usada con km, 0 km, sólo llamadas", () => {
    expect(
      listingDescription({ condition: "used", mileageKm: 12000, kmText: "12.000 km", cityName: "Luque", financingText: null, whatsapp: true }),
    ).toBe("Usada con 12.000 km en Luque. Contactá al vendedor por WhatsApp.");
    expect(
      listingDescription({ condition: "new", mileageKm: null, kmText: null, cityName: "Luque", financingText: "Entrega Gs. 1.000.000 + 24 cuotas de Gs. 480.000", whatsapp: false }),
    ).toBe("0 km en Luque. Entrega Gs. 1.000.000 + 24 cuotas de Gs. 480.000. Llamá al vendedor.");
  });
  it("motivos de denuncia de T&S §5", () => {
    expect(REPORT_REASONS.map((r) => r.code)).toEqual(["estafa", "vendida", "precio_falso", "no_responde", "duplicada", "robada", "datos_incorrectos", "otro"]);
    expect(isReportReason("estafa")).toBe(true);
    expect(isReportReason("spam")).toBe(false);
  });
});
