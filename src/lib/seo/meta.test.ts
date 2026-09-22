import { afterEach, describe, expect, it } from "vitest";
import { parseSearchParams } from "@/lib/listings/filters";
import { contentPageMetadata, pageMetadata, resolveListingPageSeo, robots, withPageSuffix } from "./meta";

const base = "/motos/honda";
const seo = (query: Record<string, string | undefined>, baseIndexable: boolean, pageCount = 5) =>
  resolveListingPageSeo({ basePath: base, parsed: parseSearchParams(query), baseIndexable, pageCount });

describe("resolveListingPageSeo (SEO_ARCHITECTURE.md §3)", () => {
  it("URL limpia: canonical a sí misma, robots según el umbral", () => {
    expect(seo({}, true)).toMatchObject({ status: "ok", canonical: base, robots: { index: true, follow: true } });
    expect(seo({}, false)).toMatchObject({ status: "ok", canonical: base, robots: { index: false, follow: true } });
  });

  it("cualquier filtro u orden → noindex, follow + canonical a la URL limpia", () => {
    for (const query of [{ precio_max: "15000000" }, { orden: "precio_asc" }, { q: "cg" }, { precio_max: "x" }]) {
      expect(seo(query, true)).toMatchObject({ canonical: base, robots: { index: false, follow: true } });
    }
    // Filtro + página: sigue noindex y canonical limpio.
    expect(seo({ precio_max: "15000000", page: "2" }, true)).toMatchObject({ canonical: base, robots: { index: false } });
  });

  it("?page=N es indexable y auto-canonical (§3.2)", () => {
    expect(seo({ page: "2" }, true)).toMatchObject({ canonical: `${base}?page=2`, robots: { index: true }, page: 2 });
    expect(seo({ page: "2" }, false)).toMatchObject({ canonical: `${base}?page=2`, robots: { index: false } });
    expect(seo({ page: "1" }, true)).toMatchObject({ canonical: base, page: 1 });
  });

  it("prev/next conservan los filtros", () => {
    const r = seo({ page: "2", orden: "km_asc" }, true);
    expect(r).toMatchObject({ prevHref: `${base}?orden=km_asc`, nextHref: `${base}?orden=km_asc&page=3` });
    expect(seo({}, true)).toMatchObject({ prevHref: null, nextHref: `${base}?page=2` });
    expect(seo({ page: "5" }, true)).toMatchObject({ nextHref: null });
  });

  it("página inválida, > 50 o sin resultados → 404; la página 1 vacía existe", () => {
    expect(seo({ page: "abc" }, true)).toEqual({ status: "not_found" });
    expect(seo({ page: "51" }, true, 60)).toEqual({ status: "not_found" });
    expect(seo({ page: "6" }, true, 5)).toEqual({ status: "not_found" });
    expect(seo({}, true, 0)).toMatchObject({ status: "ok", page: 1, nextHref: null });
    expect(seo({ page: "2" }, true, 0)).toEqual({ status: "not_found" });
  });
});

describe("pageMetadata / contentPageMetadata", () => {
  const before = process.env.SITE_NOINDEX;
  afterEach(() => {
    if (before === undefined) delete process.env.SITE_NOINDEX;
    else process.env.SITE_NOINDEX = before;
  });

  it("title, description, canonical, robots, og y twitter completos", () => {
    const m = pageMetadata({
      title: "Motos Honda en Paraguay — 12 publicadas",
      description: "d",
      canonical: "/motos/honda",
      robots: robots(true),
      image: { url: "https://moto.com.py/media/x.webp", width: 800, height: 600, alt: "Honda CG 150" },
    });
    expect(m.title).toBe("Motos Honda en Paraguay — 12 publicadas");
    expect(m.alternates?.canonical).toBe("/motos/honda");
    expect(m.robots).toEqual({ index: true, follow: true });
    expect(m.openGraph).toMatchObject({ title: "Motos Honda en Paraguay — 12 publicadas | moto.com.py", locale: "es_PY", url: "/motos/honda" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("sin imagen real no se inventa una", () => {
    const m = pageMetadata({ title: "t", description: "d", canonical: "/", robots: robots(false) });
    expect(m.openGraph).not.toHaveProperty("images");
    expect(m.twitter).toMatchObject({ card: "summary" });
  });

  it("contenido sigue SITE_NOINDEX: true → noindex, content/false → index", () => {
    const meta = () => contentPageMetadata({ title: "t", description: "d", canonical: "/como-funciona" });
    process.env.SITE_NOINDEX = "true";
    expect(meta().robots).toEqual({ index: false, follow: true });
    process.env.SITE_NOINDEX = "content";
    expect(meta().robots).toEqual({ index: true, follow: true });
    process.env.SITE_NOINDEX = "false";
    expect(meta().robots).toEqual({ index: true, follow: true });
    delete process.env.SITE_NOINDEX;
    expect(meta().robots).toEqual({ index: false, follow: true });
  });

  it("withPageSuffix", () => {
    expect(withPageSuffix("Motos Honda", 1)).toBe("Motos Honda");
    expect(withPageSuffix("Motos Honda", 2)).toBe("Motos Honda — Página 2");
  });
});
