import Link from "next/link";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { listDealersAdmin } from "@/components/admin/crud/dealers-admin";
import { formatDatePy } from "@/lib/import/messages";

// Comercios (ADMIN_SPEC.md §5). Admin edita; moderador ve.
const section = adminSection("comercios");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const STATUS: Record<string, string> = { prospect: "Prospecto", active: "Activo", paused: "Pausado", archived: "Archivado" };

export default async function Page() {
  const user = await requirePageRole("/admin/comercios", "admin", "moderator");
  const list = await listDealersAdmin(user);
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{section.label}</h1>
        {user.role === "admin" ? (
          <Link href="/admin/comercios/nuevo" className={`inline-flex min-h-11 items-center rounded bg-blue-800 px-4 font-medium text-white ${focus}`}>
            Nuevo comercio
          </Link>
        ) : null}
      </div>
      {list.length === 0 ? (
        <p>Todavía no hay comercios.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Comercios</caption>
          <thead>
            <tr className="border-b border-gray-400 text-left">
              <th scope="col" className="p-2">Comercio</th>
              <th scope="col" className="p-2">Estado</th>
              <th scope="col" className="p-2">Publicadas</th>
              <th scope="col" className="p-2">Autorización</th>
              <th scope="col" className="p-2">Gratis hasta</th>
              <th scope="col" className="p-2">Números</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="border-b border-gray-200">
                <td className="p-2">
                  <Link href={`/admin/comercios/${d.id}`} className={`underline ${focus}`}>
                    {d.name}
                  </Link>
                  <span className="block text-xs text-gray-700">
                    {d.city}
                    {d.isVerified ? " · verificado" : ""}
                    {d.autoApprove ? " · auto-aprobación" : ""}
                  </span>
                </td>
                <td className="p-2">{STATUS[d.status] ?? d.status}</td>
                <td className="p-2">{d.published}</td>
                <td className={`p-2 ${d.authorizationDate ? "" : "font-bold text-red-800"}`}>{d.authorizationDate ? formatDatePy(new Date(`${d.authorizationDate}T12:00:00Z`)) : "Falta"}</td>
                <td className={`p-2 ${d.alert ? "font-bold text-amber-800" : ""}`}>
                  {d.freeUntil ? formatDatePy(new Date(`${d.freeUntil}T12:00:00Z`)) : "—"}
                  {d.alert === "pronto" ? " (vence en ≤ 60 días)" : d.alert === "vencido" ? " (vencido)" : ""}
                </td>
                <td className="p-2">
                  <Link href={`/admin/comercios/${d.id}/reporte`} className={`underline ${focus}`}>
                    Reporte y stock
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
