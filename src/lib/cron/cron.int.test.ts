import { and, eq, inArray, lt } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/cron/[job]/route";
import { closeDb, db } from "@/db";
import { authAttempts, jobRuns, listings } from "@/db/schema";
import { activityFor, createFixtures } from "@/lib/auth/int-fixtures";
import { addDays } from "@/lib/listings/state";
import { expireListings } from "./jobs/expire-listings";
import { purgeAuthAttempts } from "./jobs/purge-auth-attempts";
import { runJob, STALE_LOCK_MS } from "./runner";

const TAG = `a1cron${Date.now()}`;
const JOB = `test-${TAG}`;
let fx: Awaited<ReturnType<typeof createFixtures>>;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  fx = await createFixtures(TAG);
});
afterAll(async () => {
  await db.delete(jobRuns).where(eq(jobRuns.job, JOB));
  await fx.cleanup();
  await closeDb();
});

async function status(id: number) {
  const [r] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, id));
  return r.status;
}

describe("job expire-listings (TEST_PLAN.md §3)", () => {
  it("cambia sólo lo que corresponde y escribe activity_log", async () => {
    const now = new Date();
    const dealer30 = await fx.dealer({ ttlDays: 30 });
    const dealerNull = await fx.dealer({ ttlDays: null });

    const shouldExpire = {
      pastExpiry: await fx.listing({ status: "published", expiresAt: new Date(now.getTime() - 60_000) }),
      dealerTtl31d: await fx.listing({ status: "published", dealerId: dealer30, publishedAt: new Date(now.getTime() - 31 * DAY) }),
      default61d: await fx.listing({ status: "published", dealerId: dealerNull, publishedAt: new Date(now.getTime() - 61 * DAY) }),
      private61d: await fx.listing({ status: "published", publishedAt: new Date(now.getTime() - 61 * DAY) }),
    };
    const shouldStay = {
      futureExpiry: await fx.listing({ status: "published", expiresAt: addDays(now, 1) }),
      dealerTtl29d: await fx.listing({ status: "published", dealerId: dealer30, publishedAt: new Date(now.getTime() - 29 * DAY) }),
      default59d: await fx.listing({ status: "published", dealerId: dealerNull, publishedAt: new Date(now.getTime() - 59 * DAY) }),
      pausedPast: await fx.listing({ status: "paused", expiresAt: new Date(now.getTime() - DAY) }),
      soldPast: await fx.listing({ status: "sold", expiresAt: new Date(now.getTime() - DAY) }),
      deletedPast: await fx.listing({ status: "published", expiresAt: new Date(now.getTime() - DAY), deletedAt: now }),
      // expires_at manda sobre el TTL: publicado hace 90 días pero con plazo futuro.
      explicitFuture: await fx.listing({ status: "published", publishedAt: new Date(now.getTime() - 90 * DAY), expiresAt: addDays(now, 5) }),
    };

    const result = await runJob(JOB, expireListings, now);
    expect(result.status).toBe("succeeded");
    if (result.status === "succeeded") expect(result.detail.expired as number).toBeGreaterThanOrEqual(4);

    for (const [name, id] of Object.entries(shouldExpire)) {
      expect(await status(id), name).toBe("expired");
      const log = await activityFor(id);
      expect(log, name).toHaveLength(1);
      expect(log[0]).toMatchObject({ action: "expired", userId: null });
      expect(log[0].diffJson).toMatchObject({ status: { from: "published", to: "expired" }, job: "expire-listings" });
    }
    const before = { pausedPast: "paused", soldPast: "sold" } as Record<string, string>;
    for (const [name, id] of Object.entries(shouldStay)) {
      expect(await status(id), name).toBe(before[name] ?? "published");
      expect(await activityFor(id), name).toHaveLength(0);
    }

    const [run] = await db.select().from(jobRuns).where(eq(jobRuns.id, (result as { runId: number }).runId));
    expect(run).toMatchObject({ status: "succeeded", lockKey: null });
    expect(run.finishedAt).not.toBeNull();
    expect(run.detailJson).toMatchObject({ expired: expect.any(Number) });
  });
});

