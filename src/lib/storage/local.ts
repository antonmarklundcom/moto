// Implementación local de la interfaz Storage (ADR-16): guarda en el disco
// del slot de Hostinger, bajo STORAGE_LOCAL_PATH. Es el único archivo del
// proyecto, junto con index.ts, que debería tocar `node:fs`.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
    await writeFile(full, data);
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
    return `/uploads/${path}`;
  }
}
