// /ir/wa redirige aunque registrar el evento falle (INTEGRATIONS.md §1.1).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events", () => ({
  recordListingEvent: vi.fn(async () => {
    throw new Error("base caída");
  }),
  isOwnReferer: () => true,
}));
vi.mock("./contact", () => ({
  listingWhatsAppTarget: vi.fn(async () => ({ kind: "listing", listingId: 1, dealerId: null, location: "https://wa.me/595981123456?text=hola" })),
  dealerWhatsAppTarget: vi.fn(async () => {
    throw new Error("base caída");
  }),
  generalWhatsAppTarget: vi.fn(() => null),
}));

const { handleWhatsAppRedirect } = await import("./redirect");

describe("handleWhatsAppRedirect", () => {
  it("el registro del evento falla → igual 302", async () => {
    const res = await handleWhatsAppRedirect(["1"], new Request("https://moto.com.py/ir/wa/1"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://wa.me/595981123456?text=hola");
  });

  it("no se puede resolver el destino (base caída) → 503, nunca un 302 a ciegas", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleWhatsAppRedirect(["comercio", "5"], new Request("https://moto.com.py/ir/wa/comercio/5"));
    expect(res.status).toBe(503);
    expect(spy).toHaveBeenCalled();
  });
});
