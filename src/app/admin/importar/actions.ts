"use server";

import { requireRole } from "@/lib/auth/session";
import { applyImport, previewImport } from "@/lib/import/apply";
import { decodeCsvBytes } from "@/lib/import/csv";
import type { ImportPlan } from "@/lib/import/plan";
import type { ImportViewState, ViewRow } from "./view";

// Tope del archivo: el de las server actions de Next (1 MB) con margen. Una
// planilla de 2.000 motos pesa bastante menos.
const MAX_CSV_BYTES = 900 * 1024;

const FIELD_LABEL: Record<string, string> = {
  title: "título",
  description: "descripción",
  brandId: "marca",
  modelId: "modelo",
  modelRaw: "modelo escrito",
  categoryId: "categoría",
  cityId: "ciudad",
  condition: "condición",
  year: "año",
  mileageKm: "kilometraje",
  engineCc: "cilindrada",
  priceGs: "precio",
  hasFinancingOnly: "sólo financiado",
  downPaymentGs: "entrega",
  installmentGs: "cuota",
  installmentCount: "cantidad de cuotas",
  isNegotiable: "negociable",
  acceptsTradeIn: "permuta",
  contactPhoneE164: "teléfono",
  contactWhatsapp: "WhatsApp",
  documentationStatus: "documentación",
};

function planRows(plan: ImportPlan): ViewRow[] {
  return plan.items.map((item) => {
    const ref = item.row.externalRef ?? "—";
    if (item.kind === "reject") {
      return { line: item.row.line, ref, kind: item.kind, detail: item.row.problems.map((p) => p.message).join(" ") };
    }
    const parts: string[] = [];
    if (item.kind === "update") {
      parts.push(`Cambia: ${Object.keys(item.changes).map((k) => FIELD_LABEL[k] ?? k).join(", ")}.`);
    }
    parts.push(...item.row.warnings);
    return { line: item.row.line, ref, kind: item.kind, detail: parts.join(" ") };
  });
}

function previewState(plan: ImportPlan, csvText: string, dealerId: string, stale = false): ImportViewState {
  return {
    step: "preview",
    csvText,
    dealerId,
    hash: plan.hash,
    fileErrors: plan.fileErrors,
    fileWarnings: plan.fileWarnings,
    counts: plan.counts,
    rows: planRows(plan),
    stale,
  };
}

function parseDealerId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Paso 1: lee la planilla y arma la vista previa. No escribe nada. */
async function preview(form: FormData): Promise<ImportViewState> {
  await requireRole("admin");
  const file = form.get("planilla");
  if (!(file instanceof Blob) || file.size === 0) return { step: "idle", error: "Elegí la planilla (.csv)." };
  if (file.size > MAX_CSV_BYTES) return { step: "idle", error: "La planilla pesa más de 900 KB. Partila en dos." };
  const csvText = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const dealerId = String(form.get("comercio") ?? "");
  const plan = await previewImport({ csvText, defaultDealerId: parseDealerId(dealerId) });
  return previewState(plan, csvText, dealerId);
}

/** Paso 2: aplica lo que se previsualizó. Si la base cambió, vuelve a la vista previa. */
async function apply(form: FormData): Promise<ImportViewState> {
  const user = await requireRole("admin");
  const csvText = String(form.get("csvText") ?? "");
  if (csvText.length === 0 || csvText.length > MAX_CSV_BYTES) return { step: "idle", error: "Volvé a elegir la planilla." };
  const dealerId = String(form.get("comercio") ?? "");
  const result = await applyImport({
    csvText,
    defaultDealerId: parseDealerId(dealerId),
    expectedHash: String(form.get("hash") ?? ""),
    source: { kind: "admin", userId: user.id },
  });
  if (!result.ok) return previewState(result.plan, csvText, dealerId, result.reason === "stale");

  const rows: ViewRow[] = result.outcomes.map((o) => ({
    line: o.line,
    ref: o.externalRef ?? "—",
    kind: o.action,
    detail: o.message,
  }));
  const by = (a: string) => result.outcomes.filter((o) => o.action === a).length;
  const summary = `${by("created")} creadas, ${by("updated")} actualizadas, ${by("unchanged")} sin cambios, ${by("rejected")} rechazadas${
    by("failed") ? `, ${by("failed")} con error` : ""
  }. Publicadas ahora: ${result.published}. En moderación: ${result.pending}.`;
  return { step: "done", rows, summary };
}

/** Una sola acción para el formulario: `paso` = vista-previa | importar | cancelar. */
export async function importAction(_prev: ImportViewState, form: FormData): Promise<ImportViewState> {
  // Cada paso vuelve a exigir el rol: ocultar el formulario no es un permiso.
  await requireRole("admin");
  switch (String(form.get("paso") ?? "")) {
    case "vista-previa":
      return preview(form);
    case "importar":
      return apply(form);
    default:
      return { step: "idle" };
  }
}
