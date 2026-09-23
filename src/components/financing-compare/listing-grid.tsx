import { EmptyState } from "@/components/public/empty-state";
import { ListingCard } from "@/components/public/listing-card";
import { Pagination } from "@/components/public/pagination";
import type { ListingSearchResult } from "@/lib/listings/query";

/** Grilla de resultados + paginación + estado vacío honesto, para las páginas de B2. */
export function ListingGrid({
  search,
  prevHref,
  nextHref,
  page,
  searchText,
}: {
  search: ListingSearchResult;
  prevHref: string | null;
  nextHref: string | null;
  page: number;
  searchText: string;
}) {
  return (
    <section aria-labelledby="resultados" className="mt-6">
      <h2 id="resultados" className="sr-only">
        Resultados
      </h2>
      {search.items.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {search.items.map((l) => (
            <li key={l.id} className="flex">
              <ListingCard listing={l} headingLevel={3} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState searchText={searchText} headingLevel={3} />
      )}
      <Pagination page={page} pageCount={search.pageCount} prevHref={prevHref} nextHref={nextHref} />
    </section>
  );
}
