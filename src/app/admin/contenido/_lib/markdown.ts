// Borradores de guías en `content/guias/*.md` → HTML de `posts.body_html`.
// Subconjunto chico y predecible: `##`/`###`, párrafos, listas `-` y `1.`,
// `**negrita**`, `*cursiva*` y `[texto](/ruta)`. La salida pasa igual por
// `sanitizeHtml`. Módulo puro.

import { escapeHtml, safeHref, sanitizeHtml } from "./sanitize";

export type GuideFile = {
  slug: string;
  title: string;
  excerpt: string | null;
  metaDescription: string | null;
  query: string | null;
  bodyMarkdown: string;
};

/** Frontmatter `clave: valor` entre dos líneas `---`. */
export function parseGuideFile(source: string): GuideFile {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source.replace(/^﻿/, ""));
  if (!m) throw new Error("guía sin frontmatter (--- … ---)");
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  if (!meta.slug || !meta.title) throw new Error("guía sin slug o sin title");
  return {
    slug: meta.slug,
    title: meta.title,
    excerpt: meta.excerpt || null,
    metaDescription: meta.meta_description || null,
    query: meta.query || null,
    bodyMarkdown: m[2].trim(),
  };
}

function inline(raw: string): string {
  let s = escapeHtml(raw);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, url: string) => {
    const href = safeHref(url.replace(/&amp;/g, "&"));
    return href ? `<a href="${escapeHtml(href)}">${label}</a>` : whole;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
  return s;
}

export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((it) => `<li>${inline(it)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    let m: RegExpExecArray | null;
    if (line === "") {
      flushPara();
      flushList();
    } else if ((m = /^(#{2,4})\s+(.*)$/.exec(line))) {
      flushPara();
      flushList();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if ((m = /^[-*]\s+(.*)$/.exec(line)) || (m = /^\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      const tag = /^\d/.test(line) ? "ol" : "ul";
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push(m[1]);
    } else if (list && /^\s{2,}/.test(rawLine)) {
      list.items[list.items.length - 1] += ` ${line}`;
    } else {
      flushList();
      para.push(line.replace(/^#\s+/, ""));
    }
  }
  flushPara();
  flushList();
  return sanitizeHtml(out.join("\n"));
}
