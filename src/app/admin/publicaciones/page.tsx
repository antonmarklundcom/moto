import { asc, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { brands, cities, dealers } from "@/db/schema";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { filtersFromQuery } from "@/components/admin/crud/listing-filters";
import { PAGE_SIZE, searchAdminListings } from "@/components/admin/crud/listings-admin";
import { formatDatePy } from "@/lib/import/messages";
import { formatGuaranies } from "@/lib/format";
import { bulkAction } from "./actions";

// Publicaciones (ADMIN_SPEC.md §4). Destacadas: B9 (monetización).
const section = adminSection("publicaciones");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const input = `min-h-11 rounded border border-gray-500 px-2 ${focus}`;
const STATUS: Record<string, string> = { draft: "Borrador", pending_review: "En moderación", published: "Publicada", paused: "Pausada", sold: "Vendida", expired: "Vencida", rejected: "Rechazada" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageRole("/admin/publicaciones", "admin", "moderator");
  const q = await searchParams;
  const filters = filtersFromQuery(q);
  const page = Math.max(1, Number(q.pagina) || 1);
  const [{ total, rows }, brandOpts, cityOpts, dealerOpts] = await Promise.all([
    searchAdminListings(user, filters, page),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(asc(cities.sortOrder)),
    db.select({ id: dealers.id, name: dealers.name }).from(dealers).where(isNull(dealers.deletedAt)).orderBy(asc(dealers.name)),
  ]);
  const query = new URLSearchParams(Object.entries(q).filter(([k, v]) => v && !["pagina", "hechas", "omitidas"].includes(k)) as Array<[string, string]>).toString();
  const back = `/admin/publicaciones${query ? `?${query}` : ""}`;
  const pages = Math.ceil(total / PAGE_SIZE);
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <form method="get" className="flex flex-wrap items-end gap-2 rounded border border-gray-400 p-3 text-sm">
        <label className="flex flex-col gap-1">
          Buscar (ref., título, teléfono)
          <input name="q" defaultValue={q.q ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          Estado
          <select name="estado" defaultValue={q.estado ?? ""} className={input}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["comercio", "Comercio", dealerOpts],
            ["marca", "Marca", brandOpts],
            ["ciudad", "Ciudad", cityOpts],
          ] as const
        ).map(([name, label, opts]) => (
          <label key={name} className="flex flex-col gap-1">
            {label}
            <select name={name} defaultValue={q[name] ?? ""} className={input}>
              <option value="">Todos</option>
              {opts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex flex-col gap-1">
          Desde
          <input type="date" name="desde" defaultValue={q.desde ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          Hasta
          <input type="date" name="hasta" defaultValue={q.hasta ?? ""} className={input} />
        </label>
        <button type="submit" className={`min-h-11 rounded bg-blue-800 px-3 text-white ${focus}`}>
          Filtrar
        </button>
        <a href={`/admin/publicaciones/exportar${query ? `?${query}` : ""}`} className={`inline-flex min-h-11 items-center rounded border border-gray-500 px-3 ${focus}`}>
          Exportar CSV
        </a>
      </form>
      {q.hechas ? (
        <p role="status" className="text-green-900">
          Hechas: {q.hechas}. Omitidas (no aplicaba al estado): {q.omitidas ?? 0}.
        </p>
      ) : null}
      <p>{total} publicaciones.</p>
      <form action={bulkAction} className="flex flex-col gap-2">
        <input type="hidden" name="volver" value={back} />
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Con las marcadas
            <select name="accion" className={input}>
              <option value="pause">Pausar</option>
              <option value="expire">Vencer</option>
              <option value="extend">Extender vencimiento</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Días (extender)
            <input name="dias" defaultValue="30" inputMode="numeric" className={`${input} w-20`} />
          </label>
          <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
            Aplicar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Publicaciones</caption>
            <thead>
              <tr className="border-b border-gray-400 text-left">
                <th scope="col" className="p-2">
                  <span className="sr-only">Marcar</span>
                </th>
                <th scope="col" className="p-2">Publicación</th>
                <th scope="col" className="p-2">Estado</th>
                <th scope="col" className="p-2">Precio / cuota</th>
                <th scope="col" className="p-2">Comercio</th>
                <th scope="col" className="p-2">Vence</th>
                <th scope="col" className="p-2">Vistas / WA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-200">
                  <td className="p-2">
                    <input type="checkbox" name="ids" value={r.id} aria-label={`Marcar ${r.title}`} className={`h-5 w-5 ${focus}`} />
                  </td>
                  <td className="p-2">
                    <Link href={`/admin/publicaciones/${r.id}`} className={`underline ${focus}`}>
                      {r.title}
                    </Link>
                    <span className="block text-xs text-gray-700">
                      {r.publicRef}
                      {r.externalRef ? ` · ${r.externalRef}` : ""} · {r.brandName} · {r.cityName}
                    </span>
                  </td>
                  <td className="p-2">{STATUS[r.status] ?? r.status}</td>
                  <td className="p-2">{formatGuaranies(r.priceGs) ?? (r.installmentGs ? `${formatGuaranies(r.installmentGs)}/mes` : "—")}</td>
                  <td className="p-2">{r.dealerName ?? "Particular"}</td>
                  <td className="p-2">{r.expiresAt ? formatDatePy(r.expiresAt) : "—"}</td>
                  <td className="p-2">
                    {r.viewCount} / {r.whatsappClickCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
      {pages > 1 ? (
        <nav aria-label="Páginas" className="flex gap-2">
          {page > 1 ? <Link href={`/admin/publicaciones?${query}${query ? "&" : ""}pagina=${page - 1}`} className={`underline ${focus}`}>← Anterior</Link> : null}
          <span>
            Página {page} de {pages}
          </span>
          {page < pages ? <Link href={`/admin/publicaciones?${query}${query ? "&" : ""}pagina=${page + 1}`} className={`underline ${focus}`}>Siguiente →</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
