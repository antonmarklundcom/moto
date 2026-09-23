"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldClass, focusRing, primaryButton } from "@/components/public/styles";
import type { PublicLeadType } from "@/lib/leads/types";
import { FORM_FIELDS, type FieldDef, SUBMIT_LABEL } from "./fields";

// Formulario de lead sobre el handler de A4 (POST /api/leads). Sin JS es un
// formulario común (303 a /gracias o de vuelta con ?error=campo). Con JS se
// envía como JSON: un error no borra lo que la persona escribió (A4, Known
// issues) y el error queda junto a su campo.

const field = fieldClass;

export type LeadFormProps = {
  type: PublicLeadType;
  /** Ruta de la página del formulario (vuelve acá sin JS si hay error). */
  pagePath: string;
  /** Texto obligatorio junto al botón (LEAD_NOTICE de A4), literal. */
  notice: string | null;
  /** `public_ref` si viene de una ficha. */
  listingRef?: string | null;
  defaults?: Record<string, string>;
  /** Error que trajo la redirección sin JS (`?error=campo`), ya traducido. */
  initialErrors?: Record<string, string>;
  thanksPath: string;
};

export function LeadForm({ type, pagePath, notice, listingRef, defaults = {}, initialErrors = {}, thanksPath }: LeadFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [busy, setBusy] = useState(false);
  const [general, setGeneral] = useState<string | null>(initialErrors._general ?? null);
  const id = (name: string) => `lead-${type}-${name}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setGeneral(null);
    const body = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([k, v]) => [k, String(v)]));
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { ok?: boolean; errors?: Record<string, string>; error?: string };
      if (res.ok && data.ok) {
        router.push(thanksPath);
        return;
      }
      setErrors(data.errors ?? {});
      setGeneral(data.error ?? (data.errors ? "Revisá los campos marcados." : "No pudimos enviar tu consulta. Probá de nuevo."));
    } catch {
      setGeneral("Se cortó la conexión. Tu consulta no se envió: probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function input(f: FieldDef) {
    const err = errors[f.name];
    const describedBy = [err ? `${id(f.name)}-error` : null, "hint" in f && f.hint ? `${id(f.name)}-hint` : null].filter(Boolean).join(" ") || undefined;
    const common = { id: id(f.name), name: f.name, "aria-invalid": err ? true : undefined, "aria-describedby": describedBy };
    let control: React.ReactNode;
    if (f.kind === "select") {
      control = (
        <select {...common} defaultValue={defaults[f.name] ?? ""} className={field}>
          <option value="">Elegí una opción</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    } else if (f.kind === "radio") {
      return (
        <fieldset key={f.name} className="flex flex-col gap-1" aria-describedby={describedBy}>
          <legend className="font-medium">{f.label}</legend>
          {f.options.map((o) => (
            <label key={o.value} className="flex min-h-11 items-center gap-2">
              <input type="radio" name={f.name} value={o.value} defaultChecked={defaults[f.name] === o.value} className={`h-5 w-5 ${focusRing}`} />
              {o.label}
            </label>
          ))}
          {err ? (
            <p id={`${id(f.name)}-error`} className="text-sm text-red-800">
              {err}
            </p>
          ) : null}
        </fieldset>
      );
    } else if (f.kind === "textarea") {
      control = <textarea {...common} rows={3} defaultValue={defaults[f.name] ?? ""} className={`${field} py-2`} />;
    } else {
      control = (
        <input
          {...common}
          type={f.kind === "number" ? "text" : f.kind}
          inputMode={f.kind === "number" ? "numeric" : f.kind === "tel" ? "tel" : undefined}
          required={"required" in f && f.required ? true : undefined}
          autoComplete={"autoComplete" in f ? f.autoComplete : undefined}
          placeholder={"placeholder" in f ? f.placeholder : undefined}
          defaultValue={defaults[f.name] ?? ""}
          className={field}
        />
      );
    }
    return (
      <div key={f.name} className="flex flex-col gap-1">
        <label htmlFor={id(f.name)} className="font-medium">
          {f.label}
          {"required" in f && f.required ? " (obligatorio)" : ""}
        </label>
        {control}
        {"hint" in f && f.hint ? (
          <p id={`${id(f.name)}-hint`} className="text-sm text-neutral-700">
            {f.hint}
          </p>
        ) : null}
        {err ? (
          <p id={`${id(f.name)}-error`} className="text-sm text-red-800">
            {err}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form method="post" action="/api/leads" onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="tipo" value={type} />
      <input type="hidden" name="pagina" value={pagePath} />
      {listingRef ? <input type="hidden" name="aviso" value={listingRef} /> : null}
      {/* Honeypot: fuera de pantalla y fuera del orden de tabulación. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor={id("website")}>No completar</label>
        <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {general ? (
        <p role="alert" className="rounded border border-red-800 bg-red-50 p-3 text-red-900">
          {general}
        </p>
      ) : null}
      {FORM_FIELDS[type].map(input)}
      {notice ? <p className="text-sm text-neutral-800">{notice}</p> : null}
      <button type="submit" disabled={busy} className={`${primaryButton} self-start disabled:opacity-70`}>
        {busy ? "Enviando…" : SUBMIT_LABEL}
      </button>
    </form>
  );
}
