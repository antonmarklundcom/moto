// Slugify sin acentos, con desambiguación numérica al colisionar
// (DATABASE_SCHEMA.md, convenciones globales). Un slug publicado nunca cambia
// al editar el título de una publicación publicada — eso lo garantiza quien
// llama (no volver a generar el slug si ya existe), no esta función.

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

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
 * Genera un slug único agregando "-2", "-3", ... si el slug base ya existe.
 * `slugExists` es responsabilidad de quien llama (por ejemplo, una consulta
 * a la base).
 */
export function slugifyUnique(
  input: string,
  slugExists: (candidate: string) => boolean,
): string {
  const base = slugify(input);
  if (!slugExists(base)) {
    return base;
  }

  let attempt = 2;
  let candidate = `${base}-${attempt}`;
  while (slugExists(candidate)) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}
