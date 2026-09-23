// Importación de stock de comercio (G-18): vista previa y aplicación.
// La vista previa no escribe nada. La aplicación rehace el plan contra la base
// actual y sólo sigue si coincide con el que se vio (huella), así lo que se
// confirma es exactamente lo que se previsualizó.
//
// Cada fila creada o actualizada escribe activity_log en su propia
// transacción. Las publicaciones nuevas nacen en `pending_review` y pasan a
// `published` sólo por la máquina de estados (auto_approve del comercio).
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { listings, modelSuggestions } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { publicRef, slugify } from "@/lib/slug";
import { loadCatalog, loadExisting } from "./catalog";
import { CsvError, parseCsv } from "./csv";
import { attachDemoPlaceholder, demoRefusal, enableDemoAutoApprove } from "./demo";
import { buildPlan, type ImportPlan, type PlanItem } from "./plan";
import { autoPublishIfAllowed, describeAutoPublish } from "./publish";
import { mapHeaders, readRecord } from "./columns";
import { resolveDealer, type RowOk } from "./validate";

export type ImportSource = { kind: "admin"; userId: number } | { kind: "cli" };

export type ImportRequest = {
  csvText: string;
  /** Comercio para las filas sin columna `comercio`. */
  defaultDealerId: number | null;
  source: ImportSource;
  now?: Date;
};

export type RowOutcome = {
  line: number;
  externalRef: string | null;
  action: "created" | "updated" | "unchanged" | "rejected" | "failed";
  listingId: number | null;
  status: string | null;
  /** Pasó a `published` en esta importación. */
  published: boolean;
  message: string;
};

export type ApplyResult =
  | { ok: true; plan: ImportPlan; outcomes: RowOutcome[]; published: number; pending: number }
  | { ok: false; reason: "file_errors" | "stale"; plan: ImportPlan };

function isDupEntry(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string; message?: string }; message?: string };
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

function dupKey(error: unknown): string {
  const e = error as { cause?: { message?: string }; message?: string };
  return `${e?.cause?.message ?? ""} ${e?.message ?? ""}`;
}

/** Arma el plan contra la base actual. No escribe nada. */
export async function previewImport(req: Pick<ImportRequest, "csvText" | "defaultDealerId" | "now">): Promise<ImportPlan> {
  const catalog = await loadCatalog();
  const ctx = {
    catalog,
    defaultDealerId: req.defaultDealerId,
    demoRefusal: demoRefusal(),
    currentYear: (req.now ?? new Date()).getUTCFullYear(),
  };
  let table;
  try {
    table = parseCsv(req.csvText);
  } catch (error) {
    if (!(error instanceof CsvError)) throw error;
    return { items: [], fileErrors: [error.message], fileWarnings: [], counts: { create: 0, update: 0, unchanged: 0, reject: 0 }, hash: "" };
  }
  // Comercios que aparecen en el archivo, para leer sólo sus publicaciones.
  const map = mapHeaders(table.headers);
  const dealerIds = new Set<number>();
  if (req.defaultDealerId !== null) dealerIds.add(req.defaultDealerId);
  for (const { cells } of table.rows) {
    const resolved = resolveDealer(catalog, readRecord(cells, map).comercio, req.defaultDealerId);
    if ("dealer" in resolved) dealerIds.add(resolved.dealer.id);
  }
  const existing = await loadExisting([...dealerIds]);
  return buildPlan(table, ctx, existing);
}

