"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { focusRing, primaryButton, secondaryButton } from "@/components/public/styles";
import { PhotoUploader, type UploadedPhoto } from "./photo-uploader";
import { DRAFT_STORAGE_KEY, FIELD_STEP, initialPublishState, type PublishState } from "./state";
import { DOCUMENTATION_OPTIONS, MIN_DESCRIPTION, OTHER_MODEL, type PublishCatalog } from "./validate";

// /publicar (T-107). Sin JS: un formulario largo con los 5 pasos a la vista y
// envío común (server action). Con JS: de a un paso, autoguardado en
// localStorage en cada cambio, modelo dependiente de la marca y fotos.

const field = `min-h-11 w-full rounded border border-neutral-500 bg-white px-3 ${focusRing}`;
const STEPS = ["Fotos", "La moto", "Precio", "Contacto", "Descripción"];

type Saved = { values: Record<string, string>; draftToken: string; photos: UploadedPhoto[]; step: number };

export function PublishForm({ catalog, action }: { catalog: PublishCatalog; action: (prev: PublishState, form: FormData) => Promise<PublishState> }) {
  const [state, run, pending] = useActionState(action, initialPublishState);
  const [step, setStep] = useState<number | null>(null); // null = sin JS (todo visible)
  const [values, setValues] = useState<Record<string, string>>({});
  const [draftToken, setDraftToken] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const restored = useRef(false);

  // Restaurar el borrador al montar (y activar el modo por pasos).
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? "null") as Saved | null;
      if (saved) {
        setValues(saved.values ?? {});
        setDraftToken(saved.draftToken ?? "");
        setPhotos((saved.photos ?? []).filter((p) => p.status === "done"));
        setStep(saved.step ?? 1);
        return;
      }
    } catch {
      /* sin almacenamiento: se sigue sin autoguardado */
    }
    setStep(1);
  }, []);

  // Lo que volvió del servidor (error) pisa lo local y lleva al primer paso con error.
  useEffect(() => {
    if (state.version === 0) return;
    setValues(state.values);
    const first = Object.keys(state.errors).map((k) => FIELD_STEP[k] ?? 1).sort()[0];
    if (first) setStep(first);
  }, [state]);

  // Autoguardado en cada cambio.
  useEffect(() => {
    if (step === null) return;
    try {
      const done = photos.filter((p) => p.status === "done");
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ values, draftToken, photos: done, step } satisfies Saved));
    } catch {
      /* lleno o bloqueado */
    }
  }, [values, draftToken, photos, step]);

  const v = (name: string) => values[name] ?? state.values[name] ?? "";
  const set = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const t = e.target as HTMLInputElement;
    const value = t.type === "checkbox" ? (t.checked ? "1" : "") : t.value;
    setValues((prev) => ({ ...prev, [name]: value }));
  };
  const err = (name: string) =>
    state.errors[name] ? (
      <p id={`err-${name}`} className="text-sm text-red-800">
        {state.errors[name]}
      </p>
    ) : null;
  const aria = (name: string) => (state.errors[name] ? { "aria-invalid": true, "aria-describedby": `err-${name}` } : {});
  const brandId = Number(v("marca")) || null;
  const modelsForBrand = useMemo(() => catalog.models.filter((m) => m.brandId === brandId), [catalog.models, brandId]);
  const condition = v("condicion");
  const show = (n: number) => step === null || step === n;
  const photoIds = photos.filter((p) => p.status === "done" && p.id).map((p) => p.id);
  const descLen = v("descripcion").trim().length;

  return (
    <form ref={formRef} action={run} noValidate className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="draftToken" value={draftToken} />
      <input type="hidden" name="fotos" value={photoIds.join(",")} />
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor="pub-website">No completar</label>
        <input id="pub-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {step !== null ? (
        <p className="text-sm font-medium" aria-live="polite">
          Paso {step} de {STEPS.length}: {STEPS[step - 1]}
        </p>
      ) : null}
      {state.message ? (
        <p role="alert" className="rounded border border-red-800 bg-red-50 p-3 text-red-900">
          {state.message}
        </p>
      ) : null}

      <fieldset hidden={!show(1)} className="flex flex-col gap-3">
        <legend className="text-lg font-semibold">1. Fotos</legend>
        {step === null ? (
          <p className="rounded border border-amber-700 bg-amber-50 p-3 text-sm">
            Para subir fotos hace falta JavaScript. Podés enviar la publicación igual y mandarnos las fotos por WhatsApp: sin fotos no la podemos publicar.
          </p>
        ) : (
          <PhotoUploader draftToken={draftToken} onDraftToken={setDraftToken} photos={photos} onPhotos={setPhotos} error={state.errors.fotos} />
        )}
      </fieldset>

      <fieldset hidden={!show(2)} className="flex flex-col gap-3">
        <legend className="text-lg font-semibold">2. La moto</legend>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Marca</span>
          <select name="marca" value={v("marca")} onChange={set("marca")} className={field} {...aria("marca")}>
            <option value="">Elegí la marca</option>
            {catalog.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {err("marca")}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Modelo</span>
          <select name="modelo" value={v("modelo")} onChange={set("modelo")} className={field} {...aria("modelo")}>
            <option value="">Elegí el modelo</option>
            {step === null
              ? catalog.brands.map((b) => (
                  <optgroup key={b.id} label={b.name}>
                    {catalog.models
                      .filter((m) => m.brandId === b.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </optgroup>
                ))
              : modelsForBrand.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            <option value={OTHER_MODEL}>No encuentro mi modelo</option>
          </select>
          {err("modelo")}
        </label>
        {step === null || v("modelo") === OTHER_MODEL ? (
          <label className="flex flex-col gap-1">
            <span className="font-medium">Si no está en la lista: escribí el modelo</span>
            <input name="modelo_texto" value={v("modelo_texto")} onChange={set("modelo_texto")} className={field} {...aria("modelo_texto")} />
            {err("modelo_texto")}
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="font-medium">Tipo</span>
          <select name="categoria" value={v("categoria")} onChange={set("categoria")} className={field} {...aria("categoria")}>
            <option value="">Elegí el tipo</option>
            {catalog.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {err("categoria")}
        </label>
        <fieldset className="flex flex-col gap-1" {...aria("condicion")}>
          <legend className="font-medium">Condición</legend>
          {[
            ["used", "Usada"],
            ["new", "0 km"],
          ].map(([val, label]) => (
            <label key={val} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="condicion" value={val} checked={condition === val} onChange={set("condicion")} className={`h-5 w-5 ${focusRing}`} />
              {label}
            </label>
          ))}
          {err("condicion")}
        </fieldset>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Año{condition === "new" ? " (opcional)" : ""}</span>
            <input name="anio" inputMode="numeric" value={v("anio")} onChange={set("anio")} className={field} {...aria("anio")} />
            {err("anio")}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Kilómetros</span>
            <input name="km" inputMode="numeric" value={v("km")} onChange={set("km")} className={field} {...aria("km")} />
            {err("km")}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Cilindrada (cc)</span>
            <input name="cc" inputMode="numeric" value={v("cc")} onChange={set("cc")} className={field} {...aria("cc")} />
            {err("cc")}
          </label>
        </div>
        {step === null || condition !== "new" ? (
          <label className="flex flex-col gap-1">
            <span className="font-medium">Papeles (usadas)</span>
            <select name="documentacion" value={v("documentacion")} onChange={set("documentacion")} className={field} {...aria("documentacion")}>
              <option value="">Elegí una opción</option>
              {DOCUMENTATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {err("documentacion")}
          </label>
        ) : null}
      </fieldset>

      <fieldset hidden={!show(3)} className="flex flex-col gap-3">
        <legend className="text-lg font-semibold">3. Precio</legend>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Precio de contado (Gs.)</span>
          <input name="precio" inputMode="numeric" placeholder="12.500.000" value={v("precio")} onChange={set("precio")} className={field} {...aria("precio")} />
          {err("precio")}
        </label>
        <p className="text-sm text-neutral-700">¿La vendés en cuotas? Completá esto también (opcional).</p>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Entrega (Gs.)</span>
            <input name="entrega" inputMode="numeric" value={v("entrega")} onChange={set("entrega")} className={field} {...aria("entrega")} />
            {err("entrega")}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Cuota (Gs.)</span>
            <input name="cuota" inputMode="numeric" value={v("cuota")} onChange={set("cuota")} className={field} {...aria("cuota")} />
            {err("cuota")}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Cuotas</span>
            <input name="cuotas" inputMode="numeric" value={v("cuotas")} onChange={set("cuotas")} className={field} {...aria("cuotas")} />
            {err("cuotas")}
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="negociable" value="1" checked={v("negociable") === "1"} onChange={set("negociable")} className={`h-5 w-5 ${focusRing}`} />
          El precio es negociable
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="permuta" value="1" checked={v("permuta") === "1"} onChange={set("permuta")} className={`h-5 w-5 ${focusRing}`} />
          Recibo permuta
        </label>
      </fieldset>

      <fieldset hidden={!show(4)} className="flex flex-col gap-3">
        <legend className="text-lg font-semibold">4. Contacto</legend>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Ciudad</span>
          <select name="ciudad" value={v("ciudad")} onChange={set("ciudad")} className={field} {...aria("ciudad")}>
            <option value="">Elegí tu ciudad</option>
            {catalog.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {err("ciudad")}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Teléfono</span>
          <input name="telefono" type="tel" inputMode="tel" autoComplete="tel" placeholder="0981 123 456" value={v("telefono")} onChange={set("telefono")} className={field} {...aria("telefono")} />
          {err("telefono")}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="solo_llamadas" value="1" checked={v("solo_llamadas") === "1"} onChange={set("solo_llamadas")} className={`h-5 w-5 ${focusRing}`} />
          Sólo llamadas (no tengo WhatsApp en este número)
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Tu nombre (opcional)</span>
          <input name="nombre" autoComplete="given-name" value={v("nombre")} onChange={set("nombre")} className={field} />
        </label>
        <p className="text-sm text-neutral-700">Tu número no se muestra en la página: los compradores te escriben con el botón de WhatsApp.</p>
      </fieldset>

      <fieldset hidden={!show(5)} className="flex flex-col gap-3">
        <legend className="text-lg font-semibold">5. Descripción</legend>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Contá cómo está la moto</span>
          <textarea name="descripcion" rows={6} value={v("descripcion")} onChange={set("descripcion")} className={`${field} py-2`} {...aria("descripcion")} />
          <span className="text-sm text-neutral-700">
            Contá el estado, si tiene los papeles al día, qué le cambiaste y por qué la vendés. {descLen < MIN_DESCRIPTION ? `Faltan ${MIN_DESCRIPTION - descLen} caracteres.` : "¡Bien!"}
          </span>
          {err("descripcion")}
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        {step !== null && step > 1 ? (
          <button type="button" onClick={() => setStep(step - 1)} className={secondaryButton}>
            ← Anterior
          </button>
        ) : null}
        {/* `key` distinto: si React reusa el mismo <button> y le cambia el type
            a "submit" durante el clic de "Siguiente" del paso 4, el navegador
            envía el formulario incompleto. */}
        {step !== null && step < STEPS.length ? (
          <button key="next" type="button" onClick={() => setStep(step + 1)} className={primaryButton}>
            Siguiente →
          </button>
        ) : (
          <button key="submit" type="submit" disabled={pending || photos.some((p) => p.status === "uploading")} className={`${primaryButton} disabled:opacity-70`}>
            {pending ? "Enviando…" : "Publicá tu moto gratis"}
          </button>
        )}
      </div>
    </form>
  );
}
