// Plan de una importación (G-18): qué se crea, qué se actualiza, qué queda
// igual y qué se rechaza, con el motivo. Es lo que muestra la vista previa y
// lo único que aplica la confirmación. Puro: las publicaciones existentes
// llegan como dato.
import { createHash } from "node:crypto";
import { mapHeaders, readRecord } from "./columns";
import type { CsvTable } from "./csv";
import { type ListingValues, type RowOk, type RowRejected, type ValidateContext, validateRow } from "./validate";

export const MAX_IMPORT_ROWS = 2_000;

/** Una publicación que ya existe con el mismo (comercio, referencia). */
export type ExistingListing = { id: number; status: string; deleted: boolean } & ListingValues;

export type PlanItem =
  | { kind: "create"; row: RowOk }
  | { kind: "update"; row: RowOk; listingId: number; status: string; changes: Record<string, { from: unknown; to: unknown }> }
  | { kind: "unchanged"; row: RowOk; listingId: number; status: string }
  | { kind: "reject"; row: RowRejected };

export type ImportPlan = {
  items: PlanItem[];
  /** Errores del archivo entero (columnas obligatorias que faltan, demasiadas filas). */
  fileErrors: string[];
  fileWarnings: string[];
  counts: { create: number; update: number; unchanged: number; reject: number };
  /** Huella del plan: la confirmación aplica sólo si la base no cambió desde la vista previa. */
  hash: string;
};

/** Clave de (comercio, referencia): el índice UNIQUE de MySQL no distingue mayúsculas. */
export function refKey(dealerId: number, externalRef: string): string {
  return `${dealerId}|${externalRef.trim().toUpperCase()}`;
}

const COMPARED: ReadonlyArray<keyof ListingValues> = [
  "title",
  "description",
  "brandId",
  "modelId",
  "modelRaw",
  "categoryId",
  "cityId",
  "condition",
  "year",
  "mileageKm",
  "engineCc",
  "priceGs",
  "hasFinancingOnly",
  "downPaymentGs",
  "installmentGs",
  "installmentCount",
  "isNegotiable",
  "acceptsTradeIn",
  "contactPhoneE164",
  "contactWhatsapp",
  "documentationStatus",
];

/**
 * Campos que cambian. Si la planilla sigue trayendo un modelo desconocido que
 * alguien ya mapeó en Catálogo (la publicación tiene `model_id` y el mismo
 * `model_raw`), se respeta el mapeo: re-importar no lo deshace.
 */
export function listingChanges(existing: ExistingListing, next: ListingValues): Record<string, { from: unknown; to: unknown }> {
  const target: ListingValues = { ...next };
  if (next.modelId === null && existing.modelId !== null && existing.modelRaw !== null && existing.modelRaw === next.modelRaw) {
    target.modelId = existing.modelId;
    target.engineCc = existing.engineCc;
  }
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of COMPARED) {
    const from = existing[key] ?? null;
    const to = target[key] ?? null;
    if (from !== to) out[key] = { from, to };
  }
  return out;
}

export function buildPlan(
  table: CsvTable,
  ctx: ValidateContext,
  existing: ReadonlyMap<string, ExistingListing>,
): ImportPlan {
  const fileErrors: string[] = [];
  const fileWarnings: string[] = [];
  const map = mapHeaders(table.headers);
  if (map.missing.length) fileErrors.push(`Faltan columnas obligatorias: ${map.missing.join(", ")}.`);
  if (map.duplicated.length) fileErrors.push(`Columnas repetidas: ${map.duplicated.join(", ")}.`);
  if (table.rows.length > MAX_IMPORT_ROWS) {
    fileErrors.push(`El archivo tiene ${table.rows.length} filas; el máximo por importación es ${MAX_IMPORT_ROWS}. Partilo.`);
  }
  if (table.rows.length === 0) fileErrors.push("El archivo no tiene filas de datos.");
  if (map.unknown.length) fileWarnings.push(`Columnas que no se usan (se ignoran): ${map.unknown.join(", ")}.`);

  const items: PlanItem[] = [];
  if (fileErrors.length === 0) {
    const seen = new Map<string, number>();
    for (const { line, cells } of table.rows) {
      const result = validateRow(readRecord(cells, map), line, ctx);
      if (!result.ok) {
        items.push({ kind: "reject", row: result });
        continue;
      }
      const key = refKey(result.dealerId, result.externalRef);
      const firstLine = seen.get(key);
      if (firstLine !== undefined) {
        items.push({
          kind: "reject",
          row: {
            ok: false,
            line,
            dealerId: result.dealerId,
            externalRef: result.externalRef,
            problems: [{ code: "duplicada", message: `La referencia ${result.externalRef} ya está en la línea ${firstLine} del archivo.` }],
          },
        });
        continue;
      }
      seen.set(key, line);

      const current = existing.get(key);
      if (!current) {
        items.push({ kind: "create", row: result });
        continue;
      }
      if (current.deleted) {
        items.push({
          kind: "reject",
          row: {
            ok: false,
            line,
            dealerId: result.dealerId,
            externalRef: result.externalRef,
            problems: [
              {
                code: "duplicada",
                message: `La referencia ${result.externalRef} es de una publicación borrada. Usá otra referencia.`,
              },
            ],
          },
        });
        continue;
      }
      if (current.status === "published" && result.values.modelId === null && current.modelId !== null && current.modelRaw !== result.values.modelRaw) {
        items.push({
          kind: "reject",
          row: {
            ok: false,
            line,
            dealerId: result.dealerId,
            externalRef: result.externalRef,
            problems: [
              {
                code: "datos_incompletos",
                message: `La publicación está publicada y el modelo «${result.unknownModel}» no está en el catálogo. Agregalo en Catálogo antes de re-importar.`,
              },
            ],
          },
        });
        continue;
      }
      const changes = listingChanges(current, result.values);
      if (Object.keys(changes).length === 0) {
        items.push({ kind: "unchanged", row: result, listingId: current.id, status: current.status });
      } else {
        items.push({ kind: "update", row: result, listingId: current.id, status: current.status, changes });
      }
    }
  }

  const counts = { create: 0, update: 0, unchanged: 0, reject: 0 };
  for (const item of items) counts[item.kind] += 1;
  const hash = createHash("sha256")
    .update(
      JSON.stringify(
        items.map((i) =>
          i.kind === "reject"
            ? [i.kind, i.row.line, i.row.externalRef, i.row.problems]
            : [i.kind, i.row.line, i.row.dealerId, i.row.externalRef, i.row.values, "listingId" in i ? i.listingId : null, "changes" in i ? i.changes : null],
        ),
      ),
    )
    .digest("hex");
  return { items, fileErrors, fileWarnings, counts, hash };
}
