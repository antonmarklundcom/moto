// Ejecución de jobs programados (ADR-19). Cada ejecución es una fila de
// `job_runs` (DATABASE_SCHEMA.md §2.17): auditoría, señal de /admin/salud y
// candado. Mientras corre, `lock_key` = nombre del job; el UNIQUE hace que una
// segunda ejecución simultánea choque y salga como `locked`. Un candado de
// más de 30 minutos es de un proceso que murió: se libera antes de intentar.
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { jobRuns } from "@/db/schema";

export const STALE_LOCK_MS = 30 * 60 * 1000;

export type JobDetail = Record<string, unknown>;
export type JobFn = (ctx: { now: Date; runId: number }) => Promise<JobDetail>;

export type JobRunResult =
  | { status: "succeeded"; runId: number; detail: JobDetail }
  | { status: "failed"; runId: number; error: string }
  | { status: "locked" };

function isDuplicateKey(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

/** Libera candados de `job` con más de STALE_LOCK_MS; marca esas filas como fallidas. */
export async function releaseStaleLocks(job: string, now = new Date()): Promise<number> {
  const [res] = await db
    .update(jobRuns)
    .set({ lockKey: null, status: "failed", finishedAt: now, detailJson: { error: "stale lock released" } })
    .where(and(eq(jobRuns.lockKey, job), lt(jobRuns.startedAt, new Date(now.getTime() - STALE_LOCK_MS))));
  return res.affectedRows;
}

export async function runJob(job: string, fn: JobFn, now = new Date()): Promise<JobRunResult> {
  const released = await releaseStaleLocks(job, now);
  if (released > 0) {
    console.warn(JSON.stringify({ level: "warn", msg: "cron: candado vencido liberado", job, released }));
  }

  let runId: number;
  try {
    const [res] = await db.insert(jobRuns).values({ job, lockKey: job, status: "running", startedAt: now });
    runId = res.insertId;
  } catch (error) {
    if (isDuplicateKey(error)) return { status: "locked" };
    throw error;
  }

  try {
    const detail = await fn({ now, runId });
    await db
      .update(jobRuns)
      .set({ lockKey: null, status: "succeeded", finishedAt: new Date(), detailJson: detail })
      .where(eq(jobRuns.id, runId));
    console.info(JSON.stringify({ level: "info", msg: "cron: job terminado", job, runId, detail }));
    return { status: "succeeded", runId, detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(jobRuns)
      .set({ lockKey: null, status: "failed", finishedAt: new Date(), detailJson: { error: message.slice(0, 2000) } })
      .where(eq(jobRuns.id, runId));
    console.error(JSON.stringify({ level: "error", msg: "cron: job falló", job, runId, error: message }));
    return { status: "failed", runId, error: message };
  }
}
