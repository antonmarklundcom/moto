"use client";

import { useState } from "react";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

/** Copia el texto del `<textarea id={targetId}>` al portapapeles. */
export function CopyButton({ targetId, label }: { targetId: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    const area = document.getElementById(targetId) as HTMLTextAreaElement | null;
    if (!area) return;
    try {
      await navigator.clipboard.writeText(area.value);
    } catch {
      // Sin permiso de portapapeles: se selecciona para copiar a mano.
      area.select();
      document.execCommand("copy");
    }
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }
  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={copy} className={`min-h-11 rounded bg-blue-800 px-4 font-medium text-white ${focus}`}>
        {label}
      </button>
      <span role="status" aria-live="polite">
        {done ? "Copiado." : ""}
      </span>
    </span>
  );
}