async function uniqueSlug(title: string): Promise<string> {
  let base: string;
  try {
    base = slugify(title).slice(0, 200).replace(/-+$/, "");
  } catch {
    base = "moto";
  }
  for (let n = 1; n <= 50; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [hit] = await db.select({ id: listings.id }).from(listings).where(eq(listings.slug, candidate)).limit(1);
    if (!hit) return candidate;
  }
  return `${base}-${publicRef().toLowerCase()}`;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Modelo fuera del catálogo → una sugerencia pendiente por publicación
 * (B7 la mapea). Si alguien ya la mapeó (la publicación tiene `model_id`), nada.
 */
async function ensureSuggestion(tx: Tx, listingId: number, row: RowOk): Promise<void> {
  const [current] = await tx.select({ modelId: listings.modelId }).from(listings).where(eq(listings.id, listingId));
  if (!current || current.modelId !== null || !row.unknownModel) return;
  const [pending] = await tx
    .select({ id: modelSuggestions.id })
    .from(modelSuggestions)
    .where(and(eq(modelSuggestions.listingId, listingId), eq(modelSuggestions.status, "pending")))
    .limit(1);
  if (pending) return;
  await tx.insert(modelSuggestions).values({
    rawText: row.unknownModel,
    brandId: row.values.brandId,
    listingId,
    status: "pending",
  });
}

async function createListing(row: RowOk, source: ImportSource, now: Date): Promise<number> {
  const userId = source.kind === "admin" ? source.userId : null;
  for (let attempt = 1; ; attempt += 1) {
    const slug = await uniqueSlug(row.values.title);
    try {
      return await db.transaction(async (tx) => {
        const [res] = await tx.insert(listings).values({
          ...row.values,
          slug,
          publicRef: publicRef(),
          dealerId: row.dealerId,
          externalRef: row.externalRef,
          // Nace en moderación: la publicación la decide auto_approve o una persona.
          status: "pending_review",
          lastVerifiedAt: now,
          updatedBy: userId,
        });
        const listingId = res.insertId;
        if (row.unknownModel) await ensureSuggestion(tx, listingId, row);
        await logActivity(tx, {
          userId,
          entityType: "listing",
          entityId: listingId,
          action: "imported",
          diff: { source: source.kind, line: row.line, externalRef: row.externalRef, status: { from: null, to: "pending_review" } },
        });
        return listingId;
      });
    } catch (error) {
      // Carrera en slug o ref pública: se prueba con otros. La referencia del
      // comercio duplicada es otra importación simultánea: no se reintenta.
      if (isDupEntry(error) && !/external_ref/.test(dupKey(error)) && attempt < 5) continue;
      throw error;
    }
  }
}

async function updateListing(
  item: Extract<PlanItem, { kind: "update" }>,
  source: ImportSource,
  now: Date,
): Promise<void> {
  const userId = source.kind === "admin" ? source.userId : null;
  const set: Partial<typeof listings.$inferInsert> = {};
  for (const [key, { to }] of Object.entries(item.changes)) {
    (set as Record<string, unknown>)[key] = to;
  }
  if ("contactPhoneE164" in item.changes) set.contactPhoneRaw = item.row.values.contactPhoneRaw;
  set.lastVerifiedAt = now;
  set.updatedBy = userId;
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ status: listings.status, deletedAt: listings.deletedAt })
      .from(listings)
      .where(eq(listings.id, item.listingId))
      .for("update");
    if (!locked || locked.deletedAt !== null) throw new Error("La publicación se borró mientras se importaba.");
    await tx.update(listings).set(set).where(eq(listings.id, item.listingId));
    if (item.row.unknownModel) await ensureSuggestion(tx, item.listingId, item.row);
    const base = { userId, entityType: "listing" as const, entityId: item.listingId };
    await logActivity(tx, {
      ...base,
      action: "import_updated",
      diff: { source: source.kind, line: item.row.line, externalRef: item.row.externalRef, ...item.changes },
    });
    const priceFields = ["priceGs", "downPaymentGs", "installmentGs", "installmentCount", "hasFinancingOnly"];
    const priceDiff = Object.fromEntries(Object.entries(item.changes).filter(([k]) => priceFields.includes(k)));
    if (Object.keys(priceDiff).length) {
      await logActivity(tx, { ...base, action: "price_changed", diff: { source: `import_${source.kind}`, ...priceDiff } });
    }
  });
}

/**
 * Aplica una importación. `expectedHash` = huella de la vista previa que se
 * confirmó; si la base cambió desde entonces, no se aplica nada y vuelve el
 * plan nuevo para revisarlo. La CLI la omite (su vista previa es la misma corrida).
 */
export async function applyImport(req: ImportRequest & { expectedHash?: string }): Promise<ApplyResult> {
  const now = req.now ?? new Date();
  const plan = await previewImport(req);
  if (plan.fileErrors.length) return { ok: false, reason: "file_errors", plan };
  if (req.expectedHash !== undefined && req.expectedHash !== plan.hash) return { ok: false, reason: "stale", plan };

  const demoDealers = new Set<number>();
  for (const item of plan.items) if (item.kind !== "reject" && item.row.isDemo) demoDealers.add(item.row.dealerId);
  if (demoDealers.size) await enableDemoAutoApprove([...demoDealers], req.source.kind === "admin" ? req.source.userId : null);

  const outcomes: RowOutcome[] = [];
  for (const item of plan.items) {
    if (item.kind === "reject") {
      outcomes.push({
        line: item.row.line,
        externalRef: item.row.externalRef,
        action: "rejected",
        listingId: null,
        status: null,
        published: false,
        message: item.row.problems.map((p) => p.message).join(" "),
      });
      continue;
    }
    const { row } = item;
    try {
      let listingId: number;
      let action: RowOutcome["action"];
      if (item.kind === "create") {
        listingId = await createListing(row, req.source, now);
        action = "created";
      } else if (item.kind === "update") {
        await updateListing(item, req.source, now);
        listingId = item.listingId;
        action = "updated";
      } else {
        listingId = item.listingId;
        action = "unchanged";
      }
      if (row.isDemo && demoRefusal() === null) await attachDemoPlaceholder(listingId);
      const publish = await autoPublishIfAllowed(listingId);
      const notes = [describeAutoPublish(publish), ...row.warnings];
      outcomes.push({
        line: row.line,
        externalRef: row.externalRef,
        action,
        listingId,
        status: publish.status,
        published: !("reason" in publish) && publish.status === "published",
        message: notes.join(" "),
      });
    } catch (error) {
      const message = isDupEntry(error)
        ? "Otra importación creó esta referencia al mismo tiempo. Volvé a importar el archivo."
        : "No se pudo guardar esta fila. Volvé a importar el archivo; las filas ya guardadas no se duplican.";
      console.error(
        JSON.stringify({
          level: "error",
          msg: "import: fila fallida",
          line: row.line,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      outcomes.push({ line: row.line, externalRef: row.externalRef, action: "failed", listingId: null, status: null, published: false, message });
    }
  }
  const published = outcomes.filter((o) => o.published).length;
  const pending = outcomes.filter((o) => o.status === "pending_review").length;
  return { ok: true, plan, outcomes, published, pending };
}
