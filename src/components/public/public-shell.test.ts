// El shell público y la página stub de A2 (`/como-funciona`): un solo h1,
// salto al contenido, landmarks, JSON-LD válido, y canonical + robots
// correctos en los tres modos de SITE_NOINDEX (ADR-26). Archivo .ts con
// createElement porque vitest sólo toma *.test.ts.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import ComoFuncionaPage, { generateMetadata } from "@/app/(public)/como-funciona/page";
import { PublicShell } from "./public-shell";

function renderStub(): string {
  return renderToStaticMarkup(createElement(PublicShell, null, createElement(ComoFuncionaPage)));
}

describe("shell público + /como-funciona", () => {
  const before = { noindex: process.env.SITE_NOINDEX, site: process.env.SITE_URL };
  afterEach(() => {
    for (const [key, value] of [["SITE_NOINDEX", before.noindex], ["SITE_URL", before.site]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("un solo h1, landmarks y salto al contenido", () => {
    const html = renderStub();
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<a href="#contenido"[^>]*>Saltar al contenido<\/a>/);
    expect(html).toContain('<main id="contenido"');
    expect(html).toContain("<header");
    expect(html).toContain("<footer");
    expect(html).toMatch(/<nav aria-label="Principal"/);
    expect(html).toMatch(/<nav aria-label="Migas de pan"/);
    expect(html).toContain('aria-current="page"');
  });

  it("JSON-LD: Organization, WebSite y BreadcrumbList, sin Review/AggregateRating", () => {
    process.env.SITE_URL = "https://moto.com.py";
    const html = renderStub();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const types = blocks.flat().map((b) => b["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "BreadcrumbList"]));
    expect(JSON.stringify(blocks)).not.toMatch(/review|aggregateRating/i);
    const crumbs = blocks.flat().find((b) => b["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((i: { item: string }) => i.item)).toEqual([
      "https://moto.com.py",
      "https://moto.com.py/como-funciona",
    ]);
  });

  it("WhatsApp nunca directo a wa.me (ADR-07)", () => {
    expect(renderStub()).not.toContain("wa.me");
  });

  it.each([
    ["true", false],
    ["content", true],
    ["false", true],
    [undefined, false],
    ["cualquier-cosa", false],
  ])("SITE_NOINDEX=%s → index %s, canonical /como-funciona", (mode, index) => {
    if (mode === undefined) delete process.env.SITE_NOINDEX;
    else process.env.SITE_NOINDEX = mode;
    const meta = generateMetadata();
    expect(meta.robots).toEqual({ index, follow: true });
    expect(meta.alternates?.canonical).toBe("/como-funciona");
    expect(typeof meta.title).toBe("string");
    expect(String(meta.description).length).toBeGreaterThanOrEqual(140);
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
  });
});

describe("layout público: robots por defecto", () => {
  it("una página que no declara robots queda noindex, follow (falla cerrado)", async () => {
    const { metadata } = await import("@/app/(public)/layout");
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
