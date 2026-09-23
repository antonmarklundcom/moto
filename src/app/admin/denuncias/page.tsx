import Link from "next/link";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { ReportActions } from "@/components/admin/moderation/report-actions";
import { reportDetail, reportQueue, type ReportStatus } from "@/components/admin/moderation/reports-admin";
import { REPORT_REASONS } from "@/components/listing/rules";
import { formatDatePy } from "@/lib/import/messages";
import { paths } from "@/lib/seo/routes";

// Denuncias (ADMIN_SPEC.md §10). Sin "bloquear teléfono" (Backlog: tabla + abogado, T&S §9).
const section = adminSection("denuncias");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const STATUSES: Array<{ value: ReportStatus; label: string }> = [
  { value: "pending", label: "Pendientes" },
  { value: "actioned", label: "Con acción" },
  { value: "dismissed", label: "Descartadas" },
];
const REASON = Object.fromEntries(REPORT_REASONS.map((r) => [r.code, r.label]));

export default async function Page({ searchParams }: { searchParams: Promise<{ estado?: string; id?: string }> }) {
  await requirePageRole("/admin/denuncias", ...section.roles);
  const q = await searchParams;
  const status = (STATUSES.find((s) => s.value === q.estado)?.value ?? "pending") as ReportStatus;
  const list = await reportQueue(status);
  const selected = q.id ? await reportDetail(Number(q.id)) : null;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <nav aria-label="Estado" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/denuncias?estado=${s.value}`}
            aria-current={s.value === status ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded border px-3 ${s.value === status ? "border-blue-800 bg-blue-50 font-bold" : "border-gray-400"} ${focus}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {selected ? (
        <section aria-labelledby="detalle" className="rounded border border-gray-400 p-3">
          <h2 id="detalle" className="text-lg font-bold">
            Denuncia #{selected.report.id}: {REASON[selected.report.reasonCode] ?? selected.report.reasonCode}
          </h2>
          <p>
            Publicación: <strong>{selected.report.listingTitle}</strong> ({selected.report.listingRef},{" "}
            {selected.report.listingDeletedAt ? "dada de baja" : selected.report.listingStatus})
            {!selected.report.listingDeletedAt && ["published", "sold", "expired"].includes(selected.report.listingStatus) ? (
              <>
                {" · "}
                <Link href={paths.listing({ slug: selected.report.listingSlug, publicRef: selected.report.listingRef })} className="underline">
                  ver ficha
                </Link>
              </>
            ) : null}
          </p>
          <p className="mt-1 whitespace-pre-line">{selected.report.detail ?? "Sin detalle."}</p>
          <p className="text-sm text-gray-700">
            {formatDatePy(selected.report.createdAt)} · {selected.report.hasPhone ? "dejó teléfono" : "sin teléfono"}
          </p>
          {selected.others.length ? (
            <>
              <h3 className="mt-3 font-bold">Otras denuncias de esta publicación ({selected.others.length})</h3>
              <ul className="ml-4 list-disc text-sm">
                {selected.others.map((o) => (
                  <li key={o.id}>
                    {formatDatePy(o.createdAt)} · {REASON[o.reasonCode] ?? o.reasonCode} · {o.status}
                    {o.detail ? ` · ${o.detail.slice(0, 120)}` : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {selected.report.status === "pending" || selected.report.status === "reviewed" ? (
            <div className="mt-3">
              <ReportActions reportId={selected.report.id} listingLive={selected.report.listingStatus === "published" && !selected.report.listingDeletedAt} />
            </div>
          ) : (
            <p className="mt-3">Resuelta{selected.report.resolvedAt ? ` el ${formatDatePy(selected.report.resolvedAt)}` : ""}: {selected.report.resolutionNote}</p>
          )}
        </section>
      ) : null}

      {list.length === 0 ? (
        <p>No hay denuncias en este estado.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Denuncias</caption>
          <thead>
            <tr className="border-b border-gray-400 text-left">
              <th scope="col" className="p-2">Fecha</th>
              <th scope="col" className="p-2">Motivo</th>
              <th scope="col" className="p-2">Publicación</th>
              <th scope="col" className="p-2">Estafa/robada (IP distintas)</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className={`border-b border-gray-200 ${r.severe >= 3 ? "bg-red-50" : ""}`}>
                <td className="p-2">{formatDatePy(r.createdAt)}</td>
                <td className="p-2">
                  <Link href={`/admin/denuncias?estado=${status}&id=${r.id}`} className={`underline ${focus}`}>
                    {REASON[r.reasonCode] ?? r.reasonCode}
                  </Link>
                </td>
                <td className="p-2">
                  {r.listingTitle} ({r.listingRef})
                </td>
                <td className="p-2">{r.severe || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
