"use client";

import { useEffect, useRef, useState } from "react";
import { focusRing, secondaryButton } from "@/components/public/styles";

// Paso 1 (PRODUCT_SPEC §2.2): fotos primero. Se comprimen en el navegador
// (lado mayor 1600 px, JPEG 0,8) y se suben de a una a /api/uploads (A3) con
// el token del borrador, con progreso y reintento por foto. Sin JS no hay
// subida: el formulario lo avisa y el resto se puede enviar igual.

export type UploadedPhoto = { key: string; name: string; id?: number; url?: string; status: "uploading" | "done" | "error"; error?: string };

const MAX_PHOTOS = 20;
const MAX_SIDE = 1600;

async function compress(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // El navegador no la puede leer (p. ej. HEIC): se manda tal cual y el servidor decide.
    return file;
  }
}

export function PhotoUploader({
  draftToken,
  onDraftToken,
  photos,
  onPhotos,
  error,
}: {
  draftToken: string;
  onDraftToken: (t: string) => void;
  photos: UploadedPhoto[];
  onPhotos: (update: (prev: UploadedPhoto[]) => UploadedPhoto[]) => void;
  error?: string;
}) {
  const files = useRef(new Map<string, File>());
  const tokenRef = useRef(draftToken);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    tokenRef.current = draftToken;
  }, [draftToken]);

  async function upload(key: string) {
    const file = files.current.get(key);
    if (!file) return;
    onPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, status: "uploading", error: undefined } : p)));
    try {
      const body = new FormData();
      body.set("file", await compress(file), file.name.replace(/\.\w+$/, ".jpg"));
      if (tokenRef.current) body.set("draftToken", tokenRef.current);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = (await res.json()) as { id?: number; url?: string; draftToken?: string; message?: string };
      if (!res.ok || !data.id) throw new Error(data.message ?? "No se pudo subir.");
      if (data.draftToken && data.draftToken !== tokenRef.current) {
        tokenRef.current = data.draftToken;
        onDraftToken(data.draftToken);
      }
      files.current.delete(key);
      onPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, id: data.id, url: data.url, status: "done" } : p)));
    } catch (e) {
      onPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, status: "error", error: e instanceof Error ? e.message : "No se pudo subir." } : p)));
    }
  }

  async function add(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = [...list].slice(0, Math.max(0, room));
    const added = picked.map((f, i) => {
      const key = `${Date.now()}-${i}-${f.name}`;
      files.current.set(key, f);
      return { key, name: f.name, status: "uploading" as const };
    });
    onPhotos((prev) => [...prev, ...added]);
    setBusy(true);
    // De a una: con datos móviles, en paralelo se cortan todas.
    for (const a of added) await upload(a.key);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Elegí fotos de tu moto (hasta {MAX_PHOTOS})</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          disabled={photos.length >= MAX_PHOTOS}
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
          className={`min-h-11 ${focusRing}`}
        />
      </label>
      <p className="text-sm text-neutral-700">De frente, de costado, el tablero y el motor, con buena luz. La primera es la portada.</p>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-live="polite">
        {photos.map((p, i) => (
          <li key={p.key} className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded border border-neutral-300 bg-neutral-100 text-xs">
            {p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            ) : (
              <span className="p-1 text-center">{p.status === "uploading" ? "Subiendo…" : p.error}</span>
            )}
            {p.status === "error" ? (
              <button type="button" onClick={() => void upload(p.key)} className={`${secondaryButton} absolute bottom-1 min-h-11 px-2 text-xs`}>
                Reintentar
              </button>
            ) : null}
            <button
              type="button"
              aria-label={`Quitar foto ${i + 1}`}
              onClick={() => onPhotos((prev) => prev.filter((x) => x.key !== p.key))}
              className={`absolute right-1 top-1 min-h-11 min-w-11 rounded bg-white/90 text-base ${focusRing}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {busy ? <p role="status">Subiendo fotos…</p> : null}
    </div>
  );
}
