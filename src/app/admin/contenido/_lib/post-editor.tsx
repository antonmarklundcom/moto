"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Editor de guías. Envía a /admin/contenido/guardar; el servidor es quien
// aplica las reglas (revisor obligatorio, sin [VERIFICAR], slug fijo).
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const input = `min-h-11 w-full rounded border border-gray-500 px-2 ${focus}`;

export type EditablePost = {
  id: number | null;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  status: string;
  reviewedBy: number | null;
  published: boolean;
};

export function PostEditor({ post, reviewers }: { post: EditablePost; reviewers: Array<{ id: number; name: string }> }) {
  const router = useRouter();
  const [status, setStatus] = useState(post.status);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const publishing = status === "published";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/contenido/guardar", { method: "POST", body: new FormData(e.currentTarget) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: number; errors?: Record<string, string>; error?: string };
      if (data.ok && data.id) {
        setErrors({});
        router.push(`/admin/contenido?editar=${data.id}&ok=1`);
        router.refresh();
        return;
      }
      setErrors(data.errors ?? {});
      setMessage(data.error ?? (res.status === 400 ? "No se puede publicar así." : "Revisá los campos marcados."));
    } catch {
      setMessage("No se pudo guardar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => (errors[k] ? <p id={`err-${k}`} className="text-sm text-red-800">{errors[k]}</p> : null);
  const aria = (k: string) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `err-${k}` } : {});

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-3">
      <input type="hidden" name="id" value={post.id ?? ""} />
      {message ? <p role="alert" className="rounded border border-red-800 bg-red-50 p-2 text-red-900">{message}</p> : null}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Título (es el h1 de la guía)</span>
        <input name="title" defaultValue={post.title} className={input} {...aria("title")} />
        {err("title")}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Slug</span>
        <input name="slug" defaultValue={post.slug} readOnly={post.published} className={input} {...aria("slug")} />
        <span className="text-sm text-gray-700">{post.published ? "Ya se publicó: la URL no cambia." : "Vacío = se arma con el título."}</span>
        {err("slug")}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Resumen (aparece en el listado de guías)</span>
        <textarea name="excerpt" rows={2} defaultValue={post.excerpt} className={`${input} py-1`} {...aria("excerpt")} />
        {err("excerpt")}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Texto (HTML: p, h2, h3, ul, ol, li, strong, em, a, blockquote)</span>
        <textarea name="bodyHtml" rows={18} defaultValue={post.bodyHtml} className={`${input} py-1 font-mono text-sm`} {...aria("bodyHtml")} />
        <span className="text-sm text-gray-700">Se limpia al guardar: cualquier otra etiqueta o atributo se descarta.</span>
        {err("bodyHtml")}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Título para Google (opcional)</span>
        <input name="metaTitle" defaultValue={post.metaTitle} className={input} {...aria("metaTitle")} />
        {err("metaTitle")}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Descripción para Google (hasta 160)</span>
        <input name="metaDescription" defaultValue={post.metaDescription} maxLength={160} className={input} {...aria("metaDescription")} />
        {err("metaDescription")}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Estado</span>
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="draft">Borrador</option>
          <option value="review">En revisión</option>
          <option value="published">Publicada</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Revisada por{publishing ? " (obligatorio para publicar)" : ""}</span>
        <select name="reviewedBy" defaultValue={post.reviewedBy ?? ""} required={publishing} className={input} {...aria("reviewedBy")}>
          <option value="">Sin revisar</option>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-700">Quien revisa confirma que no hay datos inventados, que el español es paraguayo y que no quedan [VERIFICAR] (CONTENT_STRATEGY §1.7).</span>
        {err("reviewedBy")}
      </label>
      <button type="submit" disabled={busy} className={`min-h-11 self-start rounded bg-blue-800 px-4 font-bold text-white disabled:opacity-70 ${focus}`}>
        {busy ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
