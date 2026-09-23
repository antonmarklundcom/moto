"use client";

import { useRef, useState } from "react";
import type { DealerOption } from "./import-form";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const PHOTO = /\.(jpe?g|png|webp|heic|heif)$/i;

type Result = { file: string; ok: boolean; message: string; ref: string | null };

function naturalCompare(a: string, b: string): number {
  const chunks = (s: string) => s.toLowerCase().match(/\d+|\D+/g) ?? [];
  const x = chunks(a);
  const y = chunks(b);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    if (x[i] === y[i]) continue;
    if (/^\d/.test(x[i]) && /^\d/.test(y[i])) return Number(x[i]) - Number(y[i]) || x[i].length - y[i].length;
    return x[i] < y[i] ? -1 : 1;
  }
  return x.length - y.length;
}

/**
 * Sube las fotos de a una a /admin/importar/fotos, en orden natural de nombre
 * (así `X-2` va antes que `X-10`). Cada una va a la moto cuya referencia
 * encabeza el nombre del archivo.
 */
export function PhotoUploader({ dealers }: { dealers: DealerOption[] }) {
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const dealerRef = useRef<HTMLSelectElement>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const picked = [...(filesRef.current?.files ?? []), ...(folderRef.current?.files ?? [])]
      .filter((f) => PHOTO.test(f.name))
      .sort((a, b) => naturalCompare(a.name, b.name));
    if (picked.length === 0) {
      setProgress("Elegí fotos o una carpeta con fotos.");
      return;
    }
    setBusy(true);
    setResults([]);
    const out: Result[] = [];
    for (const [i, file] of picked.entries()) {
      setProgress(`Subiendo ${i + 1} de ${picked.length}…`);
      const body = new FormData();
      body.set("file", file);
      body.set("name", file.name);
      body.set("comercio", dealerRef.current?.value ?? "");
      try {
        const res = await fetch("/admin/importar/fotos", { method: "POST", body });
        const data = (await res.json()) as { ok?: boolean; message?: string; externalRef?: string | null };
        out.push({ file: file.name, ok: Boolean(data.ok), message: data.message ?? `Error ${res.status}`, ref: data.externalRef ?? null });
      } catch {
        out.push({ file: file.name, ok: false, message: "Se cortó la conexión. Volvé a subir esta foto.", ref: null });
      }
      setResults([...out]);
    }
    const ok = out.filter((r) => r.ok).length;
    setProgress(`Listo: ${ok} de ${picked.length} fotos cargadas.`);
    setBusy(false);
  }

  return (
    <form onSubmit={upload} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="fotos-comercio" className="font-medium">
          Comercio
        </label>
        <select id="fotos-comercio" ref={dealerRef} className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`} defaultValue="">
          <option value="">Cualquiera (la referencia tiene que ser única)</option>
          {dealers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="fotos-archivos" className="font-medium">
          Fotos
        </label>
        <input id="fotos-archivos" ref={filesRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className={`min-h-11 ${focus}`} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="fotos-carpeta" className="font-medium">
          O una carpeta entera
        </label>
        <input
          id="fotos-carpeta"
          ref={folderRef}
          type="file"
          multiple
          // @ts-expect-error: atributo no estándar, soportado por Chrome, Edge, Firefox y Safari.
          webkitdirectory=""
          className={`min-h-11 ${focus}`}
        />
      </div>
      <button type="submit" disabled={busy} className={`min-h-11 self-start rounded bg-blue-800 px-4 font-medium text-white ${focus} disabled:opacity-70`}>
        {busy ? "Subiendo…" : "Subir fotos"}
      </button>
      <p role="status" aria-live="polite">
        {progress}
      </p>
      {results.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {results.map((r) => (
            <li key={r.file} className={r.ok ? "" : "text-red-800"}>
              <span className="font-mono">{r.file}</span>
              {r.ref ? ` → ${r.ref}` : ""}: {r.message}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
