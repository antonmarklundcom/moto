import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { cities } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/session";
import { CrudForm } from "@/components/admin/crud/crud-form";
import { dealerSlugLocked, freeUntilAlert, getDealerAdmin } from "@/components/admin/crud/dealers-admin";
import { saveDealerAction, withdrawStockAction } from "../actions";
import { dealerFields } from "../dealer-fields";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ baja?: string; creado?: string }> }) {
  const { id } = await params;
  const user = await requirePageRole(`/admin/comercios/${id}`, "admin", "moderator");
  const dealer = await getDealerAdmin(user, Number(id));
  if (!dealer) notFound();
  const [cityOpts, locked, q] = await Promise.all([
    db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder)),
    dealerSlugLocked(dealer.id),
    searchParams,
  ]);
  const initial: Record<string, string> = Object.fromEntries(
    Object.entries({
      ...dealer,
      cityId: dealer.cityId,
      phone: dealer.phoneRaw,
      isVerified: dealer.isVerified ? "1" : "",
      autoApprove: dealer.autoApprove ? "1" : "",
      listingTtlDays: dealer.listingTtlDays ?? "",
    }).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)]),
  );
  const alert = freeUntilAlert(dealer.freeUntil);
  const isAdmin = user.role === "admin";
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{dealer.name}</h1>
        <Link href={`/admin/comercios/${dealer.id}/reporte`} className={`underline ${focus}`}>
          Reporte y reconfirmar stock
        </Link>
      </div>
      {q.creado ? <p role="status" className="rounded border border-green-800 bg-green-50 p-2">Comercio creado.</p> : null}
      {!dealer.authorizationDate ? (
        <p role="alert" className="rounded border border-red-800 bg-red-50 p-2 text-red-900">
          Falta el bloque de autorización: su stock no se puede publicar (ADR-12).
        </p>
      ) : null}
      {alert ? (
        <p role="alert" className="rounded border border-amber-700 bg-amber-50 p-2 text-amber-900">
          {alert === "vencido" ? "El período gratis ya venció." : "El período gratis vence en 60 días o menos: preparar la conversación comercial."}
        </p>
      ) : null}
      {!isAdmin ? <p className="text-sm">Sólo lectura (moderación).</p> : null}
      <CrudForm
        action={saveDealerAction}
        fields={dealerFields({ cities: cityOpts, slugLocked: locked })}
        initial={initial}
        hidden={{ id: String(dealer.id) }}
        submitLabel="Guardar"
        readOnly={!isAdmin}
      />
      {isAdmin ? (
        <section aria-labelledby="baja" className="mt-6 max-w-2xl rounded border border-red-800 p-3">
          <h2 id="baja" className="font-bold">
            Baja de todo el stock
          </h2>
          <p className="text-sm">
            Para cuando el comercio retira la autorización: pausa todas sus publicadas, pasa el comercio a «pausado» y quita la fecha de autorización (el
            texto queda como historial).
          </p>
          {q.baja?.startsWith("ok-") ? <p role="status" className="mt-2 text-green-900">Listo: {q.baja.slice(3)} publicaciones pausadas.</p> : null}
          {q.baja === "confirmar" ? <p role="alert" className="mt-2 text-red-800">Escribí BAJA para confirmar.</p> : null}
          {q.baja === "error" ? <p role="alert" className="mt-2 text-red-800">No se pudo: revisá la nota.</p> : null}
          <form action={withdrawStockAction} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="id" value={dealer.id} />
            <label className="flex flex-col gap-1">
              <span className="font-medium">Cuándo y por qué medio lo pidió</span>
              <input name="nota" required className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Escribí BAJA para confirmar</span>
              <input name="confirmar" autoComplete="off" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`} />
            </label>
            <button type="submit" className={`min-h-11 self-start rounded bg-red-800 px-4 font-medium text-white ${focus}`}>
              Dar de baja todo el stock
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
