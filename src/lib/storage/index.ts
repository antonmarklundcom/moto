// Interfaz de almacenamiento de imágenes (ADR-16). Fase 1 sólo tiene un
// driver ("local", disco del slot de Hostinger), pero todo el resto del
// código pasa por acá — nunca por `fs` directo — para que mover a un object
// storage después sea cambiar una implementación, no cazar rutas por todo
// el código.

import { LocalStorage } from "./local";

export type StoragePutInput = {
  /** Ruta relativa dentro del storage, ej. "listings/42/foto-1.jpg". */
  path: string;
  data: Buffer;
  contentType: string;
};

export interface Storage {
  put(input: StoragePutInput): Promise<void>;
  get(path: string): Promise<Buffer | null>;
  delete(path: string): Promise<void>;
  /** URL pública (o relativa) para servir el archivo. */
  url(path: string): string;
}

let cachedStorage: Storage | null = null;

/**
 * Devuelve la implementación de storage según STORAGE_DRIVER. Sólo este
 * archivo decide qué driver se usa; el resto del código sólo ve `Storage`.
 */
export function getStorage(): Storage {
  if (cachedStorage) {
    return cachedStorage;
  }

  const driver = process.env.STORAGE_DRIVER ?? "local";

  switch (driver) {
    case "local":
      cachedStorage = new LocalStorage();
      return cachedStorage;
    default:
      throw new Error(`getStorage: STORAGE_DRIVER desconocido: "${driver}"`);
  }
}
