// Arranque del servidor (src/instrumentation.ts): deja la app lista sin pasos
// manuales en Hostinger.
//   1. Carpeta de fotos: si falta STORAGE_LOCAL_PATH se usa ~/moto-uploads
//      (fuera de la carpeta de la app, que se reemplaza en cada deploy).
//   2. Migraciones (idempotentes; el migrador lleva su tabla). Van dentro del
//      bundle (src/generated/embedded.ts): Hostinger no siempre deja /drizzle
//      junto al build.
//   3. Catálogo inicial, sólo si no hay ninguna marca (no pisa ediciones del admin).
//   4. Primer admin desde ADMIN_EMAIL + ADMIN_PASSWORD, sólo si no existe ningún admin.
//   5. Programador interno de jobs (reemplaza el cron de hPanel; ADR-19).
// Nada de esto tumba el servidor: un fallo se registra y el sitio sigue. Si la
// base no responde, los pasos 2–4 se reintentan solos (30 s, 1 min, 2 min… hasta
// 10 min entre intentos). El estado de cada paso se ve en /api/health.
import "server-only";

import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, count, eq } from "drizzle-orm";
import { autoSetupEnabled, firstDelayMs, internalCronEnabled, JOB_EVERY_MS } from "./schedule";

type Env = Record<string, string | undefined>;

function log(level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ level, msg: `boot: ${msg}`, ...extra }));
}

export type BootStepState = { ok: boolean; at: string; code?: string };

/** Estado de los pasos del arranque, por proceso. Lo lee /api/health. */
export function bootState(): { steps: Record<string, BootStepState>; attempts: number } {
  const g = globalThis as unknown as { motoBoot?: { steps: Record<string, BootStepState>; attempts: number } };
  g.motoBoot ??= { steps: {}, attempts: 0 };
  return g.motoBoot;
}

/** Código corto del error (mysql2/Node: ER_ACCESS_DENIED_ERROR, ECONNREFUSED…). Nunca el mensaje. */
export function errorCode(error: unknown): string {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" && /^[A-Z0-9_]{2,64}$/.test(code) ? code : "ERROR";
}

async function step(name: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    const detail = await fn();
    log("info", name, detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {});
    bootState().steps[name] = { ok: true, at: new Date().toISOString() };
    return true;
  } catch (error) {
    const code = errorCode(error);
    log("error", `${name} falló`, { code, error: error instanceof Error ? error.message : String(error) });
    bootState().steps[name] = { ok: false, at: new Date().toISOString(), code };
    return false;
  }
}

export async function ensureUploadsDir(env: Env = process.env): Promise<string> {
  const dir = env.STORAGE_LOCAL_PATH?.trim() || path.join(os.homedir(), "moto-uploads");
  env.STORAGE_LOCAL_PATH = dir;
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function bootstrapAdmin(env: Env = process.env): Promise<string> {
  const email = env.ADMIN_EMAIL?.trim();
  const password = env.ADMIN_PASSWORD ?? "";
  if (!email || !password) return "sin ADMIN_EMAIL/ADMIN_PASSWORD";
  // Olvidé la clave (sin SSH): ADMIN_PASSWORD_RESET=true + clave nueva y redeploy.
  const reset = (env.ADMIN_PASSWORD_RESET ?? "").trim().toLowerCase() === "true";
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const [row] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true)));
  if (Number(row?.n ?? 0) > 0 && !reset) return "ya hay un admin";
  const { passwordProblem } = await import("@/lib/auth/password");
  const problem = passwordProblem(password);
  if (problem) throw new Error(`ADMIN_PASSWORD: ${problem}`);
  const { createPanelUser } = await import("@/lib/auth/users");
  const r = await createPanelUser({ email, name: env.ADMIN_NAME?.trim() || "Admin", password, role: "admin", resetIfExists: true });
  if (reset) {
    // Resetear también desbloquea la cuenta (como `npm run create-admin -- --reset`).
    const salt = env.IP_HASH_SALT?.trim();
    if (salt) {
      const { clearAccountFailures } = await import("@/lib/auth/lockout");
      await clearAccountFailures(email, salt);
    }
    log("warn", "ADMIN_PASSWORD_RESET aplicado: sacá la variable del panel para que no se repita en cada arranque");
    return r.created ? `admin creado (id ${r.id})` : `clave del admin reseteada (id ${r.id})`;
  }
  return `admin creado (id ${r.id})`;
}

let started = false;

/** Migraciones, catálogo y primer admin. `false` = la base no está lista (se reintenta). */
async function prepareDatabase(env: Env): Promise<boolean> {
  bootState().attempts += 1;
  const migrated = await step("migraciones", async () => {
    const { db } = await import("@/db");
    const { migrateEmbedded } = await import("@/db/migrate-embedded");
    return migrateEmbedded(db);
  });
  if (!migrated) return false;
  await step("catálogo", async () => {
    const { db } = await import("@/db");
    const { brands } = await import("@/db/schema");
    const [row] = await db.select({ n: count() }).from(brands);
    if (Number(row?.n ?? 0) > 0) return { skipped: "ya hay marcas" };
    const { seedCatalog } = await import("@/db/seed-catalog");
    await seedCatalog();
    return { seeded: true };
  });
  await step("primer admin", async () => ({ result: await bootstrapAdmin(env) }));
  return true;
}

/** Espera antes del intento n+1: 30 s, 1 min, 2 min… con techo de 10 min. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 600_000);
}

async function prepareWithRetry(env: Env): Promise<void> {
  if (await prepareDatabase(env)) return;
  const wait = retryDelayMs(bootState().attempts);
  log("warn", `la base no está lista; se reintenta en ${Math.round(wait / 1000)} s`);
  setTimeout(() => void prepareWithRetry(env), wait).unref();
}

export async function boot(env: Env = process.env): Promise<void> {
  if (started) return;
  started = true;
  if (!env.DATABASE_URL) {
    log("warn", "sin DATABASE_URL: no se prepara nada");
    bootState().steps["DATABASE_URL"] = { ok: false, at: new Date().toISOString(), code: "MISSING" };
    return;
  }
  if (autoSetupEnabled(env)) {
    await step("carpeta de fotos", async () => ({ dir: await ensureUploadsDir(env) }));
    await prepareWithRetry(env);
  }
  if (internalCronEnabled(env)) startScheduler();
}

function startScheduler() {
  Object.entries(JOB_EVERY_MS).forEach(([job, every], i) => {
    const run = async () => {
      try {
        const { getCronJob } = await import("@/lib/cron/jobs");
        const { runJob } = await import("@/lib/cron/runner");
        const fn = getCronJob(job);
        if (fn) await runJob(job, fn);
      } catch (error) {
        log("error", `job ${job} falló`, { error: error instanceof Error ? error.message : String(error) });
      }
    };
    setTimeout(() => {
      void run();
      setInterval(() => void run(), every).unref();
    }, firstDelayMs(i)).unref();
  });
  log("info", "programador interno encendido", { jobs: Object.keys(JOB_EVERY_MS) });
}
