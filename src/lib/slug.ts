// Slugify sin acentos, con desambiguación numérica al colisionar
// (DATABASE_SCHEMA.md, convenciones globales). Un slug publicado nunca cambia
// al editar el título de una publicación publicada — eso lo garantiza quien
// llama (no volver a generar el slug si ya existe), no esta función.

import { randomInt } from "node:crypto";

// Escapado explícito (F-8): los caracteres combinantes literales en una regex
// se rompen o desaparecen al pasar por algunos editores.
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Slugs que chocan con segmentos fijos de las rutas públicas (G-15):
 * `/motos/:brand` convive con `/motos/tipo`, `/motos/ciudad`, `/motos/nuevas`,
 * `/motos/usadas` y `/motos/en-cuotas`; `/motos/:brand/:model` convive con
 * `/motos/:brand/ciudad/…`; y `page` es el parámetro de paginación.
 * Ninguna marca, modelo, categoría, ciudad ni comercio puede tener uno de estos
 * slugs. Agregar uno nuevo acá es un cambio de rutas: escalar (PLAN.md §4.3).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "tipo",
  "ciudad",
  "nuevas",
  "usadas",
  "en-cuotas",
  "page",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Convierte un texto a slug: minúsculas, sin acentos, separado por guiones,
 * sin caracteres fuera de [a-z0-9-].
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base === "") {
    throw new Error(`slugify: no se pudo generar un slug a partir de: "${input}"`);
  }

  return base;
}

/**
 * Genera un slug único agregando "-2", "-3", ... si el slug base ya existe o
 * está reservado. `slugExists` es responsabilidad de quien llama.
 */
export function slugifyUnique(
  input: string,
  slugExists: (candidate: string) => boolean,
): string {
  const taken = (candidate: string) => isReservedSlug(candidate) || slugExists(candidate);
  const base = slugify(input);
  if (!taken(base)) {
    return base;
  }

  let attempt = 2;
  let candidate = `${base}-${attempt}`;
  while (taken(candidate)) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}

/**
 * Igual que `slugifyUnique`, pero con una verificación asíncrona (una consulta
 * a la base). La unicidad final la garantiza el índice UNIQUE: quien llama
 * debe reintentar si el INSERT choca por una carrera.
 */
export async function slugifyUniqueAsync(
  input: string,
  slugExists: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const base = slugify(input);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (!isReservedSlug(candidate) && !(await slugExists(candidate))) {
      return candidate;
    }
  }
  throw new Error(`slugifyUniqueAsync: sin slug libre para "${input}" tras ${maxAttempts} intentos`);
}

// Sin 0/O, 1/I/L: el código se dicta por teléfono y se tipea en WhatsApp.
export const PUBLIC_REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PUBLIC_REF_LENGTH = 8;
const PUBLIC_REF_PATTERN = new RegExp(`^[${PUBLIC_REF_ALPHABET}]{${PUBLIC_REF_LENGTH}}$`);

/**
 * Código corto de publicación (`listings.public_ref`, CHAR(8)). Se guarda en
 * mayúsculas y va en minúsculas en las URLs. La unicidad la garantiza el
 * índice UNIQUE: ante una colisión, generar otro.
 */
export function publicRef(): string {
  let ref = "";
  for (let i = 0; i < PUBLIC_REF_LENGTH; i += 1) {
    ref += PUBLIC_REF_ALPHABET[randomInt(PUBLIC_REF_ALPHABET.length)];
  }
  return ref;
}

/** Normaliza un código escrito por una persona o leído de una URL; `null` si no es válido. */
export function parsePublicRef(input: string): string | null {
  const ref = input.trim().toUpperCase();
  return PUBLIC_REF_PATTERN.test(ref) ? ref : null;
}
