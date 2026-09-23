import { describe, expect, it } from "vitest";
import { hasPendingVerification, safeHref, sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("deja las etiquetas permitidas, sin atributos", () => {
    expect(sanitizeHtml('<p class="x" onclick="alert(1)">Hola <strong>moto</strong></p><h2 id="a">Título</h2>')).toBe("<p>Hola <strong>moto</strong></p><h2>Título</h2>");
    expect(sanitizeHtml("<b>a</b><i>b</i><br/>")).toBe("<strong>a</strong><em>b</em><br>");
  });

  it.each([
    ['<script>alert(1)</script><p>ok</p>', "<p>ok</p>"],
    ['<img src=x onerror=alert(1)>texto', "texto"],
    ['<svg><script>alert(1)</script></svg>x', "x"],
    ['<iframe src="https://evil"></iframe>y', "y"],
    ['<a href="javascript:alert(1)">link</a>', "link"],
    ['<a href="java&#115;cript:alert(1)">link</a>', "link"],
    ['<a href=" &#x09;javascript:alert(1)">link</a>', "link"],
    ['<a href="//evil.com/x">link</a>', "link"],
    ['<a href="data:x">link</a>', "link"],
    // Un "<" dentro del atributo corta la etiqueta: todo queda como texto escapado.
    ['<a href="data:text/html,<b>x</b>">link</a>', "&lt;a href=&quot;data:text/html,<strong>x</strong>&quot;&gt;link"],
    ["<p>1 < 2 & 3 > 2</p>", "<p>1 &lt; 2 &amp; 3 &gt; 2</p>"],
    ["&lt;script&gt;alert(1)&lt;/script&gt;", "&lt;script&gt;alert(1)&lt;/script&gt;"],
    ['<p title="a>b">x</p>', "<p>b&quot;&gt;x</p>"],
    ["<!-- <script>alert(1)</script> -->z", "z"],
    ["<p>sin cerrar", "<p>sin cerrar</p>"],
    ["</p>suelto", "suelto"],
    ["<ul><li>a<li>b</ul>", "<ul><li>a<li>b</li></li></ul>"],
  ])("neutraliza %s", (input, expected) => {
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it("enlaces internos y externos válidos", () => {
    expect(sanitizeHtml('<a href="/motos/usadas" target="_blank">usadas</a>')).toBe('<a href="/motos/usadas">usadas</a>');
    expect(sanitizeHtml("<a href='https://www.example.com/?a=1&amp;b=2'>x</a>")).toBe('<a href="https://www.example.com/?a=1&amp;b=2" rel="nofollow noopener">x</a>');
  });

  it("nunca deja pasar un '<' que abra una etiqueta no permitida", () => {
    const nasty = ['<scr<script>ipt>alert(1)</script>', '<<script>>', '<a href="/x"<img src=x>', '<p/onmouseover=alert(1)>x'];
    for (const n of nasty) expect(sanitizeHtml(n)).not.toMatch(/<(?!\/?(p|h2|h3|h4|ul|ol|li|strong|em|a|br|blockquote)\b)[a-z]/i);
  });
});

describe("safeHref", () => {
  it("acepta rutas, anclas y http(s)", () => {
    expect(safeHref("/guias/x")).toBe("/guias/x");
    expect(safeHref("#pasos")).toBe("#pasos");
    expect(safeHref("https://a.com")).toBe("https://a.com");
    expect(safeHref("mailto:a@b.c")).toBeNull();
    expect(safeHref("/\\evil.com")).toBeNull();
  });
});

describe("hasPendingVerification", () => {
  it("detecta [VERIFICAR] en cualquier parte", () => {
    expect(hasPendingVerification("ok", "<p>x [VERIFICAR: arancel — fuente: Registro]</p>")).toBe(true);
    expect(hasPendingVerification("[ verificar")).toBe(true);
    expect(hasPendingVerification("todo verificado", null)).toBe(false);
  });
});
