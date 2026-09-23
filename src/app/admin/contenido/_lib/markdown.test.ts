import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { countWords } from "@/lib/seo/indexability";
import { markdownToHtml, parseGuideFile } from "./markdown";

const DIR = path.join(process.cwd(), "content", "guias");
const LISTING = /href="\/motos(\/|")/g;

describe("markdownToHtml", () => {
  it("convierte el subconjunto", () => {
    const html = markdownToHtml("Intro con **negrita** y *cursiva*.\n\n## Paso 1\n\n- uno\n- [dos](/motos/usadas)\n\n1. a\n2. b");
    expect(html).toBe('<p>Intro con <strong>negrita</strong> y <em>cursiva</em>.</p>\n<h2>Paso 1</h2>\n<ul><li>uno</li><li><a href="/motos/usadas">dos</a></li></ul>\n<ol><li>a</li><li>b</li></ol>');
  });

  it("escapa el HTML crudo y descarta enlaces peligrosos", () => {
    expect(markdownToHtml("<script>alert(1)</script> [x](javascript:alert(1))")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt; [x](javascript:alert(1))</p>");
  });

  it("un # suelto no genera un segundo h1", () => {
    expect(markdownToHtml("# Título")).not.toContain("<h1>");
  });
});

describe("los 10 borradores de content/guias (CONTENT_STRATEGY §2.3)", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));

  it("son 10, con slug = nombre de archivo", () => {
    expect(files).toHaveLength(10);
    for (const f of files) expect(parseGuideFile(readFileSync(path.join(DIR, f), "utf8")).slug).toBe(f.replace(/\.md$/, ""));
  });

  it.each(readdirSync(DIR).filter((f) => f.endsWith(".md")))("%s: marcado, enlazado y dentro de las reglas", (f) => {
    const guide = parseGuideFile(readFileSync(path.join(DIR, f), "utf8"));
    const html = markdownToHtml(guide.bodyMarkdown);
    expect(guide.metaDescription?.length ?? 0).toBeLessThanOrEqual(160);
    expect(guide.excerpt).toBeTruthy();
    expect(countWords(html)).toBeGreaterThan(400);
    // Todo dato verificable queda marcado: son borradores, publicarlos exige resolverlos.
    expect(html).toMatch(/\[VERIFICAR/);
    // Al menos dos listados enlazados (§2.2).
    expect((html.match(LISTING) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).not.toMatch(/<h1|wa\.me|https?:\/\//);
    expect(guide.bodyMarkdown).not.toMatch(/\b(coche|carro|conducir|checar|enganche|traspaso)\b/i);
  });
});
