import { readFileSync } from "node:fs";
import path from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";
import { CONTENT_FILES, MIGRATIONS } from "@/generated/embedded";
import { buildEmbedded } from "../../../scripts/embed-files.mjs";
import { errorCode, retryDelayMs } from "./boot";
import { dbHint, envReport } from "./health";

describe("archivos embebidos (Hostinger despliega sólo el build)", () => {
  it("src/generated/embedded.ts está al día con /drizzle y /content", () => {
    const current = readFileSync(path.join(process.cwd(), "src", "generated", "embedded.ts"), "utf8");
    expect(current, "corré `node scripts/embed-files.mjs`").toBe(buildEmbedded());
  });

  it("las migraciones embebidas son idénticas a las que lee drizzle del disco", () => {
    const disk = readMigrationFiles({ migrationsFolder: path.join(process.cwd(), "drizzle") });
    expect(MIGRATIONS.map(({ sql, bps, folderMillis, hash }) => ({ sql, bps, folderMillis, hash }))).toEqual(disk);
  });

  it("trae los textos de content/seo y content/guias", () => {
    expect(Object.keys(CONTENT_FILES).some((k) => k.startsWith("seo/"))).toBe(true);
    expect(Object.keys(CONTENT_FILES).filter((k) => k.startsWith("guias/")).length).toBeGreaterThanOrEqual(10);
  });
});

describe("diagnóstico", () => {
  it("códigos cortos, nunca el mensaje", () => {
    expect(errorCode(Object.assign(new Error("Access denied for user 'x'@'localhost'"), { code: "ER_ACCESS_DENIED_ERROR" }))).toBe("ER_ACCESS_DENIED_ERROR");
    expect(errorCode({ cause: { code: "ECONNREFUSED" } })).toBe("ECONNREFUSED");
    expect(errorCode(new Error("x"))).toBe("ERROR");
    expect(errorCode({ code: "no es un código; con espacios" })).toBe("ERROR");
  });

  it("cada error de base trae qué hacer", () => {
    expect(dbHint("ER_ACCESS_DENIED_ERROR")).toMatch(/clave/);
    expect(dbHint("ECONNREFUSED")).toMatch(/localhost/);
    expect(dbHint("lo-que-sea")).toMatch(/boot:/);
  });

  it("variables: sólo sí/no, con forma válida", () => {
    const r = envReport({
      DATABASE_URL: "mysql://u:p%21@localhost:3306/db",
      SITE_URL: "https://moto.com.py",
      SESSION_SECRET: "x".repeat(40),
      IP_HASH_SALT: "y".repeat(40),
      CRON_SECRET: "z".repeat(40),
      WHATSAPP_SITE_NUMBER: "+595995628862",
    });
    expect(r).toEqual({ DATABASE_URL: true, SITE_URL: true, SESSION_SECRET: true, IP_HASH_SALT: true, CRON_SECRET: true, WHATSAPP_SITE_NUMBER: true, VENDERCRM: false });
    expect(envReport({ DATABASE_URL: "DATABASE_URL=mysql://u:p@localhost/db", SESSION_SECRET: "corta" })).toMatchObject({ DATABASE_URL: false, SESSION_SECRET: false });
  });

  it("reintentos de la base: 30 s, 1 min, 2 min… hasta 10 min", () => {
    expect([1, 2, 3, 10].map(retryDelayMs)).toEqual([30_000, 60_000, 120_000, 600_000]);
  });
});
