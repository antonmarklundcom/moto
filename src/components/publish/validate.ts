// Validación del formulario /publicar (T-107, PRODUCT_SPEC.md §2.2, T&S §3).
// Pura: recibe el catálogo activo. Todo se revalida en el servidor aunque el
// navegador ya lo haya chequeado.
import { contactInText } from "@/lib/import/validate";
import { isWhatsAppCapable, normalizePhone } from "@/lib/phone";

export const MIN_DESCRIPTION = 120;
export const MAX_DESCRIPTION = 3000;
export const OTHER_MODEL = "otro";

export type PublishCatalog = {
  brands: ReadonlyArray<{ id: number; name: string }>;
  models: ReadonlyArray<{ id: number; brandId: number; name: string; engineCc: number | null; categoryId: number | null }>;
  categories: ReadonlyArray<{ id: number; name: string }>;
  cities: ReadonlyArray<{ id: number; name: string }>;
};

export type PublishValues = {
  brandId: number;
  modelId: number | null;
  modelRaw: string | null;
  categoryId: number;
  condition: "new" | "used";
  year: number | null;
  mileageKm: number | null;
  engineCc: number | null;
  priceGs: number | null;
  hasFinancingOnly: boolean;
  downPaymentGs: number | null;
  installmentGs: number | null;
  installmentCount: number | null;
  isNegotiable: boolean;
  acceptsTradeIn: boolean;
  cityId: number;
  contactPhoneE164: string;
  contactPhoneRaw: string;
  contactName: string | null;
  contactWhatsapp: boolean;
  documentationStatus: "al_dia" | "transferencia_pendiente" | "no_declara" | null;
  description: string;
  title: string;
};

export type PublishValidation = { ok: true; values: PublishValues } | { ok: false; errors: Record<string, string> };

type Raw = Record<string, string | undefined>;

const idOf = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** Entero en guaraníes o km ("12.500.000", "Gs. 12.500.000"). `undefined` = vacío, `null` = inválido. */
export function amount(raw: string | undefined): number | undefined | null {
  const t = (raw ?? "").trim().replace(/^gs\.?\s*/i, "").replace(/[.\s]/g, "");
  if (t === "") return undefined;
  if (!/^\d{1,13}$/.test(t)) return null;
  return Number(t);
}

export const DOCUMENTATION_OPTIONS = [
  // [VALIDAR con un comercio] (H-9): etiquetas de docs/research/vocabulary-check.md.
  { value: "al_dia", label: "Papeles al día" },
  { value: "transferencia_pendiente", label: "Transferencia pendiente" },
  { value: "no_declara", label: "Prefiero no declararlo" },
] as const;

