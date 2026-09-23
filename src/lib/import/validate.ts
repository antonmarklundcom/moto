// Validación de una fila de la planilla de stock contra el catálogo (G-18).
// Pura: recibe una foto del catálogo y de los comercios, no toca la base.
//
// Aplica la parte automatizable del checklist del moderador
// (TRUST_AND_SAFETY.md §3) y de DATA_SEEDING.md §4: marca y modelo del
// catálogo, precio de contado o esquema de financiación completo, ciudad y
// teléfono válidos, descripción sin datos de contacto, y el bloque de
// autorización del comercio (ADR-12). Lo que no se puede ver en una planilla
// (fotos ajenas, patrones de fraude) lo sigue viendo una persona.
import { DEV_DEALER_SLUG_PREFIX, DEV_EXTERNAL_REF_PREFIX, DEV_TITLE_PREFIX } from "../../../scripts/lib/dev-fixtures-core";
import { formatPhoneDisplay, isWhatsAppCapable, normalizePhone } from "../phone";
import type { StockColumn } from "./columns";

export type CatalogSnapshot = {
  brands: ReadonlyArray<{ id: number; name: string; slug: string; isActive: boolean }>;
  models: ReadonlyArray<{
    id: number;
    brandId: number;
    name: string;
    slug: string;
    isActive: boolean;
    categoryId: number | null;
    engineCc: number | null;
  }>;
  cities: ReadonlyArray<{ id: number; name: string; slug: string; isActive: boolean }>;
  categories: ReadonlyArray<{ id: number; name: string; slug: string; isActive: boolean }>;
  dealers: ReadonlyArray<DealerSnapshot>;
};

export type DealerSnapshot = {
  id: number;
  name: string;
  slug: string;
  cityId: number;
  phoneE164: string;
  status: "prospect" | "active" | "paused" | "archived";
  deleted: boolean;
  authorizationNote: string | null;
  authorizationDate: string | null;
  autoApprove: boolean;
  listingTtlDays: number | null;
};

/** Códigos de TRUST_AND_SAFETY.md §4 cuando corresponden; `planilla` = error de formato del archivo. */
export type RejectCode =
  | "datos_incompletos"
  | "sin_precio"
  | "precio_irreal"
  | "contacto_en_descripcion"
  | "duplicada"
  | "comercio"
  | "planilla";

export type Problem = { code: RejectCode; message: string };

/** Lo que se escribe en `listings` (salvo slug, ref pública, estado y fechas). */
export type ListingValues = {
  title: string;
  description: string | null;
  brandId: number;
  modelId: number | null;
  modelRaw: string | null;
  categoryId: number;
  cityId: number;
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
  contactPhoneE164: string;
  contactPhoneRaw: string;
  contactWhatsapp: boolean;
  documentationStatus: "al_dia" | "transferencia_pendiente" | "no_declara" | null;
};

export type RowOk = {
  ok: true;
  line: number;
  dealerId: number;
  externalRef: string;
  values: ListingValues;
  /** Modelo que no está en el catálogo (o está inactivo): va a `model_suggestions` y no se publica. */
  unknownModel: string | null;
  isDemo: boolean;
  warnings: string[];
};

export type RowRejected = {
  ok: false;
  line: number;
  dealerId: number | null;
  externalRef: string | null;
  problems: Problem[];
};

export type RowResult = RowOk | RowRejected;

export type ValidateContext = {
  catalog: CatalogSnapshot;
  /** Comercio elegido para todo el archivo (formulario o `--comercio`). */
  defaultDealerId: number | null;
  /** `fixturesRefusalReason()`: `null` = base local, se aceptan filas `DEV-` / comercios `dev-`. */
  demoRefusal: string | null;
  /** Año actual (inyectado para las pruebas). */
  currentYear: number;
};

export const MIN_PRICE_GS = 1_000_000;
export const MIN_INSTALLMENT_GS = 50_000;
export const MAX_INSTALLMENTS = 120;
export const MAX_DESCRIPTION = 5_000;
export const MAX_TITLE = 200;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;

/** Clave de comparación: minúsculas, sin tildes, sin espacios ni signos. "Wave 110S" = "wave-110s" = "WAVE110S". */
export function matchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findByNameOrSlug<T extends { name: string; slug: string }>(items: readonly T[], text: string): T | undefined {
  const key = matchKey(text);
  if (key === "") return undefined;
  return items.find((i) => matchKey(i.slug) === key) ?? items.find((i) => matchKey(i.name) === key);
}

