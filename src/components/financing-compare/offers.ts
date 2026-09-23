// Filas del bloque de comparación (ADR-20, G-9): una por comercio que ofrece
// el modelo, sacadas de publicaciones reales. Puro: la consulta está en data.ts.

export type OfferListing = {
  listingId: number;
  slug: string;
  publicRef: string;
  title: string;
  condition: "new" | "used";
  year: number | null;
  priceGs: number | null;
  hasFinancingOnly: boolean;
  downPaymentGs: number | null;
  installmentGs: number | null;
  installmentCount: number | null;
  dealer: { id: number; name: string; slug: string; isVerified: boolean; active: boolean };
};

/**
 * Una fila por comercio. Si un comercio tiene varias unidades del modelo, se
 * queda la de cuota informada más baja (y si ninguna informa cuota, la de
 * menor contado). Orden: cuota informada ascendente; sin cuota al final.
 * Nada se calcula: los montos son los de la publicación elegida.
 */
export function offerRows(listings: readonly OfferListing[]): OfferListing[] {
  const best = new Map<number, OfferListing>();
  const key = (l: OfferListing): [number, number] => [l.installmentGs ?? Number.MAX_SAFE_INTEGER, l.priceGs ?? Number.MAX_SAFE_INTEGER];
  const better = (a: OfferListing, b: OfferListing) => {
    const [ai, ap] = key(a);
    const [bi, bp] = key(b);
    return ai !== bi ? ai < bi : ap !== bp ? ap < bp : a.listingId < b.listingId;
  };
  for (const l of listings) {
    const current = best.get(l.dealer.id);
    if (!current || better(l, current)) best.set(l.dealer.id, l);
  }
  return [...best.values()].sort((a, b) => {
    const [ai, ap] = key(a);
    const [bi, bp] = key(b);
    return ai - bi || ap - bp || a.dealer.name.localeCompare(b.dealer.name);
  });
}
