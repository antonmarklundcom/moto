// Texto editorial de las páginas sin `intro_html` en la base (decisión del
// propietario 2026-09-23, docs/decisions-needed.md A2 → A): archivos
// versionados `content/seo/<clave>.md`. Editar = PR.
//
// Un archivo sólo cuenta (se muestra y suma palabras para el umbral de
// SEO_ARCHITECTURE.md §2.1) si su frontmatter dice `status: reviewed`, trae
// `reviewed_by` y no le queda ningún `[VERIFICAR…]`. Un borrador es invisible:
// la página sigue `noindex` por regla, igual que sin archivo.
import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { markdownToHtml } from "@/app/admin/contenido/_lib/markdown";
import { hasPendingVerification } from "@/app/admin/contenido/_lib/sanitize";
import { countWords } from "./indexability";

export type EditorialText = { html: string; words: number };

const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

/** Claves de las páginas que leen de `content/seo/`. Una sola fuente para páginas y sitemap. */
export const editorialKeys = {
  enCuotas: "en-cuotas",
  condition: (condition: "new" | "used") => (condition === "new" ? "condicion-nuevas" : "condicion-usadas"),
  brandCity: (brandSlug: string, citySlug: string) => `marca-ciudad/${brandSlug}-${citySlug}`,
  categoryCity: (categorySlug: string, citySlug: string) => `tipo-ciudad/${categorySlug}-${citySlug}`,
};

export type EditorialFile = { status: string; reviewedBy: string | null; body: string };

/** Frontmatter `clave: valor` entre dos `---`. Módulo puro para las pruebas. */
export function parseEditorialFile(source: string): EditorialFile | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source.replace(/^﻿/, ""));
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { status: meta.status ?? "draft", reviewedBy: meta.reviewed_by || null, body: m[2].trim() };
}

/** ¿Se puede publicar? Revisado, con revisor y sin `[VERIFICAR]`. */
export function editorialFromFile(file: EditorialFile | null): EditorialText | null {
  if (!file || file.status !== "reviewed" || !file.reviewedBy || !file.body) return null;
  if (hasPendingVerification(file.body)) return null;
  const html = markdownToHtml(file.body);
  return { html, words: countWords(html) };
}

const memo = new Map<string, EditorialText | null>();

/** Texto publicable de `content/seo/<key>.md`, o `null`. Se lee una vez por proceso (cambia sólo con un deploy). */
export function editorialText(key: string): EditorialText | null {
  if (!KEY.test(key)) return null;
  if (memo.has(key)) return memo.get(key)!;
  let result: EditorialText | null = null;
  try {
    result = editorialFromFile(parseEditorialFile(readFileSync(path.join(process.cwd(), "content", "seo", `${key}.md`), "utf8")));
  } catch {
    result = null; // sin archivo = sin texto
  }
  if (process.env.NODE_ENV === "production") memo.set(key, result);
  return result;
}
