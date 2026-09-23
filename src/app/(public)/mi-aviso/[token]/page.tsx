import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddPhotos } from "@/components/publish/add-photos";
import { managedListing } from "@/components/publish/manage";
import { container, fieldClass, focusRing, linkClass, primaryButton, secondaryButton } from "@/components/public/styles";
import { formatDatePy } from "@/lib/import/messages";
import { paths } from "@/lib/seo/routes";
import { manageEditAction, manageStateAction } from "./actions";

// /mi-aviso/<token> (G-1). El token va en la URL: noindex y sin Referer.
export const metadata: Metadata = { title: "Tu publicación", robots: { index: false, follow: false }, referrer: "no-referrer" };

const STATUS: Record<string, string> = {
  draft: "Borrador",
  pending_review: "En revisión (menos de 24 h)",
  published: "Publicada",
  paused: "Pausada",
  sold: "Vendida",
  expired: "Vencida",
  rejected: "Rechazada",
};
const ACTIONS: Record<string, Array<[string, string]>> = {
  published: [["mark_sold", "La vendí"], ["pause", "Pausar"]],
  paused: [["resume", "Reanudar"]],
  expired: [["renew", "Renovar"]],
  sold: [["renew", "Publicarla de nuevo"]],
};
const field = fieldClass;

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { token } = await params;
  const data = await managedListing(decodeURIComponent(token));
  // Token malo: el mismo 404 genérico que cualquier URL inexistente.
  if (!data) notFound();
  const { l } = data;
  const q = await searchParams;
  const actions = ACTIONS[l.status] ?? [];
  const n = (v: number | null) => (v === null ? "" : String(v));
  return (
    <div className={container}>
      <h1 className="mt-6 text-2xl font-bold">{l.title}</h1>
      <p className="mt-1">
        Estado: <strong>{STATUS[l.status] ?? l.status}</strong>
        {l.expiresAt && l.status === "published" ? ` · vence el ${formatDatePy(l.expiresAt)}` : ""}
        {["published", "sold", "expired"].includes(l.status) ? (
          <>
            {" · "}
            <Link href={paths.listing(l)} className={linkClass}>
              ver cómo se ve
            </Link>
          </>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-neutral-700">Este enlace es privado: no lo compartas. Quien lo tenga puede cambiar tu publicación.</p>
      {q.ok ? <p role="status" className="mt-3 rounded border border-green-800 bg-green-50 p-3">{q.ok}</p> : null}
      {q.error ? <p role="alert" className="mt-3 rounded border border-red-800 bg-red-50 p-3">{q.error}</p> : null}
      {l.status === "rejected" && l.rejectionNote ? <p className="mt-3 max-w-prose">Motivo: {l.rejectionNote}</p> : null}

      {actions.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map(([action, label]) => (
            <form key={action} action={manageStateAction}>
              <input type="hidden" name="token" value={decodeURIComponent(token)} />
              <input type="hidden" name="accion" value={action} />
              <button type="submit" className={action === "mark_sold" ? primaryButton : secondaryButton}>
                {label}
              </button>
            </form>
          ))}
        </div>
      ) : null}

      {l.status !== "rejected" ? (
        <form action={manageEditAction} className="mt-8 flex max-w-xl flex-col gap-3">
          <input type="hidden" name="token" value={decodeURIComponent(token)} />
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Editar</h2>
          <p className="text-sm text-neutral-700">Cambiar el precio se aplica enseguida. Si cambiás la descripción o las fotos, la revisamos de nuevo antes de mostrarla.</p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Precio de contado (Gs.)</span>
            <input name="precio" inputMode="numeric" defaultValue={n(l.priceGs)} className={field} />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Entrega</span>
              <input name="entrega" inputMode="numeric" defaultValue={n(l.downPaymentGs)} className={field} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Cuota</span>
              <input name="cuota" inputMode="numeric" defaultValue={n(l.installmentGs)} className={field} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Cuotas</span>
              <input name="cuotas" inputMode="numeric" defaultValue={n(l.installmentCount)} className={field} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Descripción</span>
            <textarea name="descripcion" rows={6} defaultValue={l.description ?? ""} className={`${field} py-2`} />
          </label>
          {data.images.length ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium">Fotos (marcá las que quieras quitar)</legend>
              <ul className="grid grid-cols-3 gap-2">
                {data.images.map((img, i) => (
                  <li key={img.id}>
                    <label className="flex flex-col gap-1 text-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded object-cover" />
                      <span className="flex min-h-11 items-center gap-2">
                        <input type="checkbox" name="quitar" value={img.id} className={`h-5 w-5 ${focusRing}`} /> Quitar
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}
          <AddPhotos />
          <button type="submit" className={`${primaryButton} self-start`}>
            Guardar cambios
          </button>
        </form>
      ) : null}
    </div>
  );
}
