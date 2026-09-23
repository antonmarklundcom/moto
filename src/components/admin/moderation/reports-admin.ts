// Cola de denuncias (ADMIN_SPEC.md §10, T&S §5): por estado y prioridad,
// acciones descartar / pausar / dar de baja, nota obligatoria, todo a
// activity_log. Sin "bloquear teléfono": necesita tabla y respuesta del
// abogado (T&S §9) → Backlog.
import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings, reports, type reportStatusEnum } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { assertRole, type SessionUser } from "@/lib/auth/roles";
import { transition, TransitionError } from "@/lib/listings/state";
import { MODERATION_ROLES } from "./decide";

export type ReportStatus = (typeof reportStatusEnum)[number];
export const REPORT_ACTIONS = ["dismiss", "pause", "takedown"] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

const reportCols = {
  id: reports.id,
  listingId: reports.listingId,
  reasonCode: reports.reasonCode,
  detail: reports.detail,
  status: reports.status,
  createdAt: reports.createdAt,
  resolutionNote: reports.resolutionNote,
  resolvedAt: reports.resolvedAt,
  hasPhone: sql<number>`${reports.reporterPhoneE164} IS NOT NULL`,
  listingTitle: listings.title,
  listingStatus: listings.status,
  listingRef: listings.publicRef,
  listingSlug: listings.slug,
  listingDeletedAt: listings.deletedAt,
};

/**
 * Denuncias de un estado. Prioridad: publicaciones con más denuncias
 * independientes de estafa/robada primero, después las más viejas.
 */
export async function reportQueue(status: ReportStatus) {
  const rows = await db
    .select(reportCols)
    .from(reports)
    .innerJoin(listings, eq(listings.id, reports.listingId))
    .where(eq(reports.status, status))
    .orderBy(status === "pending" ? asc(reports.createdAt) : desc(reports.createdAt))
    .limit(200);
  if (status !== "pending" || rows.length === 0) return rows.map((r) => ({ ...r, severe: 0 }));
  const ids = [...new Set(rows.map((r) => r.listingId))];
  const severe = await db
    .select({ listingId: reports.listingId, n: sql<number>`COUNT(DISTINCT ${reports.reporterIpHash})` })
    .from(reports)
    .where(and(inArray(reports.listingId, ids), inArray(reports.reasonCode, ["estafa", "robada"]), sql`${reports.status} <> 'dismissed'`))
    .groupBy(reports.listingId);
  const byListing = new Map(severe.map((s) => [s.listingId, Number(s.n)]));
  return rows
    .map((r) => ({ ...r, severe: byListing.get(r.listingId) ?? 0 }))
    .sort((a, b) => b.severe - a.severe || a.createdAt.getTime() - b.createdAt.getTime());
}

export async function reportDetail(id: number) {
  const [report] = await db.select(reportCols).from(reports).innerJoin(listings, eq(listings.id, reports.listingId)).where(eq(reports.id, id));
  if (!report) return null;
  const others = await db
    .select({ id: reports.id, reasonCode: reports.reasonCode, status: reports.status, createdAt: reports.createdAt, detail: reports.detail })
    .from(reports)
    .where(and(eq(reports.listingId, report.listingId), sql`${reports.id} <> ${id}`))
    .orderBy(desc(reports.createdAt))
    .limit(50);
  return { report, others };
}

export type ResolveResult = { ok: true; resolved: number; listingStatus: string | null } | { ok: false; error: string };

export async function resolveReport(
  user: SessionUser | null,
  input: { reportId: number; action: unknown; note: unknown; ipHash?: string | null },
): Promise<ResolveResult> {
  const actor = assertRole(user, MODERATION_ROLES);
  if (!(REPORT_ACTIONS as readonly unknown[]).includes(input.action)) return { ok: false, error: "Acción desconocida." };
  const action = input.action as ReportAction;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 2000) : "";
  if (note.length < 3) return { ok: false, error: "La nota de resolución es obligatoria." };

  const [report] = await db.select({ id: reports.id, listingId: reports.listingId, status: reports.status }).from(reports).where(eq(reports.id, input.reportId));
  if (!report) return { ok: false, error: "No existe la denuncia." };
  if (report.status !== "pending" && report.status !== "reviewed") return { ok: false, error: "Esta denuncia ya está resuelta." };

  let listingStatus: string | null = null;
  if (action !== "dismiss") {
    try {
      const res = await transition({
        listingId: report.listingId,
        action: action === "pause" ? "pause" : "delete",
        actor: { kind: "user", user: actor, ipHash: input.ipHash ?? null },
      });
      listingStatus = action === "takedown" ? "deleted" : res.to;
    } catch (error) {
      if (!(error instanceof TransitionError)) throw error;
      // Pausar algo que ya no está publicado: la denuncia igual se resuelve, con lo que hay.
      if (!(action === "pause" && error.code === "invalid_state")) {
        return { ok: false, error: error.code === "deleted" ? "La publicación ya estaba dada de baja." : error.message };
      }
    }
  }

  // Descartar resuelve esta denuncia; pausar o dar de baja resuelve todas las pendientes de esa publicación.
  const status: ReportStatus = action === "dismiss" ? "dismissed" : "actioned";
  const now = new Date();
  return db.transaction(async (tx) => {
    const targets =
      action === "dismiss"
        ? [report.id]
        : (
            await tx
              .select({ id: reports.id })
              .from(reports)
              .where(and(eq(reports.listingId, report.listingId), inArray(reports.status, ["pending", "reviewed"])))
          ).map((r) => r.id);
    if (!targets.includes(report.id)) targets.push(report.id);
    await tx
      .update(reports)
      .set({ status, resolvedBy: actor.id, resolvedAt: now, resolutionNote: note })
      .where(inArray(reports.id, targets));
    for (const id of targets) {
      await logActivity(tx, {
        userId: actor.id,
        entityType: "report",
        entityId: id,
        action: `report_${status}`,
        diff: { status: { from: "pending", to: status }, action, note, listingId: report.listingId },
        ipHash: input.ipHash ?? null,
      });
    }
    return { ok: true, resolved: targets.length, listingStatus } as const;
  });
}
