import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { CRON_JOBS } from "@/lib/cron/jobs";
import { bootstrapAdmin, ensureUploadsDir } from "./boot";
import { JOB_EVERY_MS } from "./schedule";

const EMAIL = `boot-${Date.now().toString(36)}@example.com`;
let tmp = "";

afterAll(async () => {
  await db.delete(users).where(eq(users.email, EMAIL));
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe("arranque automático", () => {
  it("el programador cubre todos los jobs registrados", () => {
    expect(Object.keys(JOB_EVERY_MS).sort()).toEqual(Object.keys(CRON_JOBS).sort());
  });

  it("las migraciones se pueden volver a correr (idempotentes)", async () => {
    await expect(migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") })).resolves.toBeUndefined();
  });

  it("crea la carpeta de fotos (por defecto o la indicada)", async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "boot-"));
    const env: Record<string, string | undefined> = { STORAGE_LOCAL_PATH: path.join(tmp, "a", "b") };
    const dir = await ensureUploadsDir(env);
    expect((await stat(dir)).isDirectory()).toBe(true);
    const empty: Record<string, string | undefined> = {};
    expect(await ensureUploadsDir(empty)).toBe(path.join(os.homedir(), "moto-uploads"));
    expect(empty.STORAGE_LOCAL_PATH).toBe(path.join(os.homedir(), "moto-uploads"));
  });

  it("primer admin: sólo con las variables y si no hay ningún admin", async () => {
    expect(await bootstrapAdmin({})).toBe("sin ADMIN_EMAIL/ADMIN_PASSWORD");
    const [anyAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    const result = await bootstrapAdmin({ ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: "clave-de-arranque-larga" });
    if (anyAdmin) {
      expect(result).toBe("ya hay un admin");
      expect(await db.select().from(users).where(eq(users.email, EMAIL))).toHaveLength(0);
    } else {
      expect(result).toMatch(/admin creado/);
    }
    await expect(bootstrapAdmin({ ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: "corta" })).resolves.toBeDefined();
  });

  it("ADMIN_PASSWORD_RESET=true resetea la clave del admin indicado (sin SSH)", async () => {
    const env = { ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: "otra-clave-de-reseteo-9", ADMIN_PASSWORD_RESET: "true" };
    expect(await bootstrapAdmin(env)).toMatch(/admin creado|clave del admin reseteada/);
    const [u] = await db.select().from(users).where(eq(users.email, EMAIL));
    expect(u).toMatchObject({ role: "admin", isActive: true });
    const { verifyPassword } = await import("@/lib/auth/password");
    expect(await verifyPassword("otra-clave-de-reseteo-9", u.passwordHash)).toBe(true);
  });
});
