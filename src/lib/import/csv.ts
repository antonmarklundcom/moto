// Lector de CSV (RFC 4180) para la planilla de stock (G-18). Puro, sin
// dependencias. Acepta lo que sale de Excel y de Google Sheets en Paraguay:
// BOM UTF-8, CRLF, campos entre comillas con comas o saltos de línea, y `;`
// como separador (Excel en español lo usa cuando la coma es decimal).

export type CsvTable = {
  headers: string[];
  /** Filas de datos (sin la de encabezados), cada una con su número de línea de planilla. */
  rows: Array<{ line: number; cells: string[] }>;
  delimiter: "," | ";";
};

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

/** Separador: el que más aparece fuera de comillas en la primera línea. */
export function detectDelimiter(text: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch === ",") commas += 1;
    else if (!quoted && ch === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

/** Todas las filas, tal cual (sin interpretar encabezados). */
export function parseCsvRecords(input: string, delimiter: "," | ";"): Array<{ line: number; cells: string[] }> {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let i = 0;

  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    records.push({ line: recordLine, cells });
    cells = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      if (ch === "\n") line += 1;
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      cell = "";
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      endCell();
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRecord();
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      i += 1;
      line += 1;
      recordLine = line;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (quoted) throw new CsvError(`Hay comillas sin cerrar a partir de la línea ${recordLine}.`);
  if (cell !== "" || cells.length > 0) endRecord();
  return records;
}

const isBlank = (cells: string[]) => cells.every((c) => c.trim() === "");

/** Parsea la planilla: primera fila no vacía = encabezados; las filas vacías se ignoran. */
export function parseCsv(input: string): CsvTable {
  const delimiter = detectDelimiter(input.charCodeAt(0) === 0xfeff ? input.slice(1) : input);
  const records = parseCsvRecords(input, delimiter).filter((r) => !isBlank(r.cells));
  if (records.length === 0) throw new CsvError("El archivo está vacío.");
  const [head, ...rows] = records;
  return { headers: head.cells.map((h) => h.trim()), rows, delimiter };
}

/**
 * Bytes del archivo → texto. UTF-8 si es válido; si no, Latin-1 (Excel en
 * Windows guarda "CSV" así y "Asunción" llegaría roto).
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

/** Planilla modelo: sólo los encabezados (G-18). */
export function templateCsv(columns: readonly string[]): string {
  return `${columns.join(",")}\r\n`;
}
