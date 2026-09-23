// Registro de actividad (ADMIN_SPEC.md §12): filtrable por entidad, usuario, acción y fecha.
import "server-only";

import { and, desc, eq, gte, like, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, users } from "@/db/schema";
import { assertRole, type SessionUser } from "@/lib/auth/roles";

export type ActivityFilters = { entity?: string; entityId?: number; user?: string; action?: string; from?: string; to?: string };

export async function activitySearch(user: SessionUser | null, f: ActivityFilters, page = 1) {
  assertRole(user, ["admin", "moderator"]);
  const conds: SQL[] = [];
  if (f.entity) conds.push(eq(activityLog.entityType, f.entity.slice(0, 50)));
  if (f.entityId) conds.push(eq(activityLog.entityId, f.entityId));
  if (f.action) conds.push(like(activityLog.action, `${f.action.slice(0, 50).replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
  if (f.user) conds.push(like(users.email, `%${f.user.slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) conds.push(gte(activityLog.createdAt, new Date(`${f.from}T03:00:00Z`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) conds.push(lt(activityLog.createdAt, new Date(new Date(`${f.to}T03:00:00Z`).getTime() + 86_400_000)));
  return db
    .select({
      id: activityLog.id,
      at: activityLog.createdAt,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      action: activityLog.action,
      diff: activityLog.diffJson,
      userEmail: users.email,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(activityLog.id))
    .limit(100)
    .offset((Math.max(1, page) - 1) * 100);
}
