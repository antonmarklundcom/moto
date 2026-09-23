// Contenido (ADMIN_SPEC §9): guías (`posts`) e `intro_html` del catálogo.
// Reglas en el servidor: publicar exige `reviewed_by` (un admin o moderador
// activo) y ningún `[VERIFICAR]` sin resolver; el slug de una guía publicada
// no cambia; todo HTML se limpia al guardar.
import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { brands, categories, cities, models, posts, users } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import type { SessionUser } from "@/lib/auth/roles";
import { siteIndexingMode } from "@/lib/env";
import { groupLiveCounts, type CountDimension } from "@/lib/listings/query";
import { countWords, type ProgrammaticPageType } from "@/lib/seo/indexability";
import { paths } from "@/lib/seo/routes";
import { isReservedSlug, slugify } from "@/lib/slug";
import { introIndicator, type IntroIndicator } from "./indicator";
import { markdownToHtml, parseGuideFile } from "./markdown";
import { hasPendingVerification, sanitizeHtml } from "./sanitize";

export const CONTENT_ROLES = ["admin", "moderator"] as const;
export const POST_STATUSES = ["draft", "review", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
export const GUIDES_DIR = path.join(process.cwd(), "content", "guias");

export type PostInput = {
  id: number | null;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  status: string;
  reviewedBy: number | null;
};

export type SaveResult =
  | { ok: true; id: number; status: PostStatus }
  | { ok: false; status: 400 | 404 | 422; code: string; errors: Record<string, string> };

function fail(status: 400 | 404 | 422, code: string, errors: Record<string, string>): SaveResult {
  return { ok: false, status, code, errors };
}

export async function reviewerOptions(): Promise<Array<{ id: number; name: string }>> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.isActive, true), inArray(users.role, [...CONTENT_ROLES])))
    .orderBy(asc(users.name));
}

export async function listPosts() {
  return db
    .select({ id: posts.id, slug: posts.slug, title: posts.title, status: posts.status, publishedAt: posts.publishedAt, updatedAt: posts.updatedAt, reviewedBy: posts.reviewedBy, bodyHtml: posts.bodyHtml })
    .from(posts)
    .orderBy(desc(posts.updatedAt));
}

export async function getPost(id: number) {
  const [row] = await db.select().from(posts).where(eq(posts.id, id));
  return row ?? null;
}

