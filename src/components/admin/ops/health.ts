// /admin/salud (G-24): todo de consultas reales.
import "server-only";

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { jobRuns, leads, listings } from "@/db/schema";
import { assertRole, type SessionUser } from "@/lib/auth/roles";
import { CRON_JOBS } from "@/lib/cron/jobs";
import { countLiveListings } from "@/lib/listings/query";
import { exhaustedLeadCount } from "@/lib/leads/deliver";

/** Tamaño de una carpeta, con tope de archivos para no colgar la página. */
export async function dirSize(root: string, maxFiles = 200_000): Promise<{ bytes: number; files: number; truncated: boolean }> {
  let bytes = 0;
  let files = 0;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        files += 1;
        if (files > maxFiles) return { bytes, files, truncated: true };
        try {
          bytes += (await stat(p)).size;
        } catch {
          /* borrado en el medio */
        }
      }
    }
  }
  return { bytes, files, truncated: false };
}

export async function siteHealth(user: SessionUser | null) {
  assertRole(user, ["admin"]);
  const jobNames = Object.keys(CRON_JOBS);
  const [lastRuns, failedLeads, exhausted, pendingLeads, [oldest], live] = await Promise.all([
    Promise.all(
      jobNames.map(async (job) => {
        const [last] = await db.select().from(jobRuns).where(eq(jobRuns.job, job)).orderBy(desc(jobRuns.startedAt)).limit(1);
        const [lastOk] = await db
          .select({ at: jobRuns.finishedAt })
          .from(jobRuns)
          .where(and(eq(jobRuns.job, job), eq(jobRuns.status, "succeeded")))
          .orderBy(desc(jobRuns.startedAt))
          .limit(1);
        return { job, last: last ?? null, lastSuccessAt: lastOk?.at ?? null };
      }),
    ),
    db.select({ n: count() }).from(leads).where(and(eq(leads.crmStatus, "failed"), eq(leads.isSpam, false))),
    exhaustedLeadCount(),
    db.select({ n: count() }).from(leads).where(and(eq(leads.crmStatus, "pending"), eq(leads.isSpam, false))),
    db
      .select({ id: listings.id, title: listings.title, createdAt: listings.createdAt })
      .from(listings)
      .where(and(eq(listings.status, "pending_review"), isNull(listings.deletedAt)))
      .orderBy(asc(listings.createdAt))
      .limit(1),
    countLiveListings({}),
  ]);
  const storagePath = process.env.STORAGE_DRIVER === "local" || !process.env.STORAGE_DRIVER ? process.env.STORAGE_LOCAL_PATH : undefined;
  const disk = storagePath ? await dirSize(storagePath) : null;
  return {
    jobs: lastRuns,
    crm: { failed: Number(failedLeads[0]?.n ?? 0), exhausted, pending: Number(pendingLeads[0]?.n ?? 0) },
    oldestPending: oldest ?? null,
    live,
    disk,
  };
}
