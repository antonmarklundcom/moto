import Link from "next/link";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { crmHealth, PAGE_SIZE, searchLeads } from "@/components/admin/ops/leads-admin";
import { formatDatePy } from "@/lib/import/messages";
import { MAX_CRM_ATTEMPTS } from "@/lib/leads/deliver";
import { formatPhoneDisplay } from "@/lib/phone";
import { paths } from "@/lib/seo/routes";
import { retryLeadAction, spamAction } from "./actions";

// Bandeja de leads (ADMIN_SPEC.md §7): cada lead con todo su contexto.
const section = adminSection("leads");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const input = `min-h-11 rounded border border-gray-500 px-2 ${focus}`;
const TYPE: Record<string, string> = { financing: "Financiación", insurance: "Seguro", dealer_plan: "Comercio", advertising: "Publicidad", general: "General" };

function phone(v: string) {
  try {
    return formatPhoneDisplay(v);
  } catch {
    return v;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageRole("/admin/leads", ...section.roles);
  const q = await searchParams;
  const filters = { type: q.tipo, crm: q.crm, from: q.desde, to: q.hasta, exhausted: q.agotados === "1" };
  const page = Math.max(1, Number(q.pagina) || 1);
  const [health, { total, rows }] = await Promise.all([crmHealth(user), searchLeads(user, filters, page)]);
  const query = new URLSearchParams(Object.entries(q).filter(([k, v]) => v && ["tipo", "crm", "desde", "hasta", "agotados"].includes(k)) as Array<[string, string]>).toString();
  const back = `/admin/leads${query ? `?${query}` : ""}`;
  const isAdmin = user.role === "admin";
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      {health.exhausted > 0 ? (
        <p role="alert" className="rounded border-2 border-red-800 bg-red-100 p-3 font-bold text-red-900">
          {health.exhausted} {health.exhausted === 1 ? "lead agotó" : "leads agotaron"} los {MAX_CRM_ATTEMPTS} intentos sin llegar al CRM.{" "}
          <Link href="/admin/leads?agotados=1" className="underline">
            Verlos
          </Link>
        </p>
      ) : null}
      {!health.crmConfigured ? (
        <p role="alert" className="rounded border border-amber-700 bg-amber-50 p-2 text-amber-900">
          El CRM no está configurado: los leads se guardan como «pendiente» y salen cuando se cargue la URL y la key.
        </p>
      ) : null}
      <section aria-labelledby="salud-crm" className="rounded border border-gray-400 p-3 text-sm">
        <h2 id="salud-crm" className="font-bold">
          CRM, últimas 24 h
        </h2>
        <p>
          Pendientes {health.last24h.pending} · enviados {health.last24h.sent} · duplicados {health.last24h.duplicate} · fallidos {health.last24h.failed}
        </p>
        {health.lastFailure ? (
          <p className="mt-1">
            Último error ({formatDatePy(health.lastFailure.at)}, HTTP {health.lastFailure.httpStatus ?? "sin respuesta"}): <code className="break-all">{(health.lastFailure.error ?? health.lastFailure.body ?? "").slice(0, 500)}</code>
          </p>
        ) : null}
      </section>
      {q.reintento ? <p role="status" className="text-green-900">Reintento: {q.reintento}.</p> : null}
      {q.error ? <p role="alert" className="text-red-800">{q.error}</p> : null}
      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          Tipo
          <select name="tipo" defaultValue={q.tipo ?? ""} className={input}>
            <option value="">Todos</option>
            {Object.entries(TYPE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          CRM
          <select name="crm" defaultValue={q.crm ?? ""} className={input}>
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="sent">Enviado</option>
            <option value="duplicate">Duplicado</option>
            <option value="failed">Fallido</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Desde
          <input type="date" name="desde" defaultValue={q.desde ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          Hasta
          <input type="date" name="hasta" defaultValue={q.hasta ?? ""} className={input} />
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="agotados" value="1" defaultChecked={q.agotados === "1"} className={`h-5 w-5 ${focus}`} /> Sólo agotados
        </label>
        <button type="submit" className={`min-h-11 rounded bg-blue-800 px-3 text-white ${focus}`}>
          Filtrar
        </button>
        <a href={`/admin/leads/exportar${query ? `?${query}` : ""}`} className={`inline-flex min-h-11 items-center rounded border border-gray-500 px-3 ${focus}`}>
          Exportar CSV
        </a>
      </form>
      <p>{total} leads.</p>
      <ul className="flex flex-col gap-3">
        {rows.map((l) => {
          const payload = (l.payloadJson ?? {}) as { fields?: Record<string, unknown>; consent_text_version?: string };
          const exhausted = l.crmStatus === "failed" && l.crmAttempts >= MAX_CRM_ATTEMPTS;
          return (
            <li key={l.id} className={`rounded border p-3 text-sm ${exhausted ? "border-red-800 bg-red-50" : "border-gray-300"} ${l.isSpam ? "opacity-60" : ""}`}>
              <p className="font-semibold">
                {TYPE[l.type] ?? l.type} · {l.name ?? "Sin nombre"} · {phone(l.phoneE164)}
                {l.email ? ` · ${l.email}` : ""} · {formatDatePy(l.createdAt)}
                {l.isSpam ? " · SPAM" : ""}
              </p>
              {l.listingTitle && l.listingRef && l.listingSlug ? (
                <p>
                  Publicación:{" "}
                  <Link href={paths.listing({ slug: l.listingSlug, publicRef: l.listingRef })} className="underline">
                    {l.listingTitle}
                  </Link>
                  {l.dealerName ? ` · ${l.dealerName}` : ""}
                </p>
              ) : null}
              {payload.fields && Object.keys(payload.fields).length ? (
                <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3">
                  {Object.entries(payload.fields).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-gray-700">{k}</dt>
                      <dd>{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {l.message ? <p className="mt-1 whitespace-pre-line">«{l.message}»</p> : null}
              <p className="mt-1 text-gray-700">
                Origen: {l.pageUrl ?? "—"}
                {l.referrer ? ` · referrer ${l.referrer}` : ""}
                {l.utmSource || l.utmCampaign ? ` · utm ${[l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join("/")}` : ""}
                {l.gclid ? " · gclid" : ""}
                {l.fbclid ? " · fbclid" : ""}
              </p>
              <p className={exhausted ? "font-bold text-red-900" : ""}>
                CRM: {l.crmStatus} · {l.crmAttempts} intento(s){l.crmLastError ? ` · ${l.crmLastError.slice(0, 200)}` : ""}
              </p>
              {isAdmin ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(l.crmStatus === "pending" || l.crmStatus === "failed") && !l.isSpam ? (
                    <form action={retryLeadAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="volver" value={back} />
                      <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
                        Reenviar al CRM
                      </button>
                    </form>
                  ) : null}
                  <form action={spamAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="spam" value={l.isSpam ? "0" : "1"} />
                    <input type="hidden" name="volver" value={back} />
                    <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
                      {l.isSpam ? "No es spam" : "Marcar spam"}
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {total > PAGE_SIZE ? (
        <nav aria-label="Páginas" className="flex gap-3">
          {page > 1 ? <Link href={`${back}${back.includes("?") ? "&" : "?"}pagina=${page - 1}`} className="underline">← Anterior</Link> : null}
          <span>Página {page} de {Math.ceil(total / PAGE_SIZE)}</span>
          {page * PAGE_SIZE < total ? <Link href={`${back}${back.includes("?") ? "&" : "?"}pagina=${page + 1}`} className="underline">Siguiente →</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
