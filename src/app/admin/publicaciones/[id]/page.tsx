import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { categories, cities } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/session";
import { CrudForm, type FieldSpec } from "@/components/admin/crud/crud-form";
import { listingForEdit, listingTimeline } from "@/components/admin/crud/listings-admin";
import { formatDatePy } from "@/lib/import/messages";
import { paths } from "@/lib/seo/routes";
import { editAction, stateAction } from "../actions";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const STATE_ACTIONS: Record<string, Array<[string, string]>> = {
  published: [["pause", "Pausar"], ["mark_sold", "Marcar vendida"]],
  paused: [["resume", "Reanudar"]],
  expired: [["renew", "Renovar"]],
  sold: [["renew", "Volver a publicar"]],
};

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ estado?: string; error?: string }> }) {
  const { id } = await params;
  const user = await requirePageRole(`/admin/publicaciones/${id}`, "admin", "moderator");
  const data = await listingForEdit(user, Number(id));
  if (!data) notFound();
  const { listing: l } = data;
  const [cityOpts, categoryOpts, timeline, q] = await Promise.all([
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(asc(cities.sortOrder)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
    listingTimeline(user, l.id),
    searchParams,
  ]);
  const opts = (rows: Array<{ id: number; name: string }>, empty?: string) => [...(empty ? [{ value: "", label: empty }] : []), ...rows.map((r) => ({ value: String(r.id), label: r.name }))];
  const fields: FieldSpec[] = [
    { name: "title", label: "Título", type: "text", required: true },
    { name: "description", label: "Descripción", type: "textarea" },
    { name: "priceGs", label: "Precio de contado (Gs.)", type: "number" },
    { name: "hasFinancingOnly", label: "Sólo financiado (sin precio de contado)", type: "checkbox" },
    { name: "downPaymentGs", label: "Entrega (Gs.)", type: "number" },
    { name: "installmentGs", label: "Cuota (Gs.)", type: "number" },
    { name: "installmentCount", label: "Cantidad de cuotas", type: "number" },
    { name: "year", label: "Año", type: "number" },
    { name: "mileageKm", label: "Kilometraje", type: "number" },
    { name: "modelId", label: `Modelo (${data.brandName})`, type: "select", options: opts(data.modelOpts, l.modelRaw ? `Sin mapear: «${l.modelRaw}»` : "Sin modelo") },
    { name: "categoryId", label: "Categoría", type: "select", options: opts(categoryOpts) },
    { name: "cityId", label: "Ciudad", type: "select", options: opts(cityOpts) },
    { name: "dealerId", label: "Comercio", type: "select", options: opts(data.dealerOpts, "Particular") },
    { name: "contactPhone", label: "Teléfono de contacto", type: "text", required: true },
    { name: "contactWhatsapp", label: "Tiene WhatsApp (si no, «sólo llamadas»)", type: "checkbox" },
    {
      name: "documentationStatus",
      label: "Papeles (usadas)",
      type: "select",
      options: [
        { value: "", label: "—" },
        { value: "al_dia", label: "Al día" },
        { value: "transferencia_pendiente", label: "Transferencia pendiente" },
        { value: "no_declara", label: "No declara" },
      ],
    },
    { name: "isNegotiable", label: "Negociable", type: "checkbox" },
    { name: "acceptsTradeIn", label: "Acepta permuta", type: "checkbox" },
    { name: "internalNote", label: "Nota interna (queda en el registro de actividad)", type: "textarea" },
  ];
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const initial: Record<string, string> = {
    title: l.title,
    description: s(l.description),
    priceGs: s(l.priceGs),
    hasFinancingOnly: l.hasFinancingOnly ? "1" : "",
    downPaymentGs: s(l.downPaymentGs),
    installmentGs: s(l.installmentGs),
    installmentCount: s(l.installmentCount),
    year: s(l.year),
    mileageKm: s(l.mileageKm),
    modelId: s(l.modelId),
    categoryId: s(l.categoryId),
    cityId: s(l.cityId),
    dealerId: s(l.dealerId),
    contactPhone: l.contactPhoneRaw,
    contactWhatsapp: l.contactWhatsapp ? "1" : "",
    documentationStatus: s(l.documentationStatus),
    isNegotiable: l.isNegotiable ? "1" : "",
    acceptsTradeIn: l.acceptsTradeIn ? "1" : "",
  };
  const actions = STATE_ACTIONS[l.status] ?? [];
  const isPublic = ["published", "sold", "expired"].includes(l.status);
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{l.title}</h1>
      <p className="text-sm">
        {l.publicRef} · estado: {l.status}
        {l.expiresAt ? ` · vence ${formatDatePy(l.expiresAt)}` : ""}
        {isPublic ? (
          <>
            {" · "}
            <Link href={paths.listing(l)} className="underline">
              ver ficha
            </Link>
          </>
        ) : null}
        {l.status === "pending_review" ? (
          <>
            {" · "}
            <Link href={`/admin/moderacion?id=${l.id}`} className="underline">
              moderar
            </Link>
          </>
        ) : null}
      </p>
      {q.estado ? <p role="status" className="text-green-900">Listo.</p> : null}
      {q.error ? <p role="alert" className="text-red-800">{q.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {actions.map(([action, label]) => (
          <form key={action} action={stateAction}>
            <input type="hidden" name="id" value={l.id} />
            <input type="hidden" name="accion" value={action} />
            <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
              {label}
            </button>
          </form>
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="editar">
          <h2 id="editar" className="mb-2 text-lg font-bold">
            Editar
          </h2>
          <CrudForm action={editAction} fields={fields} initial={initial} hidden={{ id: String(l.id) }} submitLabel="Guardar cambios" />
        </section>
        <section aria-labelledby="historia">
          <h2 id="historia" className="text-lg font-bold">
            Línea de tiempo
          </h2>
          <p className="text-sm">
            Eventos: {timeline.events.length ? timeline.events.map((e) => `${e.type} ${e.humans}${e.bots ? ` (+${e.bots} bots)` : ""}`).join(" · ") : "ninguno"}
          </p>
          <ol className="mt-2 flex flex-col gap-1 text-sm">
            {timeline.items.map((t, i) => (
              <li key={i} className="border-b border-gray-200 pb-1">
                <span className="text-gray-700">{formatDatePy(t.at)}</span> · {t.text}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
