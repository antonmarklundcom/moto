import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinancingCompare } from "./financing-compare";
import { type OfferListing, offerRows } from "./offers";

let n = 0;
function offer(dealerId: number, extra: Partial<OfferListing> = {}): OfferListing {
  n += 1;
  return {
    listingId: n,
    slug: `honda-wave-${n}`,
    publicRef: "ABCDEFGH".slice(0, 7) + "JKMNPQRSTUVWXYZ"[n % 15],
    title: `Honda Wave ${n}`,
    condition: "new",
    year: null,
    priceGs: 9_500_000,
    hasFinancingOnly: false,
    downPaymentGs: 1_000_000,
    installmentGs: 480_000,
    installmentCount: 24,
    dealer: { id: dealerId, name: `Comercio ${dealerId}`, slug: `comercio-${dealerId}`, isVerified: false, active: true },
    ...extra,
  };
}

const html = (offers: OfferListing[]) => renderToStaticMarkup(createElement(FinancingCompare, { offers, modelName: "Honda Wave 110S" }));

/** Todos los montos "Gs. X" del HTML. */
const amounts = (s: string) => [...s.matchAll(/Gs\. ([\d.]+)/g)].map((m) => Number(m[1].replace(/\./g, "")));

describe("offerRows", () => {
  it("una fila por comercio: la de menor cuota informada; sin cuota, la de menor contado; orden por cuota", () => {
    const rows = offerRows([
      offer(1, { installmentGs: 500_000 }),
      offer(1, { installmentGs: 450_000 }),
      offer(2, { installmentGs: null, installmentCount: null, downPaymentGs: null, priceGs: 9_000_000 }),
      offer(2, { installmentGs: null, installmentCount: null, downPaymentGs: null, priceGs: 8_800_000 }),
      offer(3, { installmentGs: 420_000 }),
    ]);
    expect(rows.map((r) => [r.dealer.id, r.installmentGs ?? r.priceGs])).toEqual([
      [3, 420_000],
      [1, 450_000],
      [2, 8_800_000],
    ]);
  });
});

describe("FinancingCompare (ADR-20)", () => {
  it("≥ 2 comercios: una fila por comercio, cada una «informado por el comercio»", () => {
    const out = html(offerRows([offer(1), offer(2, { installmentGs: 450_000 })]));
    expect(out.match(/<tr class="border-b border-neutral-200/g)).toHaveLength(2);
    expect(out.match(/informado por el comercio/g)).toHaveLength(2);
    expect(out).toContain("Comparar entre comercios");
  });

  it("1 comercio: oferta única, sin filas de relleno", () => {
    const out = html([offer(7)]);
    expect(out).toContain("Oferta de un comercio");
    expect(out).not.toContain("<table");
  });

  it("0 comercios: no se muestra nada", () => {
    expect(html([])).toBe("");
  });

  it("ninguna cuota calculada: todo monto del HTML es un dato de entrada", () => {
    const offers = [
      offer(1, { priceGs: 9_500_000, downPaymentGs: 1_000_000, installmentGs: 480_000, installmentCount: 24 }),
      offer(2, { priceGs: null, hasFinancingOnly: true, downPaymentGs: 1_500_000, installmentGs: 450_000, installmentCount: 18 }),
      offer(3, { priceGs: 8_900_000, downPaymentGs: null, installmentGs: null, installmentCount: null }),
    ];
    const inputs = new Set(offers.flatMap((o) => [o.priceGs, o.downPaymentGs, o.installmentGs]).filter((v): v is number => v !== null));
    const shown = amounts(html(offerRows(offers)));
    expect(shown.length).toBeGreaterThan(0);
    for (const a of shown) expect(inputs.has(a), `monto ${a} no viene de una publicación`).toBe(true);
    expect(amounts(html([offers[1]])).every((a) => inputs.has(a))).toBe(true);
  });
});