export function validatePublish(raw: Raw, catalog: PublishCatalog, now: Date = new Date()): PublishValidation {
  const e: Record<string, string> = {};
  const year = now.getUTCFullYear();

  const brand = catalog.brands.find((b) => b.id === idOf(raw.marca));
  if (!brand) e.marca = "Elegí la marca.";
  let modelId: number | null = null;
  let modelRaw: string | null = null;
  let modelName = "";
  let modelCc: number | null = null;
  let modelCategory: number | null = null;
  if (raw.modelo === OTHER_MODEL) {
    modelRaw = (raw.modelo_texto ?? "").trim().replace(/\s+/g, " ").slice(0, 120) || null;
    if (!modelRaw || modelRaw.length < 2) e.modelo_texto = "Escribí el modelo tal como figura en los papeles.";
    modelName = modelRaw ?? "";
  } else {
    const m = catalog.models.find((x) => x.id === idOf(raw.modelo));
    if (!m) e.modelo = "Elegí el modelo, o «No encuentro mi modelo».";
    else if (brand && m.brandId !== brand.id) e.modelo = "Ese modelo no es de la marca elegida.";
    else {
      modelId = m.id;
      modelName = m.name;
      modelCc = m.engineCc;
      modelCategory = m.categoryId;
    }
  }

  const categoryId = idOf(raw.categoria) ?? modelCategory;
  if (!categoryId || !catalog.categories.some((c) => c.id === categoryId)) e.categoria = "Elegí el tipo de moto.";

  const condition = raw.condicion === "new" || raw.condicion === "used" ? raw.condicion : null;
  if (!condition) e.condicion = "¿Es 0 km o usada?";

  const y = amount(raw.anio);
  if (y === null || (typeof y === "number" && (y < 1970 || y > year + 1))) e.anio = `Año entre 1970 y ${year + 1}.`;
  // G-12: el año es opcional en 0 km.
  else if (y === undefined && condition === "used") e.anio = "Poné el año de la moto.";

  const km = amount(raw.km);
  if (km === null || (typeof km === "number" && km > 2_000_000)) e.km = "Kilómetros sólo con números.";
  else if (km === undefined && condition === "used") e.km = "Poné los kilómetros que marca el tablero.";

  const cc = amount(raw.cc);
  if (cc === null || (typeof cc === "number" && (cc < 49 || cc > 2500))) e.cc = "Cilindrada en cc, por ejemplo 150.";

  const price = amount(raw.precio);
  const down = amount(raw.entrega);
  const installment = amount(raw.cuota);
  const count = amount(raw.cuotas);
  if (price === null) e.precio = "Precio sólo con números, en guaraníes.";
  if (down === null) e.entrega = "Entrega sólo con números.";
  if (installment === null) e.cuota = "Cuota sólo con números.";
  if (count === null || (typeof count === "number" && (count < 1 || count > 120))) e.cuotas = "Cantidad de cuotas entre 1 y 120.";
  const hasPrice = typeof price === "number" && price > 0;
  const hasPlan = typeof installment === "number" && installment > 0 && typeof count === "number" && count > 0;
  if (!e.precio && !e.cuota && !hasPrice && !hasPlan) e.precio = "Poné el precio de contado, o la cuota y cuántas cuotas.";
  if (hasPrice && (price as number) < 500_000) e.precio = "El precio parece muy bajo: revisá los ceros.";
  if (typeof installment === "number" && installment > 0 && !(typeof count === "number" && count > 0)) e.cuotas = "¿Cuántas cuotas?";

  const cityId = idOf(raw.ciudad);
  if (!cityId || !catalog.cities.some((c) => c.id === cityId)) e.ciudad = "Elegí tu ciudad.";

  const callsOnly = raw.solo_llamadas === "1" || raw.solo_llamadas === "on";
  let phoneE164 = "";
  const phoneRaw = (raw.telefono ?? "").trim().slice(0, 30);
  if (!phoneRaw) e.telefono = "Poné tu número de teléfono.";
  else {
    try {
      // G-3: un fijo sólo con «Sólo llamadas».
      phoneE164 = normalizePhone(phoneRaw, { allowLandline: callsOnly });
      if (!callsOnly && !isWhatsAppCapable(phoneE164)) e.telefono = "Para WhatsApp poné un celular (0981 123 456).";
    } catch {
      e.telefono = callsOnly ? "Revisá el número: 0981 123 456 o 021 123 456." : "Revisá el número: 0981 123 456. Si es un fijo, marcá «Sólo llamadas».";
    }
  }
  const name = (raw.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 100) || null;

  let documentationStatus: PublishValues["documentationStatus"] = null;
  if (condition === "used") {
    const d = raw.documentacion;
    if (d === "al_dia" || d === "transferencia_pendiente" || d === "no_declara") documentationStatus = d;
    else e.documentacion = "Contanos cómo están los papeles.";
  }

  const description = (raw.descripcion ?? "").trim().replace(/\r\n/g, "\n").slice(0, MAX_DESCRIPTION);
  if (description.length < MIN_DESCRIPTION) {
    e.descripcion = `Contá un poco más (mínimo ${MIN_DESCRIPTION} caracteres, llevás ${description.length}): el estado, si tiene papeles al día, por qué la vendés.`;
  } else if (contactInText(description)) {
    e.descripcion = "Sacá el teléfono, el correo o los enlaces: los compradores te escriben con el botón.";
  }

  if (Object.keys(e).length || !brand || !condition || !categoryId || !cityId) return { ok: false, errors: e };
  const titleYear = typeof y === "number" ? ` ${y}` : "";
  return {
    ok: true,
    values: {
      brandId: brand.id,
      modelId,
      modelRaw,
      categoryId,
      condition,
      year: typeof y === "number" ? y : null,
      mileageKm: condition === "used" && typeof km === "number" ? km : null,
      engineCc: typeof cc === "number" ? cc : modelCc,
      priceGs: hasPrice ? (price as number) : null,
      hasFinancingOnly: !hasPrice,
      downPaymentGs: hasPlan && typeof down === "number" && down > 0 ? down : hasPlan ? null : null,
      installmentGs: hasPlan ? (installment as number) : null,
      installmentCount: hasPlan ? (count as number) : null,
      isNegotiable: raw.negociable === "1" || raw.negociable === "on",
      acceptsTradeIn: raw.permuta === "1" || raw.permuta === "on",
      cityId,
      contactPhoneE164: phoneE164,
      contactPhoneRaw: phoneRaw,
      contactName: name,
      contactWhatsapp: !callsOnly,
      documentationStatus,
      description,
      title: `${brand.name} ${modelName}${titleYear}${condition === "new" ? " 0 km" : ""}`.replace(/\s+/g, " ").trim().slice(0, 200),
    },
  };
}
