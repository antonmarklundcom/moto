import type { AdminListingFilters } from "./listings-admin";

/** Query string del listado del admin → filtros. Puro. */
export function filtersFromQuery(q: URLSearchParams | Record<string, string | undefined>): AdminListingFilters {
  const get = (k: string) => (q instanceof URLSearchParams ? (q.get(k) ?? undefined) : q[k]);
  const num = (k: string) => {
    const n = Number(get(k));
    return Number.isSafeInteger(n) && n > 0 ? n : undefined;
  };
  return {
    status: get("estado") || undefined,
    dealerId: num("comercio"),
    brandId: num("marca"),
    cityId: num("ciudad"),
    from: get("desde") || undefined,
    to: get("hasta") || undefined,
    q: get("q")?.slice(0, 100) || undefined,
  };
}
