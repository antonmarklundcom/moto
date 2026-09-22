import Link from "next/link";
import { secondaryButton } from "./styles";

/**
 * Paginación real (sin scroll infinito, §3.2) con `rel=prev/next`. React 19
 * sube los `<link>` al `<head>`. Los href vienen de `resolveListingPageSeo`,
 * que conserva los filtros.
 */
export function Pagination({
  page,
  pageCount,
  prevHref,
  nextHref,
}: {
  page: number;
  pageCount: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  if (pageCount <= 1) return null;
  return (
    <>
      {prevHref ? <link rel="prev" href={prevHref} /> : null}
      {nextHref ? <link rel="next" href={nextHref} /> : null}
      <nav aria-label="Paginación" className="mt-6 flex items-center justify-between gap-2">
        {prevHref ? (
          <Link href={prevHref} rel="prev" className={secondaryButton}>
            ← Anterior
          </Link>
        ) : (
          <span />
        )}
        <p className="text-sm text-neutral-800">
          Página {page} de {pageCount}
        </p>
        {nextHref ? (
          <Link href={nextHref} rel="next" className={secondaryButton}>
            Siguiente →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
