"use client";

import { useActionState } from "react";

// Formulario genérico del admin (ADR-15: estilo mínimo). Server action con
// useActionState: ante un error vuelve con los valores enviados y el error
// junto a cada campo; nada se pierde.

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const input = `min-h-11 w-full rounded border border-gray-500 px-3 ${focus} disabled:bg-gray-100`;

export type FieldSpec = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "date" | "number";
  options?: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
  hint?: string;
  required?: boolean;
};

export type CrudState = { ok: boolean; message: string | null; errors: Record<string, string>; values: Record<string, string>; version: number };

export const initialCrudState: CrudState = { ok: false, message: null, errors: {}, values: {}, version: 0 };

export function CrudForm({
  action,
  fields,
  initial,
  submitLabel,
  readOnly = false,
  hidden = {},
}: {
  action: (prev: CrudState, form: FormData) => Promise<CrudState>;
  fields: readonly FieldSpec[];
  initial: Record<string, string>;
  submitLabel: string;
  readOnly?: boolean;
  hidden?: Record<string, string>;
}) {
  const [state, run, pending] = useActionState(action, initialCrudState);
  const value = (name: string) => (state.version > 0 && name in state.values ? state.values[name] : initial[name]) ?? "";
  return (
    <form key={state.version} action={run} className="flex max-w-2xl flex-col gap-3">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "rounded border border-green-800 bg-green-50 p-2 text-green-900" : "rounded border border-red-800 bg-red-50 p-2 text-red-900"}>
          {state.message}
        </p>
      ) : null}
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const err = state.errors[f.name];
        const disabled = readOnly || f.disabled;
        const describedBy = [err ? `${id}-err` : null, f.hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
        if (f.type === "checkbox") {
          return (
            <div key={f.name}>
              <label className="flex min-h-11 items-center gap-2">
                <input id={id} type="checkbox" name={f.name} value="1" defaultChecked={value(f.name) === "1"} disabled={disabled} aria-describedby={describedBy} className={`h-5 w-5 ${focus}`} />
                {f.label}
              </label>
              {f.hint ? <p id={`${id}-hint`} className="text-sm text-gray-700">{f.hint}</p> : null}
              {err ? <p id={`${id}-err`} className="text-sm text-red-800">{err}</p> : null}
            </div>
          );
        }
        return (
          <div key={f.name} className="flex flex-col gap-1">
            <label htmlFor={id} className="font-medium">
              {f.label}
              {f.required ? " *" : ""}
            </label>
            {f.type === "textarea" ? (
              <textarea id={id} name={f.name} rows={4} defaultValue={value(f.name)} disabled={disabled} aria-describedby={describedBy} aria-invalid={err ? true : undefined} className={`${input} py-2`} />
            ) : f.type === "select" ? (
              <select id={id} name={f.name} defaultValue={value(f.name)} disabled={disabled} aria-describedby={describedBy} aria-invalid={err ? true : undefined} className={input}>
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={f.name}
                type={f.type === "date" ? "date" : "text"}
                inputMode={f.type === "number" ? "numeric" : undefined}
                defaultValue={value(f.name)}
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={err ? true : undefined}
                className={input}
              />
            )}
            {/* Un campo deshabilitado no se envía: se manda igual su valor para que la acción lo vea. */}
            {f.disabled && !readOnly ? <input type="hidden" name={f.name} value={value(f.name)} /> : null}
            {f.hint ? <p id={`${id}-hint`} className="text-sm text-gray-700">{f.hint}</p> : null}
            {err ? <p id={`${id}-err`} className="text-sm text-red-800">{err}</p> : null}
          </div>
        );
      })}
      {state.errors._ ? <p role="alert" className="text-red-800">{state.errors._}</p> : null}
      {readOnly ? null : (
        <button type="submit" disabled={pending} className={`min-h-11 self-start rounded bg-blue-800 px-4 font-medium text-white ${focus} disabled:opacity-70`}>
          {pending ? "Guardando…" : submitLabel}
        </button>
      )}
    </form>
  );
}
