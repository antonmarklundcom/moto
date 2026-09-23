import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { brandSeeds } from "@/db/seed-data/brands";
import { categorySeeds } from "@/db/seed-data/categories";
import { citySeeds } from "@/db/seed-data/cities";
import { modelSeeds } from "@/db/seed-data/models";
import { fixturesRefusalReason } from "../../../scripts/lib/dev-fixtures-core";
import { mapHeaders, normalizeHeader, readRecord } from "./columns";
import { parseCsv } from "./csv";
import { buildPlan, type ExistingListing, listingChanges, refKey } from "./plan";
import {
  type CatalogSnapshot,
  contactInText,
  type DealerSnapshot,
  parseGs,
  type RowOk,
  type RowRejected,
  validateRow,
  type ValidateContext,
} from "./validate";

// Catálogo real de las semillas (el mismo que carga seed:catalog), con ids
// en orden. Los comercios: los tres de `npm run fixtures` y dos reales.
function seedCatalog(): CatalogSnapshot {
  const brands = brandSeeds.map((b, i) => ({ id: i + 1, name: b.name, slug: b.slug, isActive: b.isActive }));
  const models = modelSeeds.map((m, i) => ({
    id: i + 1,
    brandId: brands.find((b) => b.slug === m.brandSlug)!.id,
    name: m.name,
    slug: m.slug,
    isActive: m.isActive,
    categoryId: null,
    engineCc: m.engineCc ?? null,
  }));
  const cities = citySeeds.map((c, i) => ({ id: i + 1, name: c.name, slug: c.slug, isActive: true }));
  const categories = categorySeeds.map((c, i) => ({ id: i + 1, name: c.name, slug: c.slug, isActive: true }));
  const dealer = (id: number, slug: string, extra: Partial<DealerSnapshot> = {}): DealerSnapshot => ({
    id,
    name: slug.startsWith("dev-") ? `[DEV] ${slug}` : `Comercio ${id}`,
    slug,
    cityId: 1,
    phoneE164: "+595981000001",
    status: "active",
    deleted: false,
    authorizationNote: slug.startsWith("dev-") ? "[DEV] Sin autorización real" : "Autorizo publicar mi stock…",
    authorizationDate: slug.startsWith("dev-") ? null : "2026-09-01",
    autoApprove: false,
    listingTtlDays: 30,
    ...extra,
  });
  return {
    brands,
    models,
    cities,
    categories,
    dealers: [
      dealer(1, "dev-comercio-uno"),
      dealer(2, "dev-comercio-dos", { cityId: 2 }),
      dealer(3, "dev-comercio-tres", { cityId: 10 }),
      dealer(10, "motos-del-centro"),
      dealer(11, "sin-autorizacion", { authorizationNote: null, authorizationDate: null }),
      dealer(12, "archivado", { status: "archived" }),
    ],
  };
}

const LOCAL_ENV = {
  NODE_ENV: "development",
  ALLOW_DEV_FIXTURES: "1",
  DATABASE_URL: "mysql://moto:x@127.0.0.1:3306/moto_dev",
  SITE_URL: "http://localhost:3000",
};

function ctx(extra: Partial<ValidateContext> = {}): ValidateContext {
  return { catalog: seedCatalog(), defaultDealerId: null, demoRefusal: fixturesRefusalReason(LOCAL_ENV), currentYear: 2026, ...extra };
}

const HEADER = "comercio,referencia,marca,modelo,condicion,anio,kilometraje,ciudad,categoria,precio_contado_gs,entrega_gs,cuota_gs,cantidad_cuotas,solo_financiado,negociable,acepta_permuta,estado_documentacion,telefono,whatsapp,titulo,descripcion";

