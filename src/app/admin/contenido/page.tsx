import Link from "next/link";
import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { siteIndexingMode } from "@/lib/env";
import { countWords } from "@/lib/seo/indexability";
import { getPost, INTRO_KINDS, INTRO_LABEL, type IntroKind, listIntroRows, listPosts, reviewerOptions } from "./_lib/content-admin";
import { IndicatorText, IntroEditor } from "./_lib/intro-editor";
import { PostEditor } from "./_lib/post-editor";
import { hasPendingVerification } from "./_lib/sanitize";

// Contenido (ADMIN_SPEC §9): guías y textos de las páginas del catálogo.
const section = adminSection("contenido");
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const tabClass = (on: boolean) => `inline-flex min-h-11 items-center rounded border px-3 ${on ? "border-blue-800 bg-blue-50 font-bold" : "border-gray-400"} ${focus}`;
const STATUS: Record<string, string> = { draft: "Borrador", review: "En revisión", published: "Publicada" };
const MODE: Record<string, string> = { none: "SITE_NOINDEX=true: nada se indexa todavía", content: "SITE_NOINDEX=content: guías sí, inventario no", rules: "SITE_NOINDEX=false: rige el umbral" };

type Props = { searchParams: Promise<{ tab?: string; tipo?: string; editar?: string; nueva?: string; ok?: string; cargadas?: string; omitidas?: string; error?: string }> };

export default async function Page({ searchParams }: Props) {
  const user = await requirePageRole("/admin/contenido", ...section.roles);
  const q = await searchParams;
  const tab = q.tab === "textos" ? "textos" : "guias";
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <nav aria-label="Contenido" className="flex flex-wrap gap-2">
        <Link href="/admin/contenido" aria-current={tab === "guias" ? "page" : undefined} className={tabClass(tab === "guias")}>
          Guías
        </Link>
        <Link href="/admin/contenido?tab=textos" aria-current={tab === "textos" ? "page" : undefined} className={tabClass(tab === "textos")}>
          Textos de páginas
        </Link>
      </nav>
      <p className="text-sm">Modo de indexación: {MODE[siteIndexingMode()]}.</p>
      {q.error ? <p role="alert" className="text-red-800">{q.error}</p> : null}
      {tab === "guias" ? <Guides q={q} isAdmin={user.role === "admin"} /> : <Texts kind={(INTRO_KINDS as readonly string[]).includes(q.tipo ?? "") ? (q.tipo as IntroKind) : "brand"} editId={Number(q.editar) || null} />}
    </main>
  );
}

async function Guides({ q, isAdmin }: { q: Awaited<Props["searchParams"]>; isAdmin: boolean }) {
  const [rows, reviewers] = await Promise.all([listPosts(), reviewerOptions()]);
  const editId = Number(q.editar) || null;
  const editing = editId ? await getPost(editId) : null;
  return (
    <>
      {q.ok ? <p role="status" className="text-green-900">Guardado.</p> : null}
      {q.cargadas !== undefined ? (
        <p role="status" className="text-green-900">
          Borradores cargados: {q.cargadas}. Ya existían: {q.omitidas ?? 0}.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/contenido?nueva=1" className={`inline-flex min-h-11 items-center rounded border border-gray-500 px-3 ${focus}`}>
          Nueva guía
        </Link>
        {isAdmin ? (
          <form action="/admin/contenido/cargar" method="post">
            <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
              Cargar borradores de content/guias
            </button>
          </form>
        ) : null}
      </div>
      {editing || q.nueva ? (
        <section aria-labelledby="editor" className="flex flex-col gap-2">
          <h2 id="editor" className="text-xl font-bold">{editing ? `Editar: ${editing.title}` : "Nueva guía"}</h2>
          <PostEditor
            key={editing?.id ?? "new"}
            reviewers={reviewers}
            post={{
              id: editing?.id ?? null,
              title: editing?.title ?? "",
              slug: editing?.slug ?? "",
              excerpt: editing?.excerpt ?? "",
              bodyHtml: editing?.bodyHtml ?? "",
              metaTitle: editing?.metaTitle ?? "",
              metaDescription: editing?.metaDescription ?? "",
              status: editing?.status ?? "draft",
              reviewedBy: editing?.reviewedBy ?? null,
              published: Boolean(editing?.publishedAt),
            }}
          />
        </section>
      ) : null}
      <table className="w-full border-collapse text-left text-sm">
        <caption className="text-left font-bold">Guías ({rows.length})</caption>
        <thead>
          <tr className="border-b">
            <th className="p-2">Título</th>
            <th className="p-2">Estado</th>
            <th className="p-2">Palabras</th>
            <th className="p-2">[VERIFICAR]</th>
            <th className="p-2">Actualizada</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2">
                <Link href={`/admin/contenido?editar=${r.id}`} className={`underline ${focus}`}>
                  {r.title}
                </Link>
              </td>
              <td className="p-2">{STATUS[r.status] ?? r.status}</td>
              <td className="p-2">{countWords(r.bodyHtml)}</td>
              <td className="p-2">{hasPendingVerification(r.bodyHtml) ? "Sí: no se puede publicar" : "No"}</td>
              <td className="p-2">{r.updatedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

async function Texts({ kind, editId }: { kind: IntroKind; editId: number | null }) {
  const rows = await listIntroRows(kind);
  const editing = editId ? rows.find((r) => r.id === editId) : undefined;
  return (
    <>
      <nav aria-label="Tipo de página" className="flex flex-wrap gap-2">
        {INTRO_KINDS.map((k) => (
          <Link key={k} href={`/admin/contenido?tab=textos&tipo=${k}`} aria-current={k === kind ? "page" : undefined} className={tabClass(k === kind)}>
            {INTRO_LABEL[k]}
          </Link>
        ))}
      </nav>
      <p className="max-w-prose text-sm">
        Una página se indexa sólo si tiene las publicaciones vivas mínimas <strong>y</strong> el texto propio mínimo (SEO_ARCHITECTURE §2.1). Por debajo queda en noindex y fuera del sitemap, sola.
      </p>
      {editing ? (
        <section aria-labelledby="intro-editor" className="flex flex-col gap-2">
          <h2 id="intro-editor" className="text-xl font-bold">Texto de {editing.name}</h2>
          <IntroEditor key={editing.id} kind={kind} id={editing.id} name={editing.name} html={editing.introHtml ?? ""} live={editing.live} words={editing.words} indicator={editing.indicator} />
        </section>
      ) : null}
      <table className="w-full border-collapse text-left text-sm">
        <caption className="text-left font-bold">{INTRO_LABEL[kind]}</caption>
        <thead>
          <tr className="border-b">
            <th className="p-2">Página</th>
            <th className="p-2">Indexable</th>
            <th className="p-2">Editar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2">{r.url ? <a href={r.url} className={`underline ${focus}`}>{r.name}</a> : r.name}</td>
              <td className="p-2">
                <IndicatorText indicator={r.indicator} live={r.live} words={r.words} />
              </td>
              <td className="p-2">
                <Link href={`/admin/contenido?tab=textos&tipo=${kind}&editar=${r.id}`} className={`underline ${focus}`}>
                  Editar texto
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
