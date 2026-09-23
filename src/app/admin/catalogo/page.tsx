import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { brands, categories } from "@/db/schema";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { type CatalogKind, CATALOG_KINDS, isVerifyFlagged, listCatalog, pendingSuggestions, slugLocked } from "@/components/admin/crud/catalog-admin";
import { CrudForm, type FieldSpec } from "@/components/admin/crud/crud-form";
import { proposeModelAction, resolveSuggestionAction, saveCatalogAction } from "./actions";

// Catálogo (ADMIN_SPEC.md §6). `intro_html` se edita en Contenido (B10).
const section = adminSection("catalogo");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const LABEL: Record<CatalogKind | "sugerencias", string> = { marcas: "Marcas", modelos: "Modelos", categorias: "Categorías", ciudades: "Ciudades", sugerencias: "Sugerencias de modelos" };

type Props = { searchParams: Promise<{ tipo?: string; editar?: string; ok?: string; resuelta?: string; propuesta?: string; error?: string }> };

export default async function Page({ searchParams }: Props) {
  const user = await requirePageRole("/admin/catalogo", ...section.roles);
  const q = await searchParams;
  const tab = (CATALOG_KINDS as readonly string[]).includes(q.tipo ?? "") ? (q.tipo as CatalogKind) : q.tipo === "sugerencias" ? "sugerencias" : "marcas";
  const isAdmin = user.role === "admin";
  const [brandOpts, categoryOpts] = await Promise.all([
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
  ]);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <nav aria-label="Catálogo" className="flex flex-wrap gap-2">
        {([...CATALOG_KINDS, "sugerencias"] as const).map((k) => (
          <Link
            key={k}
            href={`/admin/catalogo?tipo=${k}`}
            aria-current={k === tab ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded border px-3 ${k === tab ? "border-blue-800 bg-blue-50 font-bold" : "border-gray-400"} ${focus}`}
          >
            {LABEL[k]}
          </Link>
        ))}
      </nav>
      {q.ok ? <p role="status" className="text-green-900">Guardado.</p> : null}
      {q.error ? <p role="alert" className="text-red-800">{q.error}</p> : null}
      {tab === "sugerencias" ? <Suggestions isAdmin={isAdmin} brandOpts={brandOpts} q={q} /> : <CatalogTab kind={tab} isAdmin={isAdmin} editId={Number(q.editar) || null} brandOpts={brandOpts} categoryOpts={categoryOpts} />}
    </main>
  );
}

async function CatalogTab({
  kind,
  isAdmin,
  editId,
  brandOpts,
  categoryOpts,
}: {
  kind: CatalogKind;
  isAdmin: boolean;
  editId: number | null;
  brandOpts: Array<{ id: number; name: string }>;
  categoryOpts: Array<{ id: number; name: string }>;
}) {
  const user = await requirePageRole("/admin/catalogo", ...section.roles);
  const rows = (await listCatalog(user, kind)) as Array<{ id: number; name: string; slug: string; isActive: boolean; sortOrder: number | null; introHtml: string | null; extra: string; brandId?: number; categoryId?: number | null; engineCc?: number | null }>;
  const editing = editId ? rows.find((r) => r.id === editId) : undefined;
  const locked = editing ? await slugLocked(kind, editing.id) : false;
  const fields: FieldSpec[] = [
    { name: "name", label: "Nombre", type: "text", required: true },
    {
      name: "slug",
      label: "Slug",
      type: "text",
      disabled: locked,
      hint: locked ? "Bloqueado: ya hay publicaciones publicadas con este valor y su URL no cambia (SEO §1)." : "Vacío = se arma con el nombre. No puede ser tipo, ciudad, nuevas, usadas, en-cuotas ni page (G-15).",
    },
    ...(kind === "modelos"
      ? ([
          { name: "brandId", label: "Marca", type: "select", options: brandOpts.map((b) => ({ value: String(b.id), label: b.name })) },
          { name: "categoryId", label: "Categoría", type: "select", options: [{ value: "", label: "Sin categoría" }, ...categoryOpts.map((c) => ({ value: String(c.id), label: c.name }))] },
          { name: "engineCc", label: "Cilindrada (cc)", type: "number" },
        ] as FieldSpec[])
      : ([{ name: "sortOrder", label: "Orden", type: "number" }] as FieldSpec[])),
    ...(kind === "ciudades"
      ? ([
          { name: "department", label: "Departamento", type: "text", required: true },
          { name: "isMetroAsuncion", label: "Gran Asunción", type: "checkbox" },
        ] as FieldSpec[])
      : []),
    { name: "isActive", label: "Activo (visible en el sitio)", type: "checkbox" },
  ];
  const initial: Record<string, string> = editing
    ? {
        name: editing.name,
        slug: editing.slug,
        isActive: editing.isActive ? "1" : "",
        sortOrder: String(editing.sortOrder ?? 0),
        brandId: String(editing.brandId ?? ""),
        categoryId: String(editing.categoryId ?? ""),
        engineCc: String(editing.engineCc ?? ""),
        department: kind === "ciudades" ? editing.extra : "",
      }
    : { isActive: "1", sortOrder: "0", brandId: String(brandOpts[0]?.id ?? "") };
  return (
    <>
      {isAdmin ? (
        <section aria-labelledby="form" className="rounded border border-gray-400 p-3">
          <h2 id="form" className="mb-2 font-bold">
            {editing ? `Editar: ${editing.name}` : `Nuevo (${LABEL[kind].toLowerCase()})`}
          </h2>
          <CrudForm key={editing?.id ?? "nuevo"} action={saveCatalogAction} fields={fields} initial={initial} hidden={{ kind, id: String(editing?.id ?? "") }} submitLabel="Guardar" />
          <p className="mt-2 text-sm">
            El texto editorial (<code>intro_html</code>) se edita en{" "}
            <Link href="/admin/contenido" className="underline">
              Contenido
            </Link>
            .
          </p>
        </section>
      ) : (
        <p className="text-sm">Sólo lectura. Para sumar un modelo, proponelo en «Sugerencias de modelos».</p>
      )}
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{LABEL[kind]}</caption>
        <thead>
          <tr className="border-b border-gray-400 text-left">
            <th scope="col" className="p-2">Nombre</th>
            <th scope="col" className="p-2">Slug</th>
            <th scope="col" className="p-2">{kind === "modelos" ? "Marca" : kind === "ciudades" ? "Departamento" : "Orden"}</th>
            <th scope="col" className="p-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-200">
              <td className="p-2">
                {isAdmin ? (
                  <Link href={`/admin/catalogo?tipo=${kind}&editar=${r.id}`} className={`underline ${focus}`}>
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
                {isVerifyFlagged(r.introHtml) ? <span className="ml-2 rounded bg-amber-200 px-1 text-xs font-bold">[VERIFICAR]</span> : null}
              </td>
              <td className="p-2 font-mono">{r.slug}</td>
              <td className="p-2">{kind === "modelos" || kind === "ciudades" ? r.extra : r.sortOrder}</td>
              <td className="p-2">{r.isActive ? "Activo" : "Inactivo"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

async function Suggestions({ isAdmin, brandOpts, q }: { isAdmin: boolean; brandOpts: Array<{ id: number; name: string }>; q: { resuelta?: string; propuesta?: string } }) {
  const user = await requirePageRole("/admin/catalogo", ...section.roles);
  const list = await pendingSuggestions(user);
  const modelsByBrand = new Map<number, Array<{ id: number; name: string }>>();
  for (const m of (await listCatalog(user, "modelos")) as Array<{ id: number; name: string; brandId?: number }>) {
    if (!m.brandId) continue;
    modelsByBrand.set(m.brandId, [...(modelsByBrand.get(m.brandId) ?? []), { id: m.id, name: m.name }]);
  }
  const input = `min-h-11 rounded border border-gray-500 px-2 ${focus}`;
  return (
    <>
      {q.resuelta ? <p role="status" className="text-green-900">Resuelta: {q.resuelta} publicaciones actualizadas.</p> : null}
      {q.propuesta ? <p role="status" className="text-green-900">Propuesta guardada.</p> : null}
      <form action={proposeModelAction} className="flex flex-wrap items-end gap-2 rounded border border-gray-400 p-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Marca</span>
          <select name="brandId" className={input}>
            {brandOpts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Modelo a proponer</span>
          <input name="modelo" required className={input} />
        </label>
        <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
          Proponer
        </button>
      </form>
      {list.length === 0 ? (
        <p>No hay sugerencias pendientes.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((s) => (
            <li key={s.id} className="rounded border border-gray-300 p-3">
              <p>
                <strong>{s.rawText}</strong> ({s.brandName ?? "sin marca"}){s.listingTitle ? ` · en «${s.listingTitle}»` : " · propuesta sin publicación"}
              </p>
              {isAdmin ? (
                <div className="mt-2 flex flex-wrap gap-3">
                  {s.brandId && modelsByBrand.get(s.brandId)?.length ? (
                    <form action={resolveSuggestionAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="accion" value="map" />
                      <label className="flex flex-col gap-1 text-sm">
                        Mapear a
                        <select name="modelId" className={input}>
                          {modelsByBrand.get(s.brandId)!.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
                        Mapear
                      </button>
                    </form>
                  ) : null}
                  <form action={resolveSuggestionAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="accion" value="create" />
                    <label className="flex flex-col gap-1 text-sm">
                      Crear modelo
                      <input name="nombre" defaultValue={s.rawText} className={input} />
                    </label>
                    <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
                      Crear y mapear
                    </button>
                  </form>
                  <form action={resolveSuggestionAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="accion" value="reject" />
                    <button type="submit" className={`min-h-11 rounded border border-red-800 px-3 text-red-800 ${focus}`}>
                      Rechazar
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