/** Una fila válida (usada) con cambios puntuales por columna. */
function row(changes: Record<string, string> = {}): string {
  const base: Record<string, string> = {
    comercio: "motos-del-centro",
    referencia: "HX-102",
    marca: "Yamaha",
    modelo: "XTZ 150",
    condicion: "usada",
    anio: "2021",
    kilometraje: "18.500",
    ciudad: "Asunción",
    categoria: "Enduro / Cross",
    precio_contado_gs: "15.500.000",
    entrega_gs: "",
    cuota_gs: "",
    cantidad_cuotas: "",
    solo_financiado: "no",
    negociable: "si",
    acepta_permuta: "no",
    estado_documentacion: "al_dia",
    telefono: "0981 123 456",
    whatsapp: "si",
    titulo: "",
    descripcion: "Un solo dueño, service al día.",
    ...changes,
  };
  return HEADER.split(",")
    .map((h) => (/[",\n]/.test(base[h]) ? `"${base[h].replace(/"/g, '""')}"` : base[h]))
    .join(",");
}

function validate(changes: Record<string, string> = {}, c: ValidateContext = ctx()) {
  const t = parseCsv(`${HEADER}\n${row(changes)}`);
  return validateRow(readRecord(t.rows[0].cells, mapHeaders(t.headers)), 2, c);
}

const rejected = (r: ReturnType<typeof validate>) => {
  expect(r.ok).toBe(false);
  return (r as RowRejected).problems;
};
const accepted = (r: ReturnType<typeof validate>) => {
  expect(r.ok, JSON.stringify(!r.ok && r.problems)).toBe(true);
  return r as RowOk;
};

describe("stock de demostración (docs/templates/demo/stock-demo.csv)", () => {
  const text = readFileSync("docs/templates/demo/stock-demo.csv", "utf8");

  it("en local (guarda en verde): 30 filas, 0 rechazos, todas [DEV]", () => {
    const plan = buildPlan(parseCsv(text), ctx(), new Map());
    const rejects = plan.items.filter((i) => i.kind === "reject");
    expect(rejects.map((r) => r.kind === "reject" && r.row.problems)).toEqual([]);
    expect(plan.counts).toEqual({ create: 30, update: 0, unchanged: 0, reject: 0 });
    for (const item of plan.items) {
      if (item.kind === "reject") continue;
      expect(item.row.isDemo).toBe(true);
      expect(item.row.values.title.startsWith("[DEV]")).toBe(true);
    }
  });

  it("con la guarda de fixtures en rojo se rechazan las 30, con el motivo de la guarda", () => {
    for (const env of [
      { ...LOCAL_ENV, NODE_ENV: "production" },
      { ...LOCAL_ENV, ALLOW_DEV_FIXTURES: undefined },
      { ...LOCAL_ENV, DATABASE_URL: "mysql://u:p@db.hostinger.com:3306/u123_moto" },
      { ...LOCAL_ENV, SITE_URL: "https://moto.com.py" },
    ]) {
      const refusal = fixturesRefusalReason(env);
      expect(refusal).not.toBeNull();
      const plan = buildPlan(parseCsv(text), ctx({ demoRefusal: refusal }), new Map());
      expect(plan.counts.reject).toBe(30);
      for (const item of plan.items) {
        expect(item.kind).toBe("reject");
        if (item.kind === "reject") expect(item.row.problems.map((p) => p.message).join(" ")).toContain(refusal!);
      }
    }
  });

  it("los encabezados del demo son los de la planilla modelo", () => {
    const template = readFileSync("docs/templates/stock-template.csv", "utf8").trim();
    expect(text.split("\n")[0].trim()).toBe(template);
  });
});

describe("validateRow", () => {
  it("fila válida: normaliza guaraníes, km, teléfono y arma el título", () => {
    const r = accepted(validate());
    expect(r.values).toMatchObject({
      title: "Yamaha XTZ 150 2021",
      condition: "used",
      mileageKm: 18_500,
      priceGs: 15_500_000,
      isNegotiable: true,
      contactPhoneE164: "+595981123456",
      contactWhatsapp: true,
      documentationStatus: "al_dia",
      engineCc: 150,
    });
    expect(r.dealerId).toBe(10);
    expect(r.isDemo).toBe(false);
  });

  it("sin precio ni cuota → sin_precio", () => {
    expect(rejected(validate({ precio_contado_gs: "" })).map((p) => p.code)).toContain("sin_precio");
  });

  it("sólo cuota: se publica como sólo financiado, con aviso", () => {
    const r = accepted(validate({ precio_contado_gs: "", cuota_gs: "480000", cantidad_cuotas: "24" }));
    expect(r.values).toMatchObject({ priceGs: null, hasFinancingOnly: true, installmentGs: 480_000, installmentCount: 24 });
    expect(r.warnings.join(" ")).toContain("sólo financiado");
  });

  it("cuota sin cantidad, o entrega sin cuota → datos_incompletos", () => {
    expect(rejected(validate({ cuota_gs: "480000" })).map((p) => p.message).join(" ")).toContain("cantidad de cuotas");
    expect(rejected(validate({ entrega_gs: "1000000" })).map((p) => p.message).join(" ")).toContain("entrega");
  });

  it("solo_financiado = si con precio de contado es una contradicción", () => {
    expect(rejected(validate({ solo_financiado: "si", cuota_gs: "480000", cantidad_cuotas: "24" })).length).toBe(1);
  });

  it("precio con decimales o demasiado bajo", () => {
    expect(parseGs("9500000,50")).toBeNull();
    expect(parseGs("Gs. 9.500.000")).toBe(9_500_000);
    expect(rejected(validate({ precio_contado_gs: "15500000,00" })).length).toBeGreaterThan(0);
    expect(rejected(validate({ precio_contado_gs: "15500" })).map((p) => p.code)).toContain("precio_irreal");
  });

  it("teléfono fijo con whatsapp = si se rechaza; con whatsapp = no es «sólo llamadas»", () => {
    expect(rejected(validate({ telefono: "021 000 000" })).map((p) => p.message).join(" ")).toContain("fijo");
    const r = accepted(validate({ telefono: "021 000 000", whatsapp: "no" }));
    expect(r.values).toMatchObject({ contactPhoneE164: "+59521000000", contactWhatsapp: false });
  });

  it("teléfono vacío = el del comercio", () => {
    const r = accepted(validate({ telefono: "" }));
    expect(r.values.contactPhoneE164).toBe("+595981000001");
    expect(r.values.contactPhoneRaw).toBe("0981 000 001");
  });

  it("datos de contacto en la descripción → contacto_en_descripcion", () => {
    for (const d of ["Llamame al 0981 555 123", "escribí a juan@correo.com", "más fotos en www.otro.com.py", "wa.me/595981"]) {
      expect(rejected(validate({ descripcion: d })).map((p) => p.code)).toContain("contacto_en_descripcion");
    }
    // Precios, cilindradas y años no son teléfonos.
    expect(contactInText("Precio Gs. 9.500.000, 150 cc, modelo 2021, 18.500 km")).toBeNull();
  });

  it("usada sin año ni km; 0 km con km", () => {
    const p = rejected(validate({ anio: "", kilometraje: "" })).map((x) => x.message).join(" ");
    expect(p).toContain("año");
    expect(p).toContain("kilometraje");
    expect(rejected(validate({ condicion: "0km", kilometraje: "500" })).map((x) => x.message).join(" ")).toContain("0 km");
  });

  it("usada sin documentación → no_declara con aviso; 0 km la deja en NULL", () => {
    const used = accepted(validate({ estado_documentacion: "" }));
    expect(used.values.documentationStatus).toBe("no_declara");
    const nueva = accepted(validate({ condicion: "0km", anio: "", kilometraje: "", estado_documentacion: "al_dia" }));
    expect(nueva.values).toMatchObject({ documentationStatus: null, mileageKm: null, title: "Yamaha XTZ 150 0 km" });
  });

  it("marca desconocida se rechaza; modelo desconocido entra con aviso y sin model_id", () => {
    expect(rejected(validate({ marca: "Motomel" })).map((p) => p.message).join(" ")).toContain("catálogo");
    const r = accepted(validate({ modelo: "XTZ 300 Rally" }));
    expect(r.unknownModel).toBe("XTZ 300 Rally");
    expect(r.values.modelId).toBeNull();
    expect(r.values.modelRaw).toBe("XTZ 300 Rally");
  });

  it("modelo inactivo del catálogo cuenta como desconocido (no se publica)", () => {
    const r = accepted(validate({ marca: "Honda", modelo: "CB 125", categoria: "Naked" }));
    expect(r.unknownModel).toBe("CB 125");
  });

  it("marca y modelo sin importar mayúsculas, tildes ni espacios; «Honda Wave 110S» también", () => {
    const r = accepted(validate({ marca: "HONDA", modelo: "honda wave110s", categoria: "cub" }));
    expect(r.values.modelId).not.toBeNull();
    expect(r.unknownModel).toBeNull();
  });

  it("sin categoría ni categoría en el modelo → rechazo", () => {
    expect(rejected(validate({ categoria: "" })).map((p) => p.message).join(" ")).toContain("categoría");
  });

  it("comercio: sin autorización, archivado, inexistente o distinto del elegido", () => {
    expect(rejected(validate({ comercio: "sin-autorizacion" })).map((p) => p.message).join(" ")).toContain("autorización");
    expect(rejected(validate({ comercio: "archivado" })).map((p) => p.message).join(" ")).toContain("archivado");
    expect(rejected(validate({ comercio: "no-existe" })).map((p) => p.code)).toContain("comercio");
    expect(rejected(validate({}, ctx({ defaultDealerId: 1 }))).map((p) => p.message).join(" ")).toContain("elegiste");
    const byForm = accepted(validate({ comercio: "" }, ctx({ defaultDealerId: 10 })));
    expect(byForm.dealerId).toBe(10);
    expect(rejected(validate({ comercio: "" })).map((p) => p.message).join(" ")).toContain("Falta el comercio");
  });

  it("comercio en prospecto: entra, con aviso de que no muestra WhatsApp", () => {
    const c = ctx();
    const catalog = { ...c.catalog, dealers: c.catalog.dealers.map((d) => (d.id === 10 ? { ...d, status: "prospect" as const } : d)) };
    expect(accepted(validate({}, { ...c, catalog })).warnings.join(" ")).toContain("no está activo");
  });

  it("referencia DEV- en un comercio real: sólo con la guarda en verde, y lleva [DEV]", () => {
    const ok = accepted(validate({ referencia: "DEV-X1" }));
    expect(ok.isDemo).toBe(true);
    expect(ok.values.title.startsWith("[DEV] ")).toBe(true);
    const refusal = fixturesRefusalReason({ ...LOCAL_ENV, NODE_ENV: "production" });
    expect(rejected(validate({ referencia: "DEV-X1" }, ctx({ demoRefusal: refusal }))).length).toBeGreaterThan(0);
    // Una fila normal no depende de la guarda.
    accepted(validate({}, ctx({ demoRefusal: refusal })));
  });
});

describe("buildPlan", () => {
  const csv = (...rows: string[]) => parseCsv([HEADER, ...rows].join("\n"));

  it("faltan columnas obligatorias → error del archivo, ninguna fila", () => {
    const plan = buildPlan(parseCsv("marca,modelo\nHonda,Wave 110S"), ctx(), new Map());
    expect(plan.fileErrors.join(" ")).toContain("referencia");
    expect(plan.items).toEqual([]);
  });

  it("columna desconocida: aviso, no error; alias «Año», «Precio»", () => {
    expect(normalizeHeader("PRECIO contado (Gs)")).toBe("precio_contado_gs");
    expect(mapHeaders(["Año"]).index.anio).toBe(0);
    expect(mapHeaders(["Referencia", "Marca", "Modelo", "Condición", "Precio", "Color"]).unknown).toEqual(["Color"]);
    expect(mapHeaders(["Precio"]).index.precio_contado_gs).toBe(0);
  });

  it("referencia repetida en el archivo (sin importar mayúsculas) → la segunda se rechaza", () => {
    const plan = buildPlan(csv(row(), row({ referencia: "hx-102" })), ctx(), new Map());
    expect(plan.counts).toMatchObject({ create: 1, reject: 1 });
  });

  it("existente igual → sin cambios; con otro precio → actualiza sólo ese campo", () => {
    const first = buildPlan(csv(row()), ctx(), new Map());
    const item = first.items[0];
    if (item.kind !== "create") throw new Error("esperaba create");
    const existing: ExistingListing = { id: 99, status: "published", deleted: false, ...item.row.values };
    const map = new Map([[refKey(10, "HX-102"), existing]]);
    expect(buildPlan(csv(row()), ctx(), map).counts.unchanged).toBe(1);
    const changed = buildPlan(csv(row({ precio_contado_gs: "14900000" })), ctx(), map);
    expect(changed.items[0]).toMatchObject({ kind: "update", listingId: 99, changes: { priceGs: { from: 15_500_000, to: 14_900_000 } } });
    expect(changed.hash).not.toBe(first.hash);
  });

  it("re-importar no deshace un modelo ya mapeado en Catálogo", () => {
    const plan = buildPlan(csv(row({ modelo: "XTZ 300 Rally" })), ctx(), new Map());
    const item = plan.items[0];
    if (item.kind !== "create") throw new Error("esperaba create");
    const mapped: ExistingListing = { id: 5, status: "published", deleted: false, ...item.row.values, modelId: 7, engineCc: 300 };
    expect(listingChanges(mapped, item.row.values)).toEqual({});
  });

  it("referencia de una publicación borrada → rechazo", () => {
    const plan = buildPlan(csv(row()), ctx(), new Map());
    const item = plan.items[0];
    if (item.kind !== "create") throw new Error("esperaba create");
    const map = new Map([[refKey(10, "HX-102"), { id: 1, status: "published", deleted: true, ...item.row.values }]]);
    expect(buildPlan(csv(row()), ctx(), map).counts.reject).toBe(1);
  });
});
