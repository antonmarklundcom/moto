import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// src/db/index.ts exige DATABASE_URL al importarse; crear el pool no conecta.
describe("poolOptionsFromUrl (F-2)", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "mysql://u:p@127.0.0.1:3306/x");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parsea host, puerto, credenciales y base", async () => {
    const { poolOptionsFromUrl } = await import("./index");
    const options = poolOptionsFromUrl("mysql://us%40er:cl%3Ave@db.host:3307/moto_prod");
    expect(options).toMatchObject({
      host: "db.host",
      port: 3307,
      user: "us@er",
      password: "cl:ve",
      database: "moto_prod",
      connectionLimit: 8,
      timezone: "Z",
    });
    expect(options.ssl).toBeUndefined();
  });

  it("respeta ?ssl=true y ?charset=", async () => {
    const { poolOptionsFromUrl } = await import("./index");
    const options = poolOptionsFromUrl("mysql://u:p@h/db?ssl=true&charset=utf8mb4");
    expect(options.ssl).toEqual({});
    expect(options.charset).toBe("utf8mb4");
  });

  it("acepta ssl como JSON", async () => {
    const { poolOptionsFromUrl } = await import("./index");
    const options = poolOptionsFromUrl(
      `mysql://u:p@h/db?ssl=${encodeURIComponent('{"rejectUnauthorized":false}')}`,
    );
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("ssl=false no activa TLS", async () => {
    const { poolOptionsFromUrl } = await import("./index");
    expect(poolOptionsFromUrl("mysql://u:p@h/db?ssl=false").ssl).toBeUndefined();
  });

  it("reutiliza el mismo db entre re-evaluaciones del módulo (singleton)", async () => {
    const first = (await import("./index")).db;
    vi.resetModules();
    const second = (await import("./index")).db;
    expect(second).toBe(first);
    await (await import("./index")).closeDb();
  });
});
