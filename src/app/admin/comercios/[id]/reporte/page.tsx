import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/session";
import { inScope } from "@/lib/auth/roles";
import { dealerReport, getDealer, publishedStock } from "@/lib/import/dealer-ops";
import { formatDatePy, isoDatePy, parseReportRange, priceText, reconfirmMessage, reportMessage } from "@/lib/import/messages";
import { groupThousands } from "@/lib/format";
import { reconfirmAction } from "./actions";
import { CopyButton } from "./copy-button";

// G-14 (reporte para el comercio) y G-6 (reconfirmar stock). Números reales
// (ANALYTICS_AND_KPIS.md §7): lo que da la consulta, sin redondear.
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const DAY_MS = 86_400_000;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; reconfirmadas?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const dealerId = Number(id);
  const path = `/admin/comercios/${id}/reporte`;
  const user = await requirePageRole(path, "admin", "moderator", "dealer");
  if (!Number.isSafeInteger(dealerId) || dealerId <= 0) notFound();
  // Un comercio ve sólo su propio reporte.
  if (!inScope(user, { dealerId })) notFound();
  const dealer = await getDealer(dealerId);
  if (!dealer || dealer.deletedAt) notFound();

  const query = await searchParams;
  const now = new Date();
  const range = parseReportRange(query.desde, query.hasta, now);
  const report = { dealerName: dealer.name, ...(await dealerReport(dealerId, range)) };
  const reportText = reportMessage(report);
  const canReconfirm = user.role === "admin" || user.role === "moderator";
  const stock = canReconfirm ? await publishedStock(dealerId) : [];
  const done = query.reconfirmadas !== undefined ? Number(query.reconfirmadas) : null;
  const n = (v: number) => groupThousands(v);

  return (
    <main className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">{dealer.name}: reporte y stock</h1>

      <section aria-labelledby="reporte" className="flex flex-col gap-3">
        <h2 id="reporte" className="text-xl font-bold">
          Reporte
        </h2>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="desde" className="font-medium">
              Desde
            </label>
            <input id="desde" name="desde" type="date" defaultValue={isoDatePy(range.from)} className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hasta" className="font-medium">
              Hasta
            </label>
            <input
              id="hasta"
              name="hasta"
              type="date"
              defaultValue={isoDatePy(new Date(range.to.getTime() - 1))}
              className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}
            />
          </div>
          <button type="submit" className={`min-h-11 rounded border border-gray-500 px-4 ${focus}`}>
            Ver
          </button>
        </form>
        <p className="text-sm">
          {range.custom ? "Rango elegido" : "Últimos 30 días"}: del {formatDatePy(range.from)} al{" "}
          {formatDatePy(new Date(range.to.getTime() - 1))}. Visitas y clics sin robots; pedidos de financiación sin spam; sólo
          lo que vino de sus motos.
        </p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <dt>Motos publicadas hoy</dt>
          <dd>{n(report.publishedNow)}</dd>
          <dt>Visitas a sus motos</dt>
          <dd>{n(report.views)}</dd>
          <dt>Consultas por WhatsApp</dt>
          <dd>{n(report.whatsappClicks)}</dd>
          <dt>Pedidos de financiación</dt>
          <dd>{n(report.financingLeads)}</dd>
        </dl>
        <label htmlFor="texto-reporte" className="font-medium">
          Texto para WhatsApp
        </label>
        <textarea id="texto-reporte" readOnly rows={9} value={reportText} className={`rounded border border-gray-500 p-2 font-mono text-sm ${focus}`} />
        <CopyButton targetId="texto-reporte" label="Copiar reporte para WhatsApp" />
      </section>

      {canReconfirm ? (
        <section aria-labelledby="reconfirmar" className="flex flex-col gap-3">
          <h2 id="reconfirmar" className="text-xl font-bold">
            Reconfirmar stock
          </h2>
          <p>
            Mandale este mensaje al comercio. Cuando te confirme, dejá marcadas las que siguen disponibles y reconfirmalas:
            se renueva su vencimiento ({dealer.listingTtlDays ?? 60} días) y la fecha de verificación. Las vendidas marcalas
            en Publicaciones.
          </p>
          {done !== null && Number.isFinite(done) ? (
            <p role="status" className="rounded border border-green-800 bg-green-50 p-3 text-green-900">
              {done === 1 ? "1 moto reconfirmada." : `${done} motos reconfirmadas.`}
            </p>
          ) : null}
          <label htmlFor="texto-stock" className="font-medium">
            Mensaje para el comercio
          </label>
          <textarea
            id="texto-stock"
            readOnly
            rows={Math.min(14, stock.length + 4)}
            value={reconfirmMessage(dealer.name, stock)}
            className={`rounded border border-gray-500 p-2 font-mono text-sm ${focus}`}
          />
          <CopyButton targetId="texto-stock" label="Copiar mensaje" />
          {stock.length ? (
            <form action={reconfirmAction} className="flex flex-col gap-2">
              <input type="hidden" name="comercio" value={dealer.id} />
              <fieldset className="flex flex-col gap-1">
                <legend className="font-medium">Siguen disponibles</legend>
                {stock.map((s) => {
                  const days = s.lastVerifiedAt ? Math.floor((now.getTime() - s.lastVerifiedAt.getTime()) / DAY_MS) : null;
                  return (
                    <label key={s.id} className="flex min-h-11 items-center gap-2">
                      <input type="checkbox" name="publicacion" value={s.id} defaultChecked className={`h-5 w-5 ${focus}`} />
                      <span>
                        <span className="font-mono">{s.externalRef ?? s.publicRef}</span> · {s.title} · {priceText(s)} ·{" "}
                        {days === null ? "nunca verificada" : days === 0 ? "verificada hoy" : `verificada hace ${days} días`}
                        {days !== null && days > 30 ? " (más de 30 días)" : ""}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <button type="submit" className={`min-h-11 self-start rounded bg-blue-800 px-4 font-medium text-white ${focus}`}>
                Reconfirmar las marcadas
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
