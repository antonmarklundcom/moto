import Link from "next/link";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { listImportDealers } from "@/lib/import/catalog";
import { COLUMN_HELP, REQUIRED_COLUMNS, STOCK_COLUMNS } from "@/lib/import/columns";
import { ImportForm } from "./import-form";
import { PhotoUploader } from "./photo-uploader";

// G-18: importación de stock de comercio (BUILD_PLAN.md §5.2 B8). Sólo admin.
const section = adminSection("importar");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default async function Page() {
  await requirePageRole("/admin/importar", ...section.roles);
  const dealers = await listImportDealers();
  const options = dealers.map((d) => ({ id: d.id, name: d.name }));

  return (
    <main className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">{section.label}</h1>

      <section aria-labelledby="paso-planilla" className="flex flex-col gap-3">
        <h2 id="paso-planilla" className="text-xl font-bold">
          1. Planilla
        </h2>
        <p>
          Subí la planilla del comercio. Primero ves qué se crea, qué se actualiza y qué se rechaza y por qué; recién
          cuando confirmás se guarda. Volver a subir la misma planilla no duplica nada: se reconoce cada moto por
          comercio y referencia.
        </p>
        <p>
          <a href="/admin/importar/planilla" className={`inline-flex min-h-11 items-center underline ${focus}`}>
            Descargar la planilla modelo (.csv)
          </a>
        </p>
        <details>
          <summary className={`min-h-11 cursor-pointer py-2 ${focus}`}>Qué va en cada columna</summary>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            {STOCK_COLUMNS.map((c) => (
              <div key={c} className="contents">
                <dt className="font-mono">
                  {c}
                  {REQUIRED_COLUMNS.includes(c) ? " *" : ""}
                </dt>
                <dd>{COLUMN_HELP[c]}</dd>
              </div>
            ))}
          </dl>
        </details>
        {options.length === 0 ? (
          <p className="rounded border border-amber-700 bg-amber-50 p-3 text-amber-900">
            Todavía no hay comercios cargados. Cargá el comercio (con su bloque de autorización) en Comercios antes de
            importar su stock.
          </p>
        ) : null}
        <ImportForm dealers={options} />
      </section>

      <section aria-labelledby="paso-fotos" className="flex flex-col gap-3">
        <h2 id="paso-fotos" className="text-xl font-bold">
          2. Fotos
        </h2>
        <p>
          Después de importar la planilla, subí las fotos. El nombre de cada archivo empieza con la referencia de la moto:
          <span className="font-mono"> HX-102.jpg</span>, <span className="font-mono">HX-102-2.jpg</span>. Si es la foto
          oficial del modelo (sólo 0 km), agregá <span className="font-mono">catalogo</span> al nombre
          (<span className="font-mono">HX-102-catalogo.jpg</span>) y se marca como foto de catálogo. Un .zip se descomprime
          antes, o se carga con la línea de comandos.
        </p>
        <PhotoUploader dealers={options} />
      </section>

      <section aria-labelledby="comercios" className="flex flex-col gap-3">
        <h2 id="comercios" className="text-xl font-bold">
          Reporte y reconfirmar stock
        </h2>
        {dealers.length ? (
          <ul className="flex flex-col gap-1">
            {dealers.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/comercios/${d.id}/reporte`} className={`inline-flex min-h-11 items-center underline ${focus}`}>
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin comercios todavía.</p>
        )}
      </section>
    </main>
  );
}
