// Registro de actividad (DATABASE_SCHEMA.md §2.13). Se escribe dentro de la
// misma transacción que el cambio que describe: si el cambio se revierte, el
// registro también.
import { db } from "@/db";
import { activityLog } from "@/db/schema";

/** `db` o la `tx` de una transacción de Drizzle. */
export type DbLike = Pick<typeof db, "insert">;

export type ActivityEntry = {
  /** `null` = job del sistema o titular de un enlace privado (G-1) sin usuario. */
  userId: number | null;
  entityType: "listing" | "dealer" | "lead" | "report" | "user" | "featured_purchase" | (string & {});
  entityId: number;
  /** `approved`, `rejected`, `price_changed`, `expired`… (≤ 50 caracteres). */
  action: string;
  /** Antes/después de los campos cambiados. */
  diff?: Record<string, unknown> | null;
  ipHash?: string | null;
};

export async function logActivity(conn: DbLike, entry: ActivityEntry): Promise<void> {
  await conn.insert(activityLog).values({
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action.slice(0, 50),
    diffJson: entry.diff ?? null,
    ipHash: entry.ipHash ?? null,
  });
}

/** Diff `{campo: {from, to}}` sólo de los campos que cambian. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    const same = from instanceof Date && to instanceof Date ? from.getTime() === to.getTime() : from === to;
    if (!same) out[key] = { from: from ?? null, to: to ?? null };
  }
  return out;
}
