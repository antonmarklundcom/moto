// Limpieza de HTML editorial (posts.body_html e intro_html) al guardar.
// Segura por construcción: no se copia ninguna etiqueta ni atributo tal como
// vino. Cada etiqueta permitida se vuelve a escribir desde cero (sin
// atributos, salvo un `href` validado en <a>) y todo el texto se escapa. Lo
// que no se reconoce queda como texto escapado. Módulo puro.

const ALLOWED = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "a", "br", "blockquote"]);
const RENAME: Record<string, string> = { b: "strong", i: "em" };
const VOID = new Set(["br"]);
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(value: string): string {
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);?/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Texto entre etiquetas: se decodifica y se vuelve a escapar (una entidad rara no pasa). */
function text(value: string): string {
  return escapeHtml(decodeEntities(value));
}

/**
 * `href` permitido: ruta del sitio (`/…`, no `//…`), ancla o http(s).
 * Se decodifica y se quitan espacios y controles antes de mirar el esquema,
 * para que `java&#115;cript:` o `\tjavascript:` no pasen.
 */
export function safeHref(raw: string): string | null {
  const value = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
  if (value === "") return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  if (value.startsWith("#")) return value;
  if (/^https?:\/\/[^/\\]/i.test(value)) return value;
  return null;
}

const TAG = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/;
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  const src = input
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/<(script|style|iframe|object|embed|template|noscript|svg|math)\b[\s\S]*?(<\/\1\s*>|$)/gi, "");
  let out = "";
  const stack: string[] = [];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) {
      out += text(src.slice(i));
      break;
    }
    out += text(src.slice(i, lt));
    const m = TAG.exec(src.slice(lt));
    if (!m) {
      out += "&lt;";
      i = lt + 1;
      continue;
    }
    i = lt + m[0].length;
    const closing = m[1] === "/";
    const lower = m[2].toLowerCase();
    const tag = RENAME[lower] ?? lower;
    if (!ALLOWED.has(tag)) continue;
    if (VOID.has(tag)) {
      if (!closing) out += `<${tag}>`;
      continue;
    }
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at === -1) continue;
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    if (tag === "a") {
      const h = HREF.exec(m[3]);
      const href = h ? safeHref(h[1] ?? h[2] ?? h[3] ?? "") : null;
      if (!href) continue; // <a> sin destino válido: queda sólo el texto
      const external = /^https?:/i.test(href);
      out += `<a href="${escapeHtml(href)}"${external ? ' rel="nofollow noopener"' : ""}>`;
    } else {
      out += `<${tag}>`;
    }
    stack.push(tag);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out.trim();
}

/** Contenido con `[VERIFICAR…]` sin resolver no se publica (CONTENT_STRATEGY §1.7). */
export function hasPendingVerification(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) => Boolean(p && /\[\s*VERIFICAR/i.test(p)));
}