/** Guaraníes enteros: "9500000", "9.500.000", "Gs. 9.500.000". `undefined` = vacío; `null` = inválido. */
export function parseGs(raw: string | undefined): number | undefined | null {
  const text = (raw ?? "").trim();
  if (text === "") return undefined;
  const cleaned = text.replace(/^gs\.?\s*/i, "").replace(/\s/g, "");
  // "9.500.000" y "9,500,000" son separadores de miles; "950000,50" no.
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned.replace(/[.,]/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** Entero ≥ 0 ("18.500" = 18500). */
export function parseInteger(raw: string | undefined): number | undefined | null {
  return parseGs(raw);
}

/** si/no. `undefined` = vacío; `null` = ni sí ni no. */
export function parseYesNo(raw: string | undefined): boolean | undefined | null {
  const key = matchKey(raw ?? "");
  if (key === "") return undefined;
  if (["si", "s", "yes", "y", "true", "1", "x"].includes(key)) return true;
  if (["no", "n", "false", "0"].includes(key)) return false;
  return null;
}

export function parseCondition(raw: string | undefined): "new" | "used" | null {
  const key = matchKey(raw ?? "");
  if (["0km", "okm", "nueva", "nuevo", "new", "cerokm"].includes(key)) return "new";
  if (["usada", "usado", "used", "semi", "seminueva", "seminuevo"].includes(key)) return "used";
  return null;
}

const DOC_STATUS: Record<string, ListingValues["documentationStatus"]> = {
  aldia: "al_dia",
  transferenciapendiente: "transferencia_pendiente",
  nodeclara: "no_declara",
};

// Celular paraguayo (0981 123 456, +595 981…) o fijo con 0 y código de área.
const PHONE_IN_TEXT = /(?:\+?\s?595|\b0)[\s.-]*9\d{2}[\s.-]*\d{3}[\s.-]*\d{3}\b|\b0[2-8]\d{1,2}[\s.-]*\d{3}[\s.-]*\d{3,4}\b/;
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_IN_TEXT = /\bhttps?:\/\/|\bwww\.|\bwa\.me\b|\bbit\.ly\b|\binstagram\.com\b|\bfacebook\.com\b/i;

/** Regla del checklist: la descripción no trae datos de contacto (se saltaría el rastreo de /ir/wa). */
export function contactInText(text: string): "telefono" | "email" | "enlace" | null {
  if (PHONE_IN_TEXT.test(text)) return "telefono";
  if (EMAIL_IN_TEXT.test(text)) return "email";
  if (URL_IN_TEXT.test(text)) return "enlace";
  return null;
}

/** ¿El comercio tiene el bloque de autorización (texto + fecha, DATA_SEEDING.md §5)? */
export function hasAuthorization(dealer: DealerSnapshot): boolean {
  return Boolean(dealer.authorizationNote?.trim()) && Boolean(dealer.authorizationDate);
}

export const isDemoDealer = (dealer: { slug: string }) => dealer.slug.startsWith(DEV_DEALER_SLUG_PREFIX);
export const isDemoRef = (ref: string) => ref.toUpperCase().startsWith(DEV_EXTERNAL_REF_PREFIX);

export function resolveDealer(
  catalog: CatalogSnapshot,
  text: string | undefined,
  defaultDealerId: number | null,
): { dealer: DealerSnapshot } | { problem: Problem } {
  const byDefault = defaultDealerId === null ? undefined : catalog.dealers.find((d) => d.id === defaultDealerId);
  const named = text?.trim() ? findByNameOrSlug(catalog.dealers, text) : undefined;
  if (text?.trim() && !named) {
    return { problem: { code: "comercio", message: `El comercio «${text}» no existe. Cargalo primero en Comercios.` } };
  }
  if (named && byDefault && named.id !== byDefault.id) {
    return {
      problem: {
        code: "comercio",
        message: `La fila es de «${named.name}» pero elegiste «${byDefault.name}» para el archivo.`,
      },
    };
  }
  const dealer = named ?? byDefault;
  if (!dealer) {
    return { problem: { code: "comercio", message: "Falta el comercio: completá la columna comercio o elegilo en el formulario." } };
  }
  return { dealer };
}

/** Problemas del comercio que impiden importar cualquiera de sus filas. */
export function dealerProblems(dealer: DealerSnapshot, demoRefusal: string | null): Problem[] {
  if (dealer.deleted || dealer.status === "archived") {
    return [{ code: "comercio", message: `«${dealer.name}» está archivado: no se le carga stock.` }];
  }
  if (isDemoDealer(dealer)) {
    // ADR-12 / ADR-24: los comercios de prueba sólo existen en una base local.
    if (demoRefusal !== null) return [{ code: "comercio", message: `Comercio de prueba fuera de una base local: ${demoRefusal}` }];
    // Los de `npm run fixtures` no tienen fecha de autorización: son ficticios.
    return dealer.authorizationNote?.trim() ? [] : [{ code: "comercio", message: `«${dealer.name}» no tiene nota de autorización.` }];
  }
  if (!hasAuthorization(dealer)) {
    return [
      {
        code: "comercio",
        message: `«${dealer.name}» no tiene cargado el bloque de autorización (texto y fecha, ADR-12). Sin eso no se publica su stock.`,
      },
    ];
  }
  return [];
}

type Rec = Partial<Record<StockColumn, string>>;

/**
 * Valida y normaliza una fila. Junta todos los problemas de la fila (no corta
 * en el primero) para que el comercio corrija todo de una vez.
 */
export function validateRow(rec: Rec, line: number, ctx: ValidateContext): RowResult {
  const problems: Problem[] = [];
  const warnings: string[] = [];
  const missing = (field: string) => problems.push({ code: "datos_incompletos", message: `Falta ${field}.` });
  const bad = (field: string, value: string, hint: string) =>
    problems.push({ code: "datos_incompletos", message: `${field} «${value}» no es válido: ${hint}` });

  // Comercio y referencia.
  const refRaw = (rec.referencia ?? "").trim();
  const resolved = resolveDealer(ctx.catalog, rec.comercio, ctx.defaultDealerId);
  const dealer = "dealer" in resolved ? resolved.dealer : null;
  if (!dealer) problems.push((resolved as { problem: Problem }).problem);
  else problems.push(...dealerProblems(dealer, ctx.demoRefusal));

  if (refRaw === "") missing("la referencia");
  else if (!REF_RE.test(refRaw)) bad("La referencia", refRaw, "usá letras, números, guiones o puntos (hasta 100).");
  const isDemo = isDemoRef(refRaw) || (dealer !== null && isDemoDealer(dealer));
  if (isDemoRef(refRaw) && ctx.demoRefusal !== null) {
    problems.push({ code: "comercio", message: `Referencia de prueba (DEV-) fuera de una base local: ${ctx.demoRefusal}` });
  }

  // Marca y modelo (ADR-11: siempre del catálogo).
  const brandText = rec.marca ?? "";
  const brand = findByNameOrSlug(ctx.catalog.brands, brandText);
  if (brandText === "") missing("la marca");
  else if (!brand) bad("La marca", brandText, "no está en el catálogo. Pedí que la agreguen en Catálogo.");
  else if (!brand.isActive) bad("La marca", brandText, "está desactivada en el catálogo.");

  const modelText = (rec.modelo ?? "").trim();
  let model: CatalogSnapshot["models"][number] | undefined;
  let unknownModel: string | null = null;
  if (modelText === "") missing("el modelo");
  else if (brand) {
    const inBrand = ctx.catalog.models.filter((m) => m.brandId === brand.id);
    // "Honda Wave 110S" también encuentra "Wave 110S".
    const withoutBrand = matchKey(modelText).startsWith(matchKey(brand.name))
      ? modelText.slice(brand.name.length).trim()
      : modelText;
    model = findByNameOrSlug(inBrand, modelText) ?? findByNameOrSlug(inBrand, withoutBrand);
    if (!model || !model.isActive) {
      unknownModel = modelText.slice(0, 255);
      model = undefined;
      warnings.push(`El modelo «${modelText}» no está activo en el catálogo: queda en moderación y va a sugerencias.`);
    }
  }

  // Condición, año, kilometraje.
  const condition = parseCondition(rec.condicion);
  if (!rec.condicion) missing("la condición (0km o usada)");
  else if (!condition) bad("La condición", rec.condicion, "usá 0km o usada.");

  const year = parseInteger(rec.anio);
  if (year === null || (typeof year === "number" && (year < 1970 || year > ctx.currentYear + 1))) {
    bad("El año", rec.anio ?? "", `entre 1970 y ${ctx.currentYear + 1}.`);
  } else if (year === undefined && condition === "used") missing("el año (obligatorio en usadas)");

  const km = parseInteger(rec.kilometraje);
  if (km === null || (typeof km === "number" && km > 2_000_000)) bad("El kilometraje", rec.kilometraje ?? "", "un número de km.");
  else if (km === undefined && condition === "used") missing("el kilometraje (obligatorio en usadas)");
  else if (condition === "new" && typeof km === "number" && km > 0) {
    bad("El kilometraje", rec.kilometraje ?? "", "una 0 km no tiene kilómetros. Si es usada, poné condicion = usada.");
  }

  // Ciudad (vacía = la del comercio) y categoría (vacía = la del modelo).
  let cityId: number | null = null;
  if (rec.ciudad) {
    const city = findByNameOrSlug(ctx.catalog.cities, rec.ciudad);
    if (!city || !city.isActive) bad("La ciudad", rec.ciudad, "no está en la lista de ciudades del sitio.");
    else cityId = city.id;
  } else if (dealer) cityId = dealer.cityId;

  let categoryId: number | null = null;
  if (rec.categoria) {
    const category = findByNameOrSlug(ctx.catalog.categories, rec.categoria);
    if (!category || !category.isActive) bad("La categoría", rec.categoria, "no está en la lista de categorías.");
    else categoryId = category.id;
  } else if (model?.categoryId) categoryId = model.categoryId;
  else missing("la categoría (el modelo no tiene una en el catálogo)");

  // Precio y financiación (checklist: contado o esquema completo).
  const price = parseGs(rec.precio_contado_gs);
  const down = parseGs(rec.entrega_gs);
  const installment = parseGs(rec.cuota_gs);
  const count = parseInteger(rec.cantidad_cuotas);
  let financingOnly = parseYesNo(rec.solo_financiado);
  if (price === null) bad("El precio de contado", rec.precio_contado_gs ?? "", "guaraníes sin decimales.");
  if (down === null) bad("La entrega", rec.entrega_gs ?? "", "guaraníes sin decimales.");
  if (installment === null) bad("La cuota", rec.cuota_gs ?? "", "guaraníes sin decimales.");
  if (count === null) bad("La cantidad de cuotas", rec.cantidad_cuotas ?? "", "un número.");
  if (financingOnly === null) bad("solo_financiado", rec.solo_financiado ?? "", "si o no.");

  const hasInstallment = typeof installment === "number" && installment > 0;
  const hasCount = typeof count === "number" && count > 0;
  if (hasInstallment && !hasCount) missing("la cantidad de cuotas (hay monto de cuota)");
  if (hasCount && !hasInstallment) missing("el monto de la cuota (hay cantidad de cuotas)");
  if (typeof count === "number" && count > MAX_INSTALLMENTS) bad("La cantidad de cuotas", String(count), `hasta ${MAX_INSTALLMENTS}.`);
  if (typeof down === "number" && down > 0 && !hasInstallment) {
    bad("La entrega", rec.entrega_gs ?? "", "sólo tiene sentido con cuota y cantidad de cuotas.");
  }
  const hasPrice = typeof price === "number" && price > 0;
  if (financingOnly === true && hasPrice) {
    bad("solo_financiado", "si", "la fila también trae precio de contado. Dejá uno de los dos.");
  }
  if (!hasPrice && !(hasInstallment && hasCount) && price !== null && installment !== null) {
    problems.push({ code: "sin_precio", message: "Sin precio de contado ni cuota y cantidad de cuotas." });
  }
  if (!hasPrice && hasInstallment && hasCount && financingOnly !== true) {
    // DATA_SEEDING.md §4: si no hay contado, se indica que sólo hay precio financiado.
    financingOnly = true;
    warnings.push("Sin precio de contado: se publica como «sólo financiado».");
  }
  if (hasPrice && (price as number) < MIN_PRICE_GS) {
    problems.push({ code: "precio_irreal", message: `Precio de Gs. ${price} demasiado bajo: ¿faltan ceros?` });
  }
  if (hasInstallment && (installment as number) < MIN_INSTALLMENT_GS) {
    problems.push({ code: "precio_irreal", message: `Cuota de Gs. ${installment} demasiado baja: ¿faltan ceros?` });
  }

  const negotiable = parseYesNo(rec.negociable);
  const tradeIn = parseYesNo(rec.acepta_permuta);
  if (negotiable === null) bad("negociable", rec.negociable ?? "", "si o no.");
  if (tradeIn === null) bad("acepta_permuta", rec.acepta_permuta ?? "", "si o no.");

  // Documentación (G-4): NULL sólo en 0 km.
  let documentationStatus: ListingValues["documentationStatus"] = null;
  if (condition === "used") {
    if (rec.estado_documentacion) {
      documentationStatus = DOC_STATUS[matchKey(rec.estado_documentacion)] ?? null;
      if (!documentationStatus) {
        bad("estado_documentacion", rec.estado_documentacion, "al_dia, transferencia_pendiente o no_declara.");
      }
    } else {
      documentationStatus = "no_declara";
      warnings.push("Sin estado de documentación: se carga «no declara».");
    }
  }

  // Teléfono y WhatsApp (G-3): un fijo sólo con whatsapp = no.
  const whatsappWanted = parseYesNo(rec.whatsapp);
  if (whatsappWanted === null) bad("whatsapp", rec.whatsapp ?? "", "si o no.");
  const phoneText = rec.telefono?.trim() || null;
  let phoneE164: string | null = null;
  let phoneRaw = "";
  try {
    if (phoneText) {
      phoneE164 = normalizePhone(phoneText, { allowLandline: true });
      phoneRaw = phoneText.slice(0, 30);
    } else if (dealer) {
      phoneE164 = dealer.phoneE164;
      phoneRaw = formatPhoneDisplay(dealer.phoneE164);
    }
  } catch {
    bad("El teléfono", phoneText ?? "", "formato 0981 123 456 (o fijo 021 123 456 con whatsapp = no).");
  }
  let contactWhatsapp = false;
  if (phoneE164) {
    const mobile = isWhatsAppCapable(phoneE164);
    if (whatsappWanted === true && !mobile) {
      bad("whatsapp", "si", "el teléfono es fijo. Poné whatsapp = no (sólo llamadas) o un celular.");
    }
    contactWhatsapp = whatsappWanted ?? mobile;
  } else if (!problems.some((p) => p.message.startsWith("El teléfono"))) {
    missing("el teléfono");
  }

  // Título y descripción.
  const description = (rec.descripcion ?? "").trim();
  if (description.length > MAX_DESCRIPTION) bad("La descripción", `${description.length} caracteres`, `hasta ${MAX_DESCRIPTION}.`);
  const contact = description ? contactInText(description) : null;
  if (contact) {
    problems.push({
      code: "contacto_en_descripcion",
      message: `La descripción trae un ${contact}. Sacalo: el contacto va por el botón de WhatsApp.`,
    });
  }
  let title = (rec.titulo ?? "").trim().replace(/\s+/g, " ");
  if (title === "" && brand) {
    const modelName = model?.name ?? unknownModel ?? modelText;
    const yearPart = typeof year === "number" ? ` ${year}` : "";
    title = `${brand.name} ${modelName}${yearPart}${condition === "new" ? " 0 km" : ""}`;
  }
  if (title && contactInText(title)) {
    problems.push({ code: "contacto_en_descripcion", message: "El título trae datos de contacto. Sacalos." });
  }
  // Todo lo de prueba lleva el prefijo [DEV] (ADR-24).
  if (isDemo && title && !title.startsWith(DEV_TITLE_PREFIX)) title = `${DEV_TITLE_PREFIX} ${title}`;
  if (title.length > MAX_TITLE) bad("El título", `${title.length} caracteres`, `hasta ${MAX_TITLE}.`);

  if (problems.length > 0 || !dealer || !brand || !condition || cityId === null || categoryId === null || !phoneE164) {
    return { ok: false, line, dealerId: dealer?.id ?? null, externalRef: refRaw || null, problems };
  }

  return {
    ok: true,
    line,
    dealerId: dealer.id,
    externalRef: refRaw,
    unknownModel,
    isDemo,
    warnings,
    values: {
      title,
      description: description || null,
      brandId: brand.id,
      modelId: model?.id ?? null,
      modelRaw: unknownModel,
      categoryId,
      cityId,
      condition,
      year: typeof year === "number" ? year : null,
      mileageKm: condition === "used" && typeof km === "number" ? km : null,
      engineCc: model?.engineCc ?? null,
      priceGs: hasPrice ? (price as number) : null,
      hasFinancingOnly: financingOnly === true,
      downPaymentGs: hasInstallment && typeof down === "number" && down > 0 ? down : null,
      installmentGs: hasInstallment && hasCount ? (installment as number) : null,
      installmentCount: hasInstallment && hasCount ? (count as number) : null,
      isNegotiable: negotiable === true,
      acceptsTradeIn: tradeIn === true,
      contactPhoneE164: phoneE164,
      contactPhoneRaw: phoneRaw,
      contactWhatsapp,
      documentationStatus,
    },
  };
}
