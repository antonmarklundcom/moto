import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorage } from "./local";

describe("LocalStorage", () => {
  let base: string;
  let storage: LocalStorage;

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), "moto-storage-"));
    storage = new LocalStorage(base);
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("put + get devuelven el mismo contenido", async () => {
    await storage.put({ path: "listings/1/a.webp", data: Buffer.from("hola"), contentType: "image/webp" });
    expect((await storage.get("listings/1/a.webp"))?.toString()).toBe("hola");
  });

  it("no deja temporales después de escribir (escritura atómica, F-9)", async () => {
    await storage.put({ path: "listings/1/a.webp", data: Buffer.from("x"), contentType: "image/webp" });
    expect(await readdir(join(base, "listings/1"))).toEqual(["a.webp"]);
  });

  it("get de algo inexistente → null", async () => {
    expect(await storage.get("no/existe.webp")).toBeNull();
  });

  it("delete borra y es idempotente", async () => {
    await storage.put({ path: "a.webp", data: Buffer.from("x"), contentType: "image/webp" });
    await storage.delete("a.webp");
    await storage.delete("a.webp");
    expect(await storage.get("a.webp")).toBeNull();
  });

  it("rechaza rutas que escapan del directorio base", async () => {
    await expect(storage.get("../../etc/passwd")).rejects.toThrow();
  });

  it("url() apunta a /media/ (F-9), no a /uploads/", () => {
    expect(storage.url("listings/1/foto 1.webp")).toBe("/media/listings/1/foto%201.webp");
  });
});
