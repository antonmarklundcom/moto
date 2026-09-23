import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { brands, categories, cities, dealers, paymentMethodEnum } from "@/db/schema";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { adsList, featuredList, incomeByMonth, planAlert, plansList } from "@/components/admin/ops/monetization";
import { formatGuaranies } from "@/lib/format";
import { formatDatePy } from "@/lib/import/messages";
import { adAction, featuredAction, featuredStatusAction, planAction } from "./actions";

// Monetización (ADMIN_SPEC.md §8, ADR-13: cobros manuales, sin pasarela).
// Todo lo que suma es lo cobrado y registrado (MONETIZATION.md §9).
const section = adminSection("monetizacion");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const input = `min-h-11 rounded border border-gray-500 px-2 ${focus}`;
const METHOD: Record<string, string> = { transferencia: "Transferencia", tigo_money: "Tigo Money", billetera_personal: "Billetera Personal", efectivo: "Efectivo", cortesia: "Cortesía" };
const btn = `min-h-11 rounded bg-blue-800 px-3 text-white ${focus}`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
    </label>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requirePageRole("/admin/monetizacion", ...section.roles);
  const q = await searchParams;
  const isAdmin = user.role === "admin";
  const [featured, plans] = await Promise.all([featuredList(user), plansList(user)]);
  const [ads, income, dealerOpts, cityOpts, brandOpts, categoryOpts] = isAdmin
    ? await Promise.all([
        adsList(user),
        incomeByMonth(user),
        db.select({ id: dealers.id, name: dealers.name }).from(dealers).where(isNull(dealers.deletedAt)).orderBy(asc(dealers.name)),
        db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(asc(cities.sortOrder)),
        db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
        db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
      ])
    : [[], [], [], [], [], []];
  const now = new Date();
  return (
    <main className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      {q.ok ? <p role="status" className="text-green-900">{q.ok}</p> : null}
      {q.error ? <p role="alert" className="text-red-800">{q.error}</p> : null}

      {isAdmin ? (
        <section aria-labelledby="ingresos">
          <h2 id="ingresos" className="text-lg font-bold">Ingresos registrados por mes</h2>
          <p className="text-sm">Suma de destacados cobrados y publicidad con monto. Es lo cobrado, no una proyección.</p>
          {income.length ? (
            <table className="mt-2 text-sm">
              <caption className="sr-only">Ingresos por mes</caption>
              <thead>
                <tr className="text-left">
                  <th scope="col" className="pr-4">Mes</th>
                  <th scope="col" className="pr-4">Destacados</th>
                  <th scope="col" className="pr-4">Publicidad</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {income.map((r) => (
                  <tr key={r.month}>
                    <td className="pr-4">{r.month}</td>
                    <td className="pr-4">{formatGuaranies(r.featured)}</td>
                    <td className="pr-4">{formatGuaranies(r.ads)}</td>
                    <td className="font-semibold">{formatGuaranies(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-1">Todavía no hay cobros registrados.</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="destacados" className="flex flex-col gap-2">
        <h2 id="destacados" className="text-lg font-bold">Destacados</h2>
        {isAdmin ? (
          <form action={featuredAction} className="flex flex-wrap items-end gap-2 rounded border border-gray-400 p-3">
            <Field label="Código de la publicación">
              <input name="ref" required className={input} />
            </Field>
            <Field label="Días">
              <input name="dias" defaultValue="7" inputMode="numeric" className={`${input} w-20`} />
            </Field>
            <Field label="Monto cobrado (Gs.)">
              <input name="monto" inputMode="numeric" required className={input} />
            </Field>
            <Field label="Medio">
              <select name="medio" className={input}>
                {paymentMethodEnum.map((m) => (
                  <option key={m} value={m}>
                    {METHOD[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Referencia del pago">
              <input name="referencia" className={input} />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="cobrado" value="1" defaultChecked className={`h-5 w-5 ${focus}`} /> Ya está cobrado
            </label>
            <button type="submit" className={btn}>Cargar</button>
          </form>
        ) : null}
        <table className="text-sm">
          <caption className="sr-only">Destacados</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="pr-3">Publicación</th>
              <th scope="col" className="pr-3">Monto</th>
              <th scope="col" className="pr-3">Medio</th>
              <th scope="col" className="pr-3">Vigencia</th>
              <th scope="col" className="pr-3">Estado</th>
              <th scope="col"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {featured.map((f) => (
              <tr key={f.id} className="border-t border-gray-200">
                <td className="pr-3">{f.title} ({f.ref})</td>
                <td className="pr-3">{formatGuaranies(f.amountGs)}</td>
                <td className="pr-3">{METHOD[f.method]}{f.reference ? ` · ${f.reference}` : ""}</td>
                <td className="pr-3">{formatDatePy(f.startsAt)} → {formatDatePy(f.endsAt)}{f.status === "active" && f.endsAt.getTime() - now.getTime() < 3 * 86_400_000 ? " (vence pronto)" : ""}</td>
                <td className="pr-3">{f.status}</td>
                <td>
                  {isAdmin && (f.status === "pending_payment" || f.status === "active") ? (
                    <form action={featuredStatusAction} className="flex gap-1">
                      <input type="hidden" name="id" value={f.id} />
                      {f.status === "pending_payment" ? <button name="estado" value="active" className={`min-h-11 rounded border px-2 ${focus}`}>Cobrado</button> : null}
                      <button name="estado" value="cancelled" className={`min-h-11 rounded border px-2 ${focus}`}>Cancelar</button>
                      {f.status === "active" ? <button name="estado" value="refunded" className={`min-h-11 rounded border px-2 ${focus}`}>Reintegrado</button> : null}
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="planes" className="flex flex-col gap-2">
        <h2 id="planes" className="text-lg font-bold">Planes de comercios</h2>
        {isAdmin ? (
          <form action={planAction} className="flex flex-wrap items-end gap-2 rounded border border-gray-400 p-3">
            <Field label="Comercio">
              <select name="comercio" className={input}>
                {dealerOpts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Plan (código)">
              <input name="plan" required className={input} />
            </Field>
            <Field label="Límite de publicaciones">
              <input name="limite" inputMode="numeric" className={`${input} w-24`} />
            </Field>
            <Field label="Precio mensual (Gs.)">
              <input name="precio" inputMode="numeric" defaultValue="0" className={input} />
            </Field>
            <Field label="Desde">
              <input type="date" name="desde" required className={input} />
            </Field>
            <Field label="Hasta">
              <input type="date" name="hasta" className={input} />
            </Field>
            <Field label="Notas">
              <input name="notas" className={input} />
            </Field>
            <button type="submit" className={btn}>Cargar plan</button>
          </form>
        ) : null}
        <ul className="text-sm">
          {plans.map((p) => {
            const alert = planAlert(p.endsAt, now);
            return (
              <li key={p.id} className={alert ? "font-bold text-amber-900" : ""}>
                {p.dealer} · {p.planCode} · {formatGuaranies(p.monthlyPriceGs)}/mes · {p.startsAt} → {p.endsAt ?? "sin fin"}
                {alert === "vencido" ? " · vencido" : alert ? ` · vence en ≤ ${alert} días` : ""}
              </li>
            );
          })}
          {plans.length === 0 ? <li>Sin planes cargados.</li> : null}
        </ul>
      </section>

      {isAdmin ? (
        <section aria-labelledby="publicidad" className="flex flex-col gap-2">
          <h2 id="publicidad" className="text-lg font-bold">Publicidad</h2>
          <p className="text-sm">Los espacios todavía no se muestran en el sitio (fase 3): esto registra acuerdos y cobros.</p>
          <form action={adAction} className="flex flex-wrap items-end gap-2 rounded border border-gray-400 p-3">
            <Field label="Anunciante"><input name="anunciante" required className={input} /></Field>
            <Field label="Espacio (código)"><input name="espacio" required className={input} /></Field>
            <Field label="Imagen (ruta)"><input name="imagen" className={input} /></Field>
            <Field label="Texto alternativo"><input name="alt" className={input} /></Field>
            <Field label="Destino (https)"><input name="destino" className={input} /></Field>
            <Field label="Ciudad">
              <select name="ciudad" className={input}>
                <option value="">Todas</option>
                {cityOpts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Marca">
              <select name="marca" className={input}>
                <option value="">Todas</option>
                {brandOpts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Categoría">
              <select name="categoria" className={input}>
                <option value="">Todas</option>
                {categoryOpts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Desde"><input type="date" name="desde" required className={input} /></Field>
            <Field label="Hasta"><input type="date" name="hasta" required className={input} /></Field>
            <Field label="Monto cobrado (Gs.)"><input name="monto" inputMode="numeric" className={input} /></Field>
            <Field label="Estado">
              <select name="estado" className={input}>
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
                <option value="paused">Pausada</option>
                <option value="expired">Vencida</option>
              </select>
            </Field>
            <button type="submit" className={btn}>Guardar</button>
          </form>
          <ul className="text-sm">
            {ads.map((a) => (
              <li key={a.id}>
                {a.advertiserName} · {a.slotCode} · {formatDatePy(a.startsAt)} → {formatDatePy(a.endsAt)} · {a.status} · {formatGuaranies(a.amountGs) ?? "sin monto"} · {a.impressions} impresiones / {a.clicks} clics
              </li>
            ))}
            {ads.length === 0 ? <li>Sin publicidad cargada.</li> : null}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
