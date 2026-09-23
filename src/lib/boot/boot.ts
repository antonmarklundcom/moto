// Arranque del servidor (src/instrumentation.ts): deja la app lista sin pasos
// manuales en Hostinger.
//   1. Carpeta de fotos: si falta STORAGE_LOCAL_PATH se usa ~/moto-uploads
//      (fuera de la carpeta de la app, que se reemplaza en cada deploy).
//   2. Migraciones de /drizzle (idempotentes; el migrador lleva su tabla).
//   3. Catálogo inicial, sólo si no hay ninguna marca (no pisa ediciones del admin).
//   4. Primer admin desde ADMIN_EMAIL + ADMIN_PASSWORD, sólo si no existe ningún admin.
//   5. Programador interno de jobs (reemplaza el cron de hPanel; ADR-19).
// Nada de esto tumba el servidor: un fallo se registra y el sitio sigue.
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

async function step(name: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    const detail = await fn();
    log("info", name, detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {});
    return true;
  } catch (error) {
    log("error", `${name} falló`, { error: error instanceof Error ? error.message : String(error) });
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

export async function boot(env: Env = process.env): Promise<void> {
  if (started) return;
  started = true;
  if (!env.DATABASE_URL) {
    log("warn", "sin DATABASE_URL: no se prepara nada");
    return;
  }
  if (autoSetupEnabled(env)) {
    await step("carpeta de fotos", async () => ({ dir: await ensureUploadsDir(env) }));
    const migrated = await step("migraciones", async () => {
      const { migrate } = await import("drizzle-orm/mysql2/migrator");
      const { db } = await import("@/db");
      await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    });
    if (migrated) {
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
    }
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