describe("candado de job_runs (ADR-19)", () => {
  it("una ejecución simultánea choca con el candado → locked", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = runJob(JOB, async () => {
      await gate;
      return { ok: true };
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(await runJob(JOB, async () => ({ ok: true }))).toEqual({ status: "locked" });
    release();
    expect((await first).status).toBe("succeeded");
    expect((await runJob(JOB, async () => ({ ok: true }))).status).toBe("succeeded");
  });

  it("un candado de más de 30 min se libera y la fila queda failed", async () => {
    const startedAt = new Date(Date.now() - STALE_LOCK_MS - 60_000);
    const [res] = await db.insert(jobRuns).values({ job: JOB, lockKey: JOB, status: "running", startedAt });
    const result = await runJob(JOB, async () => ({ ok: true }));
    expect(result.status).toBe("succeeded");
    const [stale] = await db.select().from(jobRuns).where(eq(jobRuns.id, res.insertId));
    expect(stale).toMatchObject({ status: "failed", lockKey: null });
  });

  it("un candado reciente no se libera", async () => {
    const [res] = await db.insert(jobRuns).values({ job: JOB, lockKey: JOB, status: "running", startedAt: new Date() });
    expect(await runJob(JOB, async () => ({ ok: true }))).toEqual({ status: "locked" });
    await db.update(jobRuns).set({ lockKey: null, status: "failed" }).where(eq(jobRuns.id, res.insertId));
  });

  it("un job que lanza → failed, candado liberado, error en detail_json", async () => {
    const result = await runJob(JOB, async () => {
      throw new Error("boom");
    });
    expect(result).toMatchObject({ status: "failed", error: "boom" });
    const [run] = await db.select().from(jobRuns).where(eq(jobRuns.id, (result as { runId: number }).runId));
    expect(run).toMatchObject({ status: "failed", lockKey: null, detailJson: { error: "boom" } });
  });
});

describe("job purge-auth-attempts", () => {
  it("borra lo de más de 30 días y deja lo reciente", async () => {
    const now = new Date();
    const oldHash = `old${TAG}`.padEnd(64, "0").slice(0, 64);
    const newHash = `new${TAG}`.padEnd(64, "0").slice(0, 64);
    await db.insert(authAttempts).values([
      { ipHash: oldHash, succeeded: false, createdAt: new Date(now.getTime() - 31 * DAY) },
      { ipHash: newHash, succeeded: false, createdAt: new Date(now.getTime() - 29 * DAY) },
    ]);
    await runJob(JOB, purgeAuthAttempts, now);
    const left = await db.select({ h: authAttempts.ipHash }).from(authAttempts).where(inArray(authAttempts.ipHash, [oldHash, newHash]));
    expect(left.map((r) => r.h)).toEqual([newHash]);
    await db.delete(authAttempts).where(and(eq(authAttempts.ipHash, newHash), lt(authAttempts.createdAt, now)));
  });
});

describe("POST /api/cron/[job]", () => {
  const call = (job: string, auth?: string) =>
    POST(new Request(`http://localhost/api/cron/${job}`, { method: "POST", headers: auth ? { authorization: auth } : {} }), {
      params: Promise.resolve({ job }),
    });

  it("sin CRON_SECRET → 503", async () => {
    const saved = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "";
    try {
      expect((await call("purge-auth-attempts", "Bearer x")).status).toBe(503);
    } finally {
      process.env.CRON_SECRET = saved;
    }
  });

  it("bearer ausente o incorrecto → 401; job desconocido → 404; correcto → 200 con detalle", async () => {
    const saved = process.env.CRON_SECRET;
    process.env.CRON_SECRET = `secreto-${TAG}`;
    try {
      expect((await call("purge-auth-attempts")).status).toBe(401);
      expect((await call("purge-auth-attempts", "Bearer otro")).status).toBe(401);
      expect((await call("no-existe", `Bearer secreto-${TAG}`)).status).toBe(404);
      expect((await call("__proto__", `Bearer secreto-${TAG}`)).status).toBe(404);
      const ok = await call("purge-auth-attempts", `Bearer secreto-${TAG}`);
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ job: "purge-auth-attempts", status: "succeeded", detail: { deleted: expect.any(Number) } });
    } finally {
      process.env.CRON_SECRET = saved;
    }
  });
});
