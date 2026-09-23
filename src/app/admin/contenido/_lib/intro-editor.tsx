"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IntroIndicator } from "./indicator";

// Editor de intro_html con el indicador de indexabilidad. El conteo mientras
// se escribe es aproximado; el veredicto lo da el servidor al guardar
// (`isIndexable()` de A2, la misma regla que usan las páginas y el sitemap).
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

function roughWords(html: string): number {
  return html
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

export function IndicatorText({ indicator, live, words }: { indicator: IntroIndicator; live: number; words: number }) {
  return (
    <span>
      {indicator.meetsThreshold ? (
        <strong className="text-green-900">Cumple el umbral</strong>
      ) : (
        <strong className="text-red-800">No cumple: noindex</strong>
      )}{" "}
      ({live}/{indicator.minLive} vivas, {words}/{indicator.minWords} palabras)
      {indicator.meetsThreshold && !indicator.indexableNow ? " · hoy noindex por SITE_NOINDEX" : ""}
    </span>
  );
}

export function IntroEditor(props: { kind: string; id: number; name: string; html: string; live: number; words: number; indicator: IntroIndicator }) {
  const router = useRouter();
  const [html, setHtml] = useState(props.html);
  const [state, setState] = useState({ words: props.words, indicator: props.indicator });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/contenido/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: props.kind, id: props.id, html }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; words?: number; indicator?: IntroIndicator };
      if (data.ok && data.indicator) {
        setState({ words: data.words ?? 0, indicator: data.indicator });
        setMessage({ ok: true, text: "Guardado. Ya se ve en la página." });
        router.refresh();
      } else setMessage({ ok: false, text: data.error ?? "No se pudo guardar." });
    } catch {
      setMessage({ ok: false, text: "No se pudo guardar. Probá de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <p role="status" aria-live="polite">
        Indicador (guardado): <IndicatorText indicator={state.indicator} live={props.live} words={state.words} />
      </p>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Texto de la página de {props.name} (HTML)</span>
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={14} className={`w-full rounded border border-gray-500 p-2 font-mono text-sm ${focus}`} />
      </label>
      <p className="text-sm text-gray-700">
        Mientras escribís: ≈ {roughWords(html)} palabras (mínimo {state.indicator.minWords}). Se publica al guardar; tiene que ser texto propio, específico y revisado.
      </p>
      {message ? <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-green-900" : "text-red-800"}>{message.text}</p> : null}
      <button type="button" onClick={() => void save()} disabled={busy} className={`min-h-11 self-start rounded bg-blue-800 px-4 font-bold text-white disabled:opacity-70 ${focus}`}>
        {busy ? "Guardando…" : "Guardar texto"}
      </button>
    </div>
  );
}
