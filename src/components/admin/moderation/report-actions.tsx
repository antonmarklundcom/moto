"use client";

import { useState } from "react";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const btn = `min-h-11 rounded px-4 font-medium ${focus} disabled:opacity-70`;

/** Descartar / pausar / dar de baja una denuncia, con nota obligatoria (ADMIN_SPEC §10). */
export function ReportActions({ reportId, listingLive }: { reportId: number; listingLive: boolean }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(action: "dismiss" | "pause" | "takedown") {
    if (action === "takedown" && !window.confirm("¿Dar de baja la publicación? Deja de verse en el sitio.")) return;
    setBusy(true);
    try {
      const res = await fetch("/admin/denuncias/resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action, note }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; resolved?: number };
      setMsg(data.ok ? { ok: true, text: `Listo: ${data.resolved} denuncia(s) resuelta(s).` } : { ok: false, text: data.error ?? "Error" });
      if (data.ok) setTimeout(() => window.location.reload(), 800);
    } catch {
      setMsg({ ok: false, text: "Se cortó la conexión. Probá de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`nota-${reportId}`} className="font-medium">
        Nota de resolución (obligatoria)
      </label>
      <textarea id={`nota-${reportId}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`rounded border border-gray-500 p-2 ${focus}`} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => send("dismiss")} className={`${btn} border border-gray-500`}>
          Descartar
        </button>
        {listingLive ? (
          <button type="button" disabled={busy} onClick={() => send("pause")} className={`${btn} bg-amber-700 text-white`}>
            Pausar la publicación
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => send("takedown")} className={`${btn} bg-red-800 text-white`}>
          Dar de baja
        </button>
      </div>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-green-900" : "text-red-800"}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
