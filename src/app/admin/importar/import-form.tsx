"use client";

import { useActionState } from "react";
import { importAction } from "./actions";
import { type ImportViewState, KIND_LABEL, type ViewRow } from "./view";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const button = `min-h-11 rounded px-4 font-medium ${focus} disabled:opacity-70`;

export type DealerOption = { id: number; name: string };

function RowsTable({ rows, caption }: { rows: ViewRow[]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-gray-400 text-left">
            <th scope="col" className="p-2">Línea</th>
            <th scope="col" className="p-2">Referencia</th>
            <th scope="col" className="p-2">Qué pasa</th>
            <th scope="col" className="p-2">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.line}-${r.ref}`} className={`border-b border-gray-200 ${r.kind.startsWith("reject") || r.kind === "failed" ? "bg-red-50" : ""}`}>
              <td className="p-2">{r.line}</td>
              <td className="p-2 font-mono">{r.ref}</td>
              <td className="p-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
              <td className="p-2">{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImportForm({ dealers }: { dealers: DealerOption[] }) {
  const [state, action, pending] = useActionState<ImportViewState, FormData>(importAction, { step: "idle" });

  if (state.step === "preview") {
    const { counts } = state;
    const applicable = counts.create + counts.update;
    return (
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="csvText" value={state.csvText} />
        <input type="hidden" name="comercio" value={state.dealerId} />
        <input type="hidden" name="hash" value={state.hash} />
        <h3 className="text-lg font-bold">Vista previa (todavía no se guardó nada)</h3>
        {state.stale ? (
          <p role="alert" className="rounded border border-amber-700 bg-amber-50 p-3 text-amber-900">
            La base cambió desde la vista previa (otra importación o una edición). Revisá esta vista previa nueva antes de confirmar.
          </p>
        ) : null}
        {state.fileErrors.map((e) => (
          <p key={e} role="alert" className="text-red-800">
            {e}
          </p>
        ))}
        {state.fileWarnings.map((w) => (
          <p key={w} className="text-amber-900">
            {w}
          </p>
        ))}
        <p>
          {counts.create} nuevas · {counts.update} a actualizar · {counts.unchanged} sin cambios · {counts.reject} rechazadas
        </p>
        {state.rows.length ? <RowsTable rows={state.rows} caption="Vista previa de la importación" /> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="paso"
            value="importar"
            disabled={pending || applicable === 0 || state.fileErrors.length > 0}
            className={`${button} bg-blue-800 text-white`}
          >
            {pending ? "Importando…" : `Importar ${applicable} ${applicable === 1 ? "fila" : "filas"}`}
          </button>
          <button type="submit" name="paso" value="cancelar" disabled={pending} className={`${button} border border-gray-500`}>
            Cancelar
          </button>
        </div>
        {counts.reject ? <p className="text-sm">Las filas rechazadas no se importan. Corregilas en la planilla y volvé a subirla: lo ya importado no se duplica.</p> : null}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.step === "done" ? (
        <section aria-labelledby="resultado" className="flex flex-col gap-2">
          <h3 id="resultado" className="text-lg font-bold">
            Importación terminada
          </h3>
          <p role="status">{state.summary}</p>
          <RowsTable rows={state.rows} caption="Resultado de la importación" />
        </section>
      ) : null}
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="comercio" className="font-medium">
            Comercio
          </label>
          <select id="comercio" name="comercio" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`} defaultValue="">
            <option value="">El que dice la columna «comercio» de cada fila</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="planilla" className="font-medium">
            Planilla (.csv)
          </label>
          <input id="planilla" name="planilla" type="file" accept=".csv,text/csv" required className={`min-h-11 ${focus}`} />
        </div>
        {state.step === "idle" && state.error ? (
          <p role="alert" className="text-red-800">
            {state.error}
          </p>
        ) : null}
        <button type="submit" name="paso" value="vista-previa" disabled={pending} className={`${button} self-start bg-blue-800 text-white`}>
          {pending ? "Leyendo…" : "Ver vista previa"}
        </button>
      </form>
    </div>
  );
}