export async function savePost(user: SessionUser, input: PostInput, now: Date = new Date()): Promise<SaveResult> {
  if (!(CONTENT_ROLES as readonly string[]).includes(user.role)) return fail(400, "forbidden", { _: "Sin permiso." });
  if (!(POST_STATUSES as readonly string[]).includes(input.status)) return fail(400, "status", { status: "Estado inválido." });
  const status = input.status as PostStatus;
  const errors: Record<string, string> = {};
  const title = input.title.trim();
  if (!title) errors.title = "Poné un título.";
  if (title.length > 255) errors.title = "Máximo 255 caracteres.";
  let slug = "";
  try {
    slug = slugify(input.slug.trim() || title);
  } catch {
    errors.slug = "No se pudo armar el slug.";
  }
  if (slug && (isReservedSlug(slug) || slug.length > 255)) errors.slug = "Slug no permitido.";
  const excerpt = input.excerpt.trim();
  if (excerpt.length > 500) errors.excerpt = "Máximo 500 caracteres.";
  const metaDescription = input.metaDescription.trim();
  if (metaDescription.length > 160) errors.metaDescription = "Máximo 160 caracteres (lo que muestra Google).";
  const metaTitle = input.metaTitle.trim();
  if (metaTitle.length > 255) errors.metaTitle = "Máximo 255 caracteres.";
  const bodyHtml = sanitizeHtml(input.bodyHtml);

  const existing = input.id ? await getPost(input.id) : null;
  if (input.id && !existing) return fail(404, "not_found", { _: "No existe esa guía." });
  if (existing?.publishedAt && existing.slug !== slug) errors.slug = "La guía ya se publicó: su URL no cambia.";
  if (slug && !errors.slug) {
    const [clash] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.slug, slug), existing ? ne(posts.id, existing.id) : undefined));
    if (clash) errors.slug = "Ya hay otra guía con ese slug.";
  }

  if (status === "published") {
    // La regla de ADMIN_SPEC §9: sin revisor no se publica, venga de donde venga el pedido.
    if (!input.reviewedBy) return fail(400, "reviewer_required", { reviewedBy: "Para publicar hace falta quién la revisó." });
    const [reviewer] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.reviewedBy), eq(users.isActive, true), inArray(users.role, [...CONTENT_ROLES])));
    if (!reviewer) return fail(400, "reviewer_invalid", { reviewedBy: "El revisor tiene que ser un admin o moderador activo." });
    if (hasPendingVerification(title, excerpt, metaDescription, bodyHtml)) errors.bodyHtml = "Quedan [VERIFICAR] sin resolver: así no se publica.";
    if (countWords(bodyHtml) < 150) errors.bodyHtml = errors.bodyHtml ?? "La guía es demasiado corta para publicarla.";
  }
  if (Object.keys(errors).length) return fail(422, "invalid", errors);

  const values = {
    title,
    slug,
    excerpt: excerpt || null,
    bodyHtml,
    metaTitle: metaTitle || null,
    metaDescription: metaDescription || null,
    status,
    reviewedBy: status === "published" ? input.reviewedBy : (existing?.reviewedBy ?? null),
    publishedAt: status === "published" ? (existing?.publishedAt ?? now) : (existing?.publishedAt ?? null),
  };
  const id = await db.transaction(async (tx) => {
    if (existing) {
      await tx.update(posts).set(values).where(eq(posts.id, existing.id));
      const action = status === "published" && existing.status !== "published" ? "published" : status !== "published" && existing.status === "published" ? "unpublished" : "updated";
      await logActivity(tx, { userId: user.id, entityType: "post", entityId: existing.id, action, diff: { status: { from: existing.status, to: status }, reviewedBy: values.reviewedBy } });
      return existing.id;
    }
    const [res] = await tx.insert(posts).values({ ...values, authorUserId: user.id });
    await logActivity(tx, { userId: user.id, entityType: "post", entityId: res.insertId, action: status === "published" ? "published" : "created", diff: { status, reviewedBy: values.reviewedBy } });
    return res.insertId;
  });
  return { ok: true, id, status };
}

/**
 * Carga los borradores de `content/guias/*.md` como `posts` en `draft`. Nunca
 * pisa una guía que ya existe (con el mismo slug): las ediciones del admin mandan.
 */
