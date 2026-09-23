import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ListingCardData } from "@/lib/listings/query";
import { EmptyState } from "./empty-state";
import { ListingCard, listingAltText } from "./listing-card";
import { Price } from "./price";

const base: ListingCardData = {
  id: 42,
  slug: "honda-cg-150-titan-2022-asuncion",
  publicRef: "A3F9K2P7",
  title: "Honda CG 150 Titan 2022",
  status: "published",
  condition: "used",
  year: 2022,
  mileageKm: 12300,
  engineCc: 150,
  priceGs: 12_500_000,
  hasFinancingOnly: false,
  downPaymentGs: 2_000_000,
  installmentGs: 650_000,
  installmentCount: 24,
  contactWhatsapp: true,
  isFeatured: false,
  publishedAt: new Date("2026-09-01T00:00:00Z"),
  soldAt: null,
  brand: { name: "Honda", slug: "honda" },
  model: { name: "CG 150 Titan", slug: "cg-150-titan" },
  city: { name: "Asunción", slug: "asuncion" },
  dealer: { id: 3, name: "Comercio", slug: "comercio", isVerified: true },
  image: { url: "/media/a.webp", width: 800, height: 600, alt: null, isCatalogPhoto: true },
};
const render = (l: ListingCardData) => renderToStaticMarkup(createElement(ListingCard, { listing: l }));

describe("ListingCard", () => {
  it("precio, cuota informada, datos, sello y CTA por /ir/wa", () => {
    const html = render(base);
    expect(html).toContain('href="/aviso/honda-cg-150-titan-2022-asuncion-a3f9k2p7"');
    expect(html).toContain("Gs. 12.500.000");
    expect(html).toContain("Entrega Gs. 2.000.000 + 24 cuotas de Gs. 650.000");
    expect(html).toContain("informado por el comercio");
    expect(html).toContain("Asunción · 2022 · 12.300 km");
    expect(html).toContain("Comercio verificado");
    expect(html).toContain('href="/ir/wa/42"');
    expect(html).toContain("Escribir por WhatsApp");
    expect(html).not.toContain("wa.me");
    expect(html).toContain("Foto de catálogo");
    expect(html).toContain('alt="Honda CG 150 Titan 2022 usada en Asunción"');
    expect(html).toMatch(/width="800" height="600"/);
    expect(html.match(/<h2/g)).toHaveLength(1);
  });

  it("vendida: etiqueta y sin CTA de contacto", () => {
    const html = render({ ...base, status: "sold", soldAt: new Date() });
    expect(html).toContain("Vendida");
    expect(html).not.toContain("/ir/wa/");
  });

  it("sólo llamadas: sin WhatsApp", () => {
    const html = render({ ...base, contactWhatsapp: false });
    expect(html).not.toContain("/ir/wa/");
    expect(html).toContain("Ver teléfono");
  });

  it("financiación sola: 'Desde Gs. X/mes', sin precio de contado", () => {
    const html = render({ ...base, hasFinancingOnly: true, priceGs: null });
    expect(html).toContain("Desde Gs. 650.000/mes");
    expect(html).toContain("Precio de contado no informado");
    expect(html).not.toContain("Gs. 12.500.000");
  });

  it("sin foto no se inventa una; sin comercio verificado no hay sello", () => {
    const html = render({ ...base, image: null, dealer: null, year: null, mileageKm: null });
    expect(html).not.toContain("<img");
    expect(html).toContain("Sin foto");
    expect(html).not.toContain("Comercio verificado");
    expect(html).toContain("informado por el vendedor");
  });

  it("alt sin datos faltantes", () => {
    expect(listingAltText({ ...base, model: null, year: null, condition: "new" })).toBe("Honda nueva en Asunción");
  });
});

describe("Price y EmptyState", () => {
  it("sin precio ni plan: lo dice", () => {
    const html = renderToStaticMarkup(
      createElement(Price, { data: { priceGs: null, hasFinancingOnly: false, downPaymentGs: null, installmentGs: null, installmentCount: null } }),
    );
    expect(html).toContain("Precio no informado");
  });

  it("cuota sin entrega (stock importado): igual 'Desde Gs. X/mes', no 'Precio no informado'", () => {
    const html = renderToStaticMarkup(
      createElement(Price, { data: { priceGs: null, hasFinancingOnly: true, downPaymentGs: null, installmentGs: 650_000, installmentCount: 24 } }),
    );
    expect(html).toContain("Desde Gs. 650.000/mes");
    expect(html).not.toContain("Precio no informado");
  });

  it("estado vacío honesto con CTA por /ir/wa/general (ADR-21)", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { searchText: "Honda CG en Luque" }));
    expect(html).toContain("Todavía no tenemos motos que coincidan.");
    expect(html).toContain('href="/ir/wa/general?texto=Hola%2C+busco+una+moto%3A+Honda+CG+en+Luque"');
    expect(html).toContain("Escribinos qué moto buscás");
    expect(html).toContain('href="/publicar"');
  });
});
