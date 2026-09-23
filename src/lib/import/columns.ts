// Columnas de la planilla de stock (G-18). La planilla modelo es
// docs/templates/stock-template.csv; docs/templates/demo/stock-demo.csv usa
// las mismas. Encabezados en español, sin importar mayúsculas ni tildes.

export const STOCK_COLUMNS = [
  "comercio",
  "referencia",
  "marca",
  "modelo",
  "condicion",
  "anio",
  "kilometraje",
  "ciudad",
  "categoria",
  "precio_contado_gs",
  "entrega_gs",
  "cuota_gs",
  "cantidad_cuotas",
  "solo_financiado",
  "negociable",
  "acepta_permuta",
  "estado_documentacion",
  "telefono",
  "whatsapp",
  "titulo",
  "descripcion",
] as const;

export type StockColumn = (typeof STOCK_COLUMNS)[number];

export const REQUIRED_COLUMNS: readonly StockColumn[] = ["referencia", "marca", "modelo", "condicion"];

/** Qué va en cada columna. Se muestra en el admin junto al botón de la planilla modelo. */
export const COLUMN_HELP: Readonly<Record<StockColumn, string>> = {
  comercio: "Slug o nombre del comercio. Vacío = el comercio elegido en el formulario.",
  referencia: "Código de la moto en el comercio (único por comercio). Obligatorio. Re-importar con la misma referencia actualiza, no duplica.",
  marca: "Como está en el catálogo (Honda, Yamaha…). Obligatorio.",
  modelo: "Como está en el catálogo (Wave 110S, XTZ 150…). Si no está, la moto queda en moderación y el modelo va a sugerencias.",
  condicion: "0km o usada. Obligatorio.",
  anio: "Año del modelo. Obligatorio si es usada.",
  kilometraje: "Obligatorio si es usada. Vacío en una 0 km.",
  ciudad: "Vacío = la ciudad del comercio.",
  categoria: "Naked, Scooter, Cub, Enduro / Cross… Vacío = la del modelo en el catálogo, si la tiene.",
  precio_contado_gs: "Precio de contado en guaraníes, sin decimales (9500000 o 9.500.000).",
  entrega_gs: "Entrega inicial, si la hay.",
  cuota_gs: "Monto de cada cuota.",
  cantidad_cuotas: "Número de cuotas (obligatorio si hay cuota).",
  solo_financiado: "si = el comercio no da precio de contado.",
  negociable: "si / no (vacío = no).",
  acepta_permuta: "si / no (vacío = no).",
  estado_documentacion: "Sólo usadas: al_dia, transferencia_pendiente o no_declara (vacío = no_declara).",
  telefono: "Vacío = el teléfono del comercio. Formato 0981 123 456.",
  whatsapp: "si / no. no = sólo llamadas. Vacío = si cuando el teléfono es celular.",
  titulo: "Vacío = marca, modelo, año y 0 km.",
  descripcion: "Sin teléfonos, emails ni enlaces: el contacto va por el botón.",
};

const ALIASES: Readonly<Record<string, StockColumn>> = {
  dealer: "comercio",
  ref: "referencia",
  external_ref: "referencia",
  codigo: "referencia",
  ano: "anio",
  year: "anio",
  km: "kilometraje",
  precio: "precio_contado_gs",
  precio_contado: "precio_contado_gs",
  precio_gs: "precio_contado_gs",
  entrega: "entrega_gs",
  cuota: "cuota_gs",
  cuotas: "cantidad_cuotas",
  documentacion: "estado_documentacion",
  tel: "telefono",
  celular: "telefono",
};

/** "Año", "PRECIO contado (Gs)" → "anio", "precio_contado_gs". */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[()]/g, " ")
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type HeaderMap = {
  /** Índice de cada columna conocida en la fila. */
  index: Partial<Record<StockColumn, number>>;
  /** Encabezados que no se reconocen: se ignoran, con aviso. */
  unknown: string[];
  missing: StockColumn[];
  duplicated: StockColumn[];
};

export function mapHeaders(headers: readonly string[]): HeaderMap {
  const known = new Set<string>(STOCK_COLUMNS);
  const index: Partial<Record<StockColumn, number>> = {};
  const unknown: string[] = [];
  const duplicated: StockColumn[] = [];
  headers.forEach((raw, i) => {
    const h = normalizeHeader(raw);
    if (h === "") return;
    const col = (known.has(h) ? h : ALIASES[h]) as StockColumn | undefined;
    if (!col) {
      unknown.push(raw);
      return;
    }
    if (index[col] !== undefined) duplicated.push(col);
    else index[col] = i;
  });
  const missing = REQUIRED_COLUMNS.filter((c) => index[c] === undefined);
  return { index, unknown, missing, duplicated };
}

export function readRecord(cells: readonly string[], map: HeaderMap): Partial<Record<StockColumn, string>> {
  const out: Partial<Record<StockColumn, string>> = {};
  for (const col of STOCK_COLUMNS) {
    const i = map.index[col];
    if (i !== undefined) out[col] = (cells[i] ?? "").trim();
  }
  return out;
}
