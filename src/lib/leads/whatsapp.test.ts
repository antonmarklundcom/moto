// TEST_PLAN.md §2 punto 8: el mensaje de WhatsApp se construye con datos
// reales, escapa bien y respeta el largo máximo.
import { describe, expect, it } from "vitest";
import {
  dealerWhatsAppMessage,
  generalWhatsAppMessage,
  listingWhatsAppMessage,
  WHATSAPP_MESSAGE_MAX,
  waMeUrl,
} from "./whatsapp";

const listing = {
  title: "Honda CG 150 Titan 2022",
  priceGs: 12_500_000,
  hasFinancingOnly: false,
  downPaymentGs: null,
  installmentGs: null,
  installmentCount: null,
  url: "https://moto.com.py/aviso/honda-cg-150-titan-2022-asuncion-a3f9k2p7",
};

describe("listingWhatsAppMessage", () => {
  it("formato exacto de INTEGRATIONS.md §1.2 con precio", () => {
    expect(listingWhatsAppMessage(listing)).toBe(
      "Hola, vi esta moto en moto.com.py:\nHonda CG 150 Titan 2022 — Gs. 12.500.000\nhttps://moto.com.py/aviso/honda-cg-150-titan-2022-asuncion-a3f9k2p7\n¿Sigue disponible?",
    );
  });

  it("sólo financiación → línea de entrega + cuotas", () => {
    const msg = listingWhatsAppMessage({
      ...listing,
      priceGs: null,
      hasFinancingOnly: true,
      downPaymentGs: 2_000_000,
      installmentGs: 650_000,
      installmentCount: 24,
    });
    expect(msg).toContain("Honda CG 150 Titan 2022 — Entrega Gs. 2.000.000 + 24 cuotas de Gs. 650.000");
  });

  it("sin precio ni cuotas → sólo el título, sin inventar nada", () => {
    const msg = listingWhatsAppMessage({ ...listing, priceGs: null });
    expect(msg.split("\n")[1]).toBe("Honda CG 150 Titan 2022");
  });

  it("título hostil: sin saltos, sin controles, sin emojis; no rompe las líneas", () => {
    const msg = listingWhatsAppMessage({ ...listing, title: "Moto\n¡¡OFERTA!!\r\u0007 🔥🔥 Yamaha  &text=hack#x" });
    const lines = msg.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe("Moto ¡¡OFERTA!! Yamaha &text=hack#x — Gs. 12.500.000");
    expect(msg).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("título larguísimo → se acorta el título, la URL y el precio quedan enteros, ≤ 300", () => {
    const msg = listingWhatsAppMessage({ ...listing, title: "Suzuki ".repeat(80) });
    expect(msg.length).toBeLessThanOrEqual(WHATSAPP_MESSAGE_MAX);
    expect(msg).toContain(listing.url);
    expect(msg).toContain("Gs. 12.500.000");
    expect(msg.endsWith("¿Sigue disponible?")).toBe(true);
    expect(msg).toContain("…");
  });
});

describe("otros mensajes", () => {
  it("comercio: nombre real + URL", () => {
    expect(dealerWhatsAppMessage({ name: "Motos Centro", url: "https://moto.com.py/comercios/motos-centro" })).toBe(
      "Hola, los encontré en moto.com.py:\nMotos Centro\nhttps://moto.com.py/comercios/motos-centro\nQuería hacer una consulta.",
    );
  });

  it("general: con y sin búsqueda (ADR-21), recortada", () => {
    expect(generalWhatsAppMessage()).toBe("Hola, les escribo desde moto.com.py.");
    expect(generalWhatsAppMessage("  Honda\nBiz 125 en Luque ")).toBe("Hola, les escribo desde moto.com.py.\nBusco: Honda Biz 125 en Luque");
    expect(generalWhatsAppMessage("x".repeat(1000)).length).toBeLessThanOrEqual(WHATSAPP_MESSAGE_MAX);
  });
});

describe("waMeUrl", () => {
  it("E.164 sin + y texto urlencoded que ida y vuelta da el mismo mensaje", () => {
    const msg = listingWhatsAppMessage({ ...listing, title: "Moto & más ? #1 =ok" });
    const url = waMeUrl("+595981123456", msg);
    expect(url.startsWith("https://wa.me/595981123456?text=")).toBe(true);
    const parsed = new URL(url);
    expect([...parsed.searchParams.keys()]).toEqual(["text"]);
    expect(parsed.searchParams.get("text")).toBe(msg);
  });

  it("un fijo no tiene WhatsApp: lanza", () => {
    expect(() => waMeUrl("+59521123456", "hola")).toThrow();
  });
});