export async function loadGuideDrafts(user: SessionUser, dir: string = GUIDES_DIR): Promise<{ created: string[]; skipped: string[]; failed: string[] }> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const result = { created: [] as string[], skipped: [] as string[], failed: [] as string[] };
  for (const file of files) {
    try {
      const guide = parseGuideFile(await readFile(path.join(dir, file), "utf8"));
      const [exists] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, guide.slug));
      if (exists) {
        result.skipped.push(guide.slug);
        continue;
      }
      const r = await savePost(user, {
        id: null,
        title: guide.title,
        slug: guide.slug,
        excerpt: guide.excerpt ?? "",
        bodyHtml: markdownToHtml(guide.bodyMarkdown),
        metaTitle: "",
        metaDescription: (guide.metaDescription ?? "").slice(0, 160),
        status: "draft",
        reviewedBy: null,
      });
      if (r.ok) result.created.push(guide.slug);
      else result.failed.push(`${file}: ${Object.values(r.errors).join(" ")}`);
    } catch (error) {
      result.failed.push(`${file}: ${(error as Error).message}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// intro_html del catálogo
// ---------------------------------------------------------------------------

export const INTRO_KINDS = ["brand", "model", "category", "city"] as const;
export type IntroKind = (typeof INTRO_KINDS)[number];
export const INTRO_LABEL: Record<IntroKind, string> = { brand: "Marcas", model: "Modelos", category: "Tipos", city: "Ciudades" };

const TABLE = { brand: brands, model: models, category: categories, city: cities } as const;

export type IntroRow = { id: number; name: string; url: string | null; introHtml: string | null; live: number; words: number; indicator: IntroIndicator };

async function liveCounts(kind: IntroKind): Promise<Map<number, number>> {
  const rows = await groupLiveCounts([kind as CountDimension]);
  return new Map(rows.map((r) => [Number(r.key[kind]), r.count]));
}

function safePath(build: () => string): string | null {
  try {
    return build();
  } catch {
    return null;
  }
}

export async function listIntroRows(kind: IntroKind): Promise<IntroRow[]> {
  const counts = await liveCounts(kind);
  const mode = siteIndexingMode();
  const type: ProgrammaticPageType = kind;
  let base: Array<{ id: number; name: string; introHtml: string | null; url: string | null }>;
  if (kind === "model") {
    const rows = await db
      .select({ id: models.id, name: models.name, slug: models.slug, brandName: brands.name, brandSlug: brands.slug, introHtml: models.introHtml })
      .from(models)
      .innerJoin(brands, eq(brands.id, models.brandId))
      .where(eq(models.isActive, true))
      .orderBy(asc(brands.name), asc(models.name));
    base = rows.map((r) => ({ id: r.id, name: `${r.brandName} ${r.name}`, introHtml: r.introHtml, url: safePath(() => paths.model(r.brandSlug, r.slug)) }));
  } else {
    const t = TABLE[kind];
    const rows = await db.select({ id: t.id, name: t.name, slug: t.slug, introHtml: t.introHtml }).from(t).where(eq(t.isActive, true)).orderBy(asc(t.name));
    const url = (slug: string) => (kind === "brand" ? paths.brand(slug) : kind === "category" ? paths.category(slug) : paths.city(slug));
    base = rows.map((r) => ({ id: r.id, name: r.name, introHtml: r.introHtml, url: safePath(() => url(r.slug)) }));
  }
  return base.map((r) => {
    const live = counts.get(r.id) ?? 0;
    const words = countWords(r.introHtml);
    return { ...r, live, words, indicator: introIndicator(type, live, words, mode) };
  });
}

export type IntroSaveResult = { ok: true; words: number; indicator: IntroIndicator } | { ok: false; status: 400 | 404 | 422; error: string };

export async function saveIntro(user: SessionUser, kind: string, id: number, html: string): Promise<IntroSaveResult> {
  if (!(CONTENT_ROLES as readonly string[]).includes(user.role)) return { ok: false, status: 400, error: "Sin permiso." };
  if (!(INTRO_KINDS as readonly string[]).includes(kind)) return { ok: false, status: 400, error: "Tipo inválido." };
  const k = kind as IntroKind;
  const clean = sanitizeHtml(html);
  // intro_html sale publicado apenas se guarda: sin borradores con [VERIFICAR].
  if (hasPendingVerification(clean)) return { ok: false, status: 422, error: "Quedan [VERIFICAR] sin resolver: este texto se publica al guardar." };
  if (clean.length > 60_000) return { ok: false, status: 422, error: "El texto es demasiado largo." };
  const t = TABLE[k];
  const [before] = await db.select({ introHtml: t.introHtml }).from(t).where(eq(t.id, id));
  if (!before) return { ok: false, status: 404, error: "No existe." };
  await db.transaction(async (tx) => {
    await tx.update(t).set({ introHtml: clean || null }).where(eq(t.id, id));
    await logActivity(tx, { userId: user.id, entityType: k, entityId: id, action: "intro_updated", diff: { words: { from: countWords(before.introHtml), to: countWords(clean) } } });
  });
  const live = (await liveCounts(k)).get(id) ?? 0;
  const words = countWords(clean);
  return { ok: true, words, indicator: introIndicator(k, live, words, siteIndexingMode()) };
}
