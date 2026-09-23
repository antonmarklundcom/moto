import Link from "next/link";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { siteHealth } from "@/components/admin/ops/health";
import { groupThousands } from "@/lib/format";
import { formatDatePy } from "@/lib/import/messages";

// Salud del sitio (G-24): todo de consultas reales.
const section = adminSection("salud");

function ago(d: Date | null): string {
  if (!d) return "nunca";
  const h = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  return h < 1 ? "hace menos de 1 h" : h < 48 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} días (${formatDatePy(d)})`;
}

export default async function Page() {
  const user = await requirePageRole("/admin/salud", ...section.roles);
  const h = await siteHealth(user);
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <section aria-labelledby="jobs">
        <h2 id="jobs" className="text-lg font-bold">Tareas programadas</h2>
        <table className="mt-2 text-sm">
          <caption className="sr-only">Última ejecución de cada tarea</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="pr-4">Tarea</th>
              <th scope="col" className="pr-4">Última ejecución</th>
              <th scope="col" className="pr-4">Resultado</th>
              <th scope="col">Último éxito</th>
            </tr>
          </thead>
          <tbody>
            {h.jobs.map((j) => (
              <tr key={j.job} className={!j.last || j.last.status === "failed" ? "font-bold text-red-800" : ""}>
                <td className="pr-4 font-mono">{j.job}</td>
                <td className="pr-4">{ago(j.last?.startedAt ?? null)}</td>
                <td className="pr-4">{j.last ? j.last.status : "nunca corrió (el programador interno arranca 1 min después del servidor)"}</td>
                <td>{ago(j.lastSuccessAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="crm">
        <h2 id="crm" className="text-lg font-bold">Leads y CRM</h2>
        <p className={h.crm.exhausted ? "font-bold text-red-800" : ""}>
          Fallidos: {h.crm.failed} (agotados: {h.crm.exhausted}) · pendientes: {h.crm.pending} ·{" "}
          <Link href="/admin/leads" className="underline">bandeja</Link>
        </p>
      </section>
      <section aria-labelledby="moderacion">
        <h2 id="moderacion" className="text-lg font-bold">Moderación</h2>
        <p>
          {h.oldestPending ? (
            <>
              La más vieja en cola: <Link href={`/admin/moderacion?id=${h.oldestPending.id}`} className="underline">{h.oldestPending.title}</Link>, {ago(h.oldestPending.createdAt)}.
            </>
          ) : (
            "Cola vacía."
          )}
        </p>
      </section>
      <section aria-labelledby="inventario">
        <h2 id="inventario" className="text-lg font-bold">Inventario y disco</h2>
        <p>Publicaciones vivas: {groupThousands(h.live)}.</p>
        <p>
          {h.disk
            ? `Fotos en disco: ${(h.disk.bytes / 1_048_576).toFixed(1)} MB en ${groupThousands(h.disk.files)} archivos${h.disk.truncated ? " (conteo cortado)" : ""}.`
            : "Almacenamiento sin carpeta local configurada."}
        </p>
      </section>
    </main>
  );
}
