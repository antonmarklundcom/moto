import { describe, expect, it } from "vitest";
import { packIp } from "./ip";
import { OTHER_MODEL, validatePublish, type PublishCatalog } from "./validate";

const catalog: PublishCatalog = {
  brands: [
    { id: 1, name: "Honda" },
    { id: 2, name: "Yamaha" },
  ],
  models: [
    { id: 10, brandId: 1, name: "Wave 110S", engineCc: 110, categoryId: 3 },
    { id: 20, brandId: 2, name: "XTZ 150", engineCc: 150, categoryId: null },
  ],
  categories: [
    { id: 3, name: "Cub" },
    { id: 4, name: "Enduro / Cross" },
  ],
  cities: [{ id: 7, name: "Luque" }],
};
const DESC = "Moto en muy buen estado, service al día, cubiertas nuevas. Papeles al día a mi nombre. La vendo porque me compré un auto y ya no la uso.";
const base = {
  marca: "1",
  modelo: "10",
  categoria: "",
  condicion: "used",
  anio: "2021",
  km: "18.500",
  cc: "",
  documentacion: "al_dia",
  precio: "8.500.000",
  ciudad: "7",
  telefono: "0981 123 456",
  descripcion: DESC,
};
const now = new Date("2026-09-23T12:00:00Z");
const check = (over: Record<string, string> = {}) => validatePublish({ ...base, ...over }, catalog, now);

describe("validatePublish", () => {
  it("una usada completa: título armado, categoría y cc del modelo, km como número", () => {
    const r = check();
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.values).toMatchObject({ title: "Honda Wave 110S 2021", categoryId: 3, engineCc: 110, mileageKm: 18_500, priceGs: 8_500_000, contactWhatsapp: true, contactPhoneE164: "+595981123456" });
  });

  it("usada sin año, km ni papeles → errores; 0 km sin año ni papeles está bien (G-12)", () => {
    const r = check({ anio: "", km: "", documentacion: "" });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["anio", "documentacion", "km"]);
    const nueva = check({ condicion: "new", anio: "", km: "", documentacion: "" });
    expect(nueva.ok && nueva.values).toMatchObject({ year: null, mileageKm: null, documentationStatus: null, title: "Honda Wave 110S 0 km" });
  });

  it("fijo sólo con «sólo llamadas» (G-3)", () => {
    expect(check({ telefono: "021 123 456" }).ok).toBe(false);
    const r = check({ telefono: "021 123 456", solo_llamadas: "1" });
    expect(r.ok && r.values).toMatchObject({ contactWhatsapp: false, contactPhoneE164: "+59521123456" });
  });

  it("descripción: mínimo 120 caracteres y sin datos de contacto", () => {
    expect(!check({ descripcion: "Corta" }).ok && (check({ descripcion: "Corta" }) as { errors: Record<string, string> }).errors.descripcion).toContain("mínimo 120");
    expect((check({ descripcion: `${DESC} Llamame al 0981 555 444` }) as { errors: Record<string, string> }).errors.descripcion).toContain("teléfono");
  });

  it("modelo: de otra marca → error; «no encuentro mi modelo» exige el texto y deja model_id nulo", () => {
    expect((check({ modelo: "20" }) as { errors: Record<string, string> }).errors.modelo).toContain("marca");
    expect((check({ modelo: OTHER_MODEL }) as { errors: Record<string, string> }).errors.modelo_texto).toBeDefined();
    const r = check({ modelo: OTHER_MODEL, modelo_texto: "Wave 125 Dash", categoria: "3" });
    expect(r.ok && r.values).toMatchObject({ modelId: null, modelRaw: "Wave 125 Dash", title: "Honda Wave 125 Dash 2021" });
  });

  it("precio: contado o cuota con cantidad; sólo cuota = sólo financiado", () => {
    expect((check({ precio: "" }) as { errors: Record<string, string> }).errors.precio).toBeDefined();
    const plan = check({ precio: "", cuota: "450.000", cuotas: "24", entrega: "1.000.000" });
    expect(plan.ok && plan.values).toMatchObject({ priceGs: null, hasFinancingOnly: true, installmentGs: 450_000, installmentCount: 24, downPaymentGs: 1_000_000 });
    expect((check({ cuota: "450000" }) as { errors: Record<string, string> }).errors.cuotas).toBeDefined();
  });
});

describe("packIp", () => {
  it("IPv4 → 4 bytes, IPv6 → 16 bytes, basura → null", () => {
    expect(packIp("190.104.1.2")?.toString("hex")).toBe("be680102");
    expect(packIp("2001:db8::1")?.toString("hex")).toBe("20010db8000000000000000000000001");
    expect(packIp("::ffff:10.0.0.1")?.toString("hex")).toBe("00000000000000000000ffff0a000001");
    expect(packIp("no")).toBeNull();
    expect(packIp(null)).toBeNull();
  });
});
