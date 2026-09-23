import { describe, expect, it } from "vitest";
import { parseIntegerInput, safePagePath, validateLead } from "./validate";

describe("validateLead", () => {
  it("financiación completa: teléfono normalizado, extras con los nombres del CRM", () => {
    const r = validateLead({
      tipo: "financing",
      telefono: "0981 123 456",
      nombre: "  Juan   Pérez ",
      email: "",
      ciudad: "Luque",
      entrega_gs: "Gs. 2.000.000",
      plazo_meses: "24",
      situacion_laboral: "relacion_dependencia",
      aviso: "a3f9k2p7",
      pagina: "/aviso/honda-cg-a3f9k2p7?utm_source=x",
      pipeline: "hack",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        type: "financing",
        phoneE164: "+595981123456",
        phoneRaw: "0981 123 456",
        name: "Juan Pérez",
        email: null,
        message: null,
        listingRef: "A3F9K2P7",
        pagePath: "/aviso/honda-cg-a3f9k2p7",
        extras: {
          ciudad: "Luque",
          entrega_disponible_gs: 2_000_000,
          plazo_deseado_meses: 24,
          situacion_laboral: "relacion_dependencia",
        },
      },
    });
  });

  it("teléfono obligatorio y válido; mensajes en voseo", () => {
    const empty = validateLead({ tipo: "financing", telefono: "  " });
    expect(empty).toEqual({ ok: false, errors: { telefono: "Escribí tu número de teléfono." } });
    const bad = validateLead({ tipo: "financing", telefono: "123" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.telefono).toContain("0981 123 456");
  });

  it("acepta un fijo (se lo llama en vez de escribirle)", () => {
    const r = validateLead({ tipo: "insurance", telefono: "021 123 456" });
    expect(r.ok && r.value.phoneE164).toBe("+59521123456");
  });

  it("tipo desconocido o no comercial (general) → error", () => {
    expect(validateLead({ tipo: "general", telefono: "0981123456" }).ok).toBe(false);
    expect(validateLead({ telefono: "0981123456" }).ok).toBe(false);
  });

  it("errores por campo: email, entrega, plazo, situación", () => {
    const r = validateLead({
      tipo: "financing",
      telefono: "0981123456",
      email: "no-es-mail",
      entrega_gs: "dos millones",
      plazo_meses: "999",
      situacion_laboral: "jubilado",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "entrega_gs", "plazo_meses", "situacion_laboral"]);
  });

  it("sólo los extras del tipo; ref inválido → null", () => {
    const r = validateLead({ tipo: "dealer_plan", telefono: "0981123456", comercio_nombre: "Motos Sur", cantidad_motos: "40", entrega_gs: "5", aviso: "xx" });
    expect(r.ok && r.value.extras).toEqual({ comercio_nombre: "Motos Sur", cantidad_motos: 40 });
    expect(r.ok && r.value.listingRef).toBeNull();
  });

  it("mensaje multilínea se conserva; controles fuera", () => {
    const r = validateLead({ tipo: "advertising", telefono: "0981123456", mensaje: "Hola\nquiero un banner\u0000" });
    expect(r.ok && r.value.message).toBe("Hola\nquiero un banner");
  });
});

describe("helpers", () => {
  it("parseIntegerInput", () => {
    expect(parseIntegerInput("", 0, 10)).toBeNull();
    expect(parseIntegerInput("2.000.000", 0, 1e10)).toBe(2_000_000);
    expect(parseIntegerInput("-5", 0, 10)).toBe("invalid");
    expect(parseIntegerInput("11", 0, 10)).toBe("invalid");
  });
  it("safePagePath: sólo rutas internas", () => {
    expect(safePagePath("/financiacion?x=1#y")).toBe("/financiacion");
    expect(safePagePath("//evil.com/x")).toBeNull();
    expect(safePagePath("https://evil.com")).toBeNull();
    expect(safePagePath("/\\evil.com")).toBeNull();
    expect(safePagePath("/con espacio")).toBeNull();
  });
});
