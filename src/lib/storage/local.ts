// Implementación local de la interfaz Storage (ADR-16): guarda en el disco
// del slot de Hostinger, bajo STORAGE_LOCAL_PATH. Es el único archivo del
// proyecto, junto con index.ts, que debería tocar `node:fs`.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative } from "node:path";
import type { Storage, StoragePutInput } from "./index";

export class LocalStorage implements Storage {
  private readonly basePath: string;

  constructor(basePath = process.env.STORAGE_LOCAL_PATH) {
    if (!basePath) {
      throw new Error(
        "LocalStorage: STORAGE_LOCAL_PATH no está definida. Copiá .env.example a .env y completala.",
      );
    }
    this.basePath = basePath;
  }

  private resolve(path: string): string {
    const full = normalize(join(this.basePath, path));
    const rel = relative(this.basePath, full);
    // Evita que un path como "../../etc/passwd" escape del directorio base.
    if (rel.startsWith("..") || rel === "") {
      throw new Error(`LocalStorage: ruta inválida: "${path}"`);
    }
    return full;
  }

  async put({ path, data }: StoragePutInput): Promise<void> {
    const full = this.resolve(path);
    await mkdir(dirname(full), { recursive: true });
    // Escritura atómica (F-9): se escribe a un temporal en el mismo directorio
    // y se renombra. Un lector nunca ve un archivo a medio escribir, y un corte
    // a mitad de camino deja sólo un .tmp huérfano, no una imagen rota.
    const tmp = `${full}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      await writeFile(tmp, data);
      await rename(tmp, full);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
  }

  async get(path: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async delete(path: string): Promise<void> {
    await rm(this.resolve(path), { force: true });
  }

  url(path: string): string {
    // Servido por la ruta /media/[...path] (G-22, la construye A3) con caché
    // inmutable. Los archivos viven fuera de public/ (ADR-16).
    return `/media/${path.split("/").map(encodeURIComponent).join("/")}`;
  }
}
