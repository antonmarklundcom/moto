import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { activitySearch } from "@/components/admin/ops/activity";
import { formatDatePy } from "@/lib/import/messages";

// Registro de actividad (ADMIN_SPEC.md §12).
const section = adminSection("actividad");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const input = `min-h-11 rounded border border-gray-500 px-2 ${focus}`;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageRole("/admin/actividad", ...section.roles);
  const q = await searchParams;
  const rows = await activitySearch(user, {
    entity: q.entidad || undefined,
    entityId: Number(q.id) || undefined,
    user: q.usuario || undefined,
    action: q.accion || undefined,
    from: q.desde || undefined,
    to: q.hasta || undefined,
  }, Number(q.pagina) || 1);
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        {[
          ["entidad", "Entidad (listing, dealer, lead…)"],
          ["id", "Id"],
          ["usuario", "Usuario (email)"],
          ["accion", "Acción (price_changed…)"],
        ].map(([name, label]) => (
          <label key={name} className="flex flex-col gap-1">
            {label}
            <input name={name} defaultValue={q[name] ?? ""} className={input} />
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
        <button type="submit" className={`min-h-11 rounded bg-blue-800 px-3 text-white ${focus}`}>Filtrar</button>
      </form>
      <table className="w-full text-sm">
        <caption className="sr-only">Actividad</caption>
        <thead>
          <tr className="border-b border-gray-400 text-left">
            <th scope="col" className="p-1">Fecha</th>
            <th scope="col" className="p-1">Quién</th>
            <th scope="col" className="p-1">Qué</th>
            <th scope="col" className="p-1">Cambios</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-200 align-top">
              <td className="p-1 whitespace-nowrap">{formatDatePy(r.at)} {new Date(r.at.getTime() - 3 * 3_600_000).toISOString().slice(11, 16)}</td>
              <td className="p-1">{r.userEmail ?? "sistema"}</td>
              <td className="p-1">
                {r.action} · {r.entityType} #{r.entityId}
              </td>
              <td className="p-1">
                <code className="break-all text-xs">{r.diff ? JSON.stringify(r.diff).slice(0, 600) : ""}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p>Sin resultados.</p> : null}
    </main>
  );
}
