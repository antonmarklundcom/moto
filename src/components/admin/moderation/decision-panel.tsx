"use client";

import { useEffect, useRef, useState } from "react";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const btn = `min-h-11 rounded px-4 font-medium ${focus} disabled:opacity-70`;

export type ReasonOption = { code: string; label: string; text: string };

type Result = { ok: true; status: string; message: string; privateLink: boolean } | { ok: false; error: string };

/**
 * Decisión sobre una publicación de la cola, con los atajos de ADMIN_SPEC §3:
 * A aprobar · R rechazar · 1–9 motivo · S saltar · E editar · D duplicados.
 * El mensaje para el vendedor (con el enlace privado G-1 si es particular) se
 * muestra una sola vez, acá, para copiarlo.
 */
export function DecisionPanel({
  listingId,
  reasons,
  modelOptions,
  suggestion,
  nextHref,
  editHref,
}: {
  listingId: number;
  reasons: ReasonOption[];
  modelOptions: Array<{ id: number; name: string }>;
  suggestion: string | null;
  nextHref: string;
  editHref: string;
}) {
  const [code, setCode] = useState<string>("");
  const [text, setText] = useState("");
  const [modelId, setModelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const rejectRef = useRef<HTMLFieldSetElement>(null);
  const approveRef = useRef<HTMLButtonElement>(null);

  function pick(c: string) {
    setCode(c);
    setText(reasons.find((r) => r.code === c)?.text ?? "");
  }

  async function send(action: "approve" | "reject") {
    setBusy(true);
    try {
      const res = await fetch("/admin/moderacion/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action, listingId, modelId: modelId || null } : { action, listingId, code, text }),
      });
      setResult((await res.json()) as Result);
    } catch {
      setResult({ ok: false, error: "Se cortó la conexión. Probá de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (result?.ok) return;
      const k = e.key.toLowerCase();
      if (k === "a") approveRef.current?.click();
      else if (k === "r") rejectRef.current?.querySelector<HTMLInputElement>("input")?.focus();
      else if (k === "s") window.location.href = nextHref;
      else if (k === "e") window.location.href = editHref;
      else if (k === "d") {
        const d = document.getElementById("duplicados") as HTMLDetailsElement | null;
        if (d) {
          d.open = !d.open;
          d.scrollIntoView({ block: "nearest" });
        }
      } else if (/^[1-9]$/.test(k) && reasons[Number(k) - 1]) pick(reasons[Number(k) - 1].code);
      else if (k === "arrowright" || k === "arrowleft") {
        document.getElementById("fotos")?.scrollBy({ left: k === "arrowright" ? 400 : -400, behavior: "smooth" });
      } else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (result?.ok) {
    return (
      <section aria-labelledby="resultado" className="flex flex-col gap-2 rounded border border-green-800 bg-green-50 p-3">
        <h2 id="resultado" className="font-bold">
          {result.status === "published" ? "Publicada" : "Rechazada"}
        </h2>
        {result.privateLink ? (
          <p role="alert" className="font-medium text-amber-900">
            El enlace privado se muestra una sola vez: copiá el mensaje ahora y mandáselo al vendedor.
          </p>
        ) : null}
        <label htmlFor="mensaje-vendedor" className="font-medium">
          Mensaje para el vendedor (WhatsApp)
        </label>
        <textarea id="mensaje-vendedor" readOnly rows={8} value={result.message} className={`rounded border border-gray-500 p-2 text-sm ${focus}`} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${btn} bg-blue-800 text-white`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.message);
              } catch {
                (document.getElementById("mensaje-vendedor") as HTMLTextAreaElement | null)?.select();
                document.execCommand("copy");
              }
              setCopied(true);
            }}
          >
            Copiar mensaje
          </button>
          <a href={nextHref} className={`${btn} inline-flex items-center border border-gray-500`}>
            Siguiente en la cola
          </a>
          <span role="status">{copied ? "Copiado." : ""}</span>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {modelOptions.length ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="mapear-modelo" className="font-medium">
            Modelo escrito a mano{suggestion ? `: «${suggestion}»` : ""}. Mapealo al catálogo para poder publicar
          </label>
          <select id="mapear-modelo" value={modelId} onChange={(e) => setModelId(e.target.value)} className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
            <option value="">Elegí el modelo</option>
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="text-sm">¿No está en la lista? Agregalo en Catálogo y volvé.</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button ref={approveRef} type="button" disabled={busy} onClick={() => send("approve")} className={`${btn} bg-green-800 text-white`}>
          Aprobar <kbd className="ml-1 text-xs">A</kbd>
        </button>
        <a href={nextHref} className={`${btn} inline-flex items-center border border-gray-500`}>
          Saltar <kbd className="ml-1 text-xs">S</kbd>
        </a>
        <a href={editHref} className={`${btn} inline-flex items-center border border-gray-500`}>
          Editar <kbd className="ml-1 text-xs">E</kbd>
        </a>
      </div>
      <fieldset ref={rejectRef} className="flex flex-col gap-1 rounded border border-gray-400 p-3">
        <legend className="px-1 font-medium">
          Rechazar <kbd className="text-xs">R</kbd>: motivo
        </legend>
        {reasons.map((r, i) => (
          <label key={r.code} className="flex min-h-11 items-center gap-2">
            <input type="radio" name="motivo" value={r.code} checked={code === r.code} onChange={() => pick(r.code)} className={`h-5 w-5 ${focus}`} />
            {i < 9 ? <kbd className="text-xs">{i + 1}</kbd> : null} {r.label}
          </label>
        ))}
        <label htmlFor="texto-rechazo" className="mt-2 font-medium">
          Aviso para el vendedor (editable)
        </label>
        <textarea id="texto-rechazo" rows={4} value={text} onChange={(e) => setText(e.target.value)} className={`rounded border border-gray-500 p-2 ${focus}`} />
        <button type="button" disabled={busy || !code} onClick={() => send("reject")} className={`${btn} mt-2 self-start bg-red-800 text-white`}>
          Rechazar
        </button>
      </fieldset>
      {result && !result.ok ? (
        <p role="alert" className="text-red-800">
          {result.error}
        </p>
      ) : null}
    </div>
  );
}
