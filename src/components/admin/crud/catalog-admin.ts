// Catálogo en el admin (ADMIN_SPEC.md §6, ADR-11, G-15). Admin crea y edita;
// el moderador "propone" (deja una sugerencia de modelo). El slug se bloquea
// cuando alguna publicación con ese valor llegó a publicarse (SEO §1: un slug
// publicado no cambia). `intro_html` se edita en Contenido (B10), no acá.
import "server-only";

import { and, asc, count, eq, isNotNull, isNull } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";
import { db } from "@/db";
import { brands, categories, cities, listings, models, modelSuggestions } from "@/db/schema";
import { diffFields, logActivity } from "@/lib/activity";
import { assertRole, type SessionUser } from "@/lib/auth/roles";
import { isReservedSlug, slugify } from "@/lib/slug";

export const CATALOG_KINDS = ["marcas", "modelos", "categorias", "ciudades"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

const TABLE = { marcas: brands, modelos: models, categorias: categories, ciudades: cities } as const;
const LISTING_COLUMN: Record<CatalogKind, MySqlColumn> = {
  marcas: listings.brandId,
  modelos: listings.modelId,
  categorias: listings.categoryId,
  ciudades: listings.cityId,
};

export type CatalogInput = {
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  /** modelos */
  brandId?: number | null;
  categoryId?: number | null;
  engineCc?: number | null;
  /** ciudades */
  department?: string | null;
  isMetroAsuncion?: boolean;
};

export function isVerifyFlagged(introHtml: string | null | undefined): boolean {
  return Boolean(introHtml && /\[VERIFICAR/i.test(introHtml));
}

export async function slugLocked(kind: CatalogKind, id: number): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(LISTING_COLUMN[kind], id), isNotNull(listings.publishedAt)));
  return Number(row?.n ?? 0) > 0;
}

export async function listCatalog(user: SessionUser | null, kind: CatalogKind) {
  assertRole(user, ["admin", "moderator"]);
  switch (kind) {
    case "marcas":
      return db.select({ id: brands.id, name: brands.name, slug: brands.slug, isActive: brands.isActive, sortOrder: brands.sortOrder, introHtml: brands.introHtml, extra: brands.name }).from(brands).orderBy(asc(brands.sortOrder), asc(brands.name));
    case "modelos":
      return db
        .select({ id: models.id, name: models.name, slug: models.slug, isActive: models.isActive, sortOrder: models.engineCc, introHtml: models.introHtml, extra: brands.name, brandId: models.brandId, categoryId: models.categoryId, engineCc: models.engineCc })
        .from(models)
        .innerJoin(brands, eq(brands.id, models.brandId))
        .orderBy(asc(brands.name), asc(models.name));
    case "categorias":
      return db.select({ id: categories.id, name: categories.name, slug: categories.slug, isActive: categories.isActive, sortOrder: categories.sortOrder, introHtml: categories.introHtml, extra: categories.name }).from(categories).orderBy(asc(categories.sortOrder));
    case "ciudades":
      return db.select({ id: cities.id, name: cities.name, slug: cities.slug, isActive: cities.isActive, sortOrder: cities.sortOrder, introHtml: cities.introHtml, extra: cities.department }).from(cities).orderBy(asc(cities.sortOrder));
  }
}

export async function saveCatalogItem(
  user: SessionUser | null,
  kind: CatalogKind,
  id: number | null,
  input: CatalogInput,
): Promise<{ ok: true; id: number } | { ok: false; errors: Record<string, string> }> {
  const actor = assertRole(user, ["admin"]);
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 1 || name.length > 150) errors.name = "Nombre de 1 a 150 caracteres.";
  let slug = input.slug.trim().toLowerCase();
  if (!slug && name) {
    try {
      slug = slugify(name);
    } catch {
      slug = "";
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = "Slug con minúsculas, números y guiones.";
  // G-15: un slug reservado chocaría con /motos/tipo, /motos/ciudad, /motos/nuevas…
  else if (isReservedSlug(slug)) errors.slug = `«${slug}» está reservado para rutas del sitio (G-15). Elegí otro.`;
  if (kind === "modelos" && !input.brandId) errors.brandId = "Elegí la marca.";
  if (kind === "ciudades" && !input.department?.trim()) errors.department = "Poné el departamento.";

  const table = TABLE[kind];
  if (!errors.slug) {
    const scope = kind === "modelos" ? and(eq(models.slug, slug), eq(models.brandId, input.brandId ?? 0)) : eq(table.slug, slug);
    const [clash] = await db.select({ id: table.id }).from(table).where(scope);
    if (clash && clash.id !== id) errors.slug = "Ya existe con ese slug.";
  }
  if (id !== null && !errors.slug) {
    const [current] = await db.select({ slug: table.slug }).from(table).where(eq(table.id, id));
    if (!current) return { ok: false, errors: { _: "No existe." } };
    if (current.slug !== slug && (await slugLocked(kind, id))) {
      errors.slug = "El slug no se cambia: ya hay publicaciones publicadas con este valor y su URL pudo indexarse (SEO §1).";
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const base = { name, slug, isActive: input.isActive };
  const values: Record<string, unknown> =
    kind === "modelos"
      ? { ...base, brandId: input.brandId!, categoryId: input.categoryId ?? null, engineCc: input.engineCc ?? null }
      : kind === "ciudades"
        ? { ...base, sortOrder: input.sortOrder, department: input.department!.trim(), isMetroAsuncion: Boolean(input.isMetroAsuncion) }
        : { ...base, sortOrder: input.sortOrder };
  return db.transaction(async (tx) => {
    if (id === null) {
      const [res] = await tx.insert(table).values(values as never);
      await logActivity(tx, { userId: actor.id, entityType: `catalog_${kind}`, entityId: res.insertId, action: "catalog_created", diff: values });
      return { ok: true as const, id: res.insertId };
    }
    const [before] = await tx.select().from(table).where(eq(table.id, id));
    const diff = diffFields(before as Record<string, unknown>, values);
    if (Object.keys(diff).length) {
      await tx.update(table).set(values as never).where(eq(table.id, id));
      await logActivity(tx, { userId: actor.id, entityType: `catalog_${kind}`, entityId: id, action: "catalog_updated", diff });
    }
    return { ok: true as const, id };
  });
}

// ---------------------------------------------------------------------------
// Cola de model_suggestions (§6): mapear / crear / rechazar
// ---------------------------------------------------------------------------

export async function pendingSuggestions(user: SessionUser | null) {
  assertRole(user, ["admin", "moderator"]);
  return db
    .select({
      id: modelSuggestions.id,
      rawText: modelSuggestions.rawText,
      brandId: modelSuggestions.brandId,
      brandName: brands.name,
      listingId: modelSuggestions.listingId,
      listingTitle: listings.title,
      createdAt: modelSuggestions.createdAt,
    })
    .from(modelSuggestions)
    .leftJoin(brands, eq(brands.id, modelSuggestions.brandId))
    .leftJoin(listings, eq(listings.id, modelSuggestions.listingId))
    .where(eq(modelSuggestions.status, "pending"))
    .orderBy(asc(modelSuggestions.createdAt));
}

/** El moderador "propone" (§2): una sugerencia sin publicación, que resuelve un admin. */
export async function proposeModel(user: SessionUser | null, brandId: number, rawText: string): Promise<{ ok: boolean; error?: string }> {
  assertRole(user, ["admin", "moderator"]);
  const text = rawText.trim().slice(0, 255);
  if (!text) return { ok: false, error: "Escribí el modelo." };
  await db.insert(modelSuggestions).values({ rawText: text, brandId, status: "pending" });
  return { ok: true };
}

export type SuggestionResolution = { action: "map"; modelId: number } | { action: "create"; name: string; slug?: string; categoryId?: number | null; engineCc?: number | null } | { action: "reject" };

/**
 * Resuelve una sugerencia. Mapear o crear actualiza la publicación afectada
 * (y cualquier otra pendiente con el mismo texto y marca) poniéndole `model_id`.
 */
export async function resolveSuggestion(user: SessionUser | null, id: number, r: SuggestionResolution): Promise<{ ok: true; updatedListings: number } | { ok: false; error: string }> {
  const actor = assertRole(user, ["admin"]);
  const [s] = await db.select().from(modelSuggestions).where(eq(modelSuggestions.id, id));
  if (!s || s.status !== "pending") return { ok: false, error: "La sugerencia ya se resolvió." };
  let modelId: number | null = null;
  if (r.action === "map") {
    const [m] = await db.select({ id: models.id, brandId: models.brandId }).from(models).where(eq(models.id, r.modelId));
    if (!m || (s.brandId !== null && m.brandId !== s.brandId)) return { ok: false, error: "Ese modelo no es de la marca sugerida." };
    modelId = m.id;
  } else if (r.action === "create") {
    if (!s.brandId) return { ok: false, error: "La sugerencia no tiene marca." };
    const saved = await saveCatalogItem(actor, "modelos", null, {
      name: r.name,
      slug: r.slug ?? "",
      isActive: true,
      sortOrder: 0,
      brandId: s.brandId,
      categoryId: r.categoryId ?? null,
      engineCc: r.engineCc ?? null,
    });
    if (!saved.ok) return { ok: false, error: Object.values(saved.errors).join(" ") };
    modelId = saved.id;
  }
  return db.transaction(async (tx) => {
    const siblings = await tx
      .select({ id: modelSuggestions.id, listingId: modelSuggestions.listingId })
      .from(modelSuggestions)
      .where(and(eq(modelSuggestions.status, "pending"), eq(modelSuggestions.rawText, s.rawText), s.brandId === null ? isNull(modelSuggestions.brandId) : eq(modelSuggestions.brandId, s.brandId)));
    const ids = siblings.map((x) => x.id);
    let updated = 0;
    for (const sib of siblings) {
      if (modelId !== null && sib.listingId !== null) {
        const [l] = await tx.select({ modelId: listings.modelId, engineCc: listings.engineCc }).from(listings).where(eq(listings.id, sib.listingId)).for("update");
        if (l && l.modelId === null) {
          const [m] = await tx.select({ engineCc: models.engineCc }).from(models).where(eq(models.id, modelId));
          await tx.update(listings).set({ modelId, engineCc: l.engineCc ?? m?.engineCc ?? null, updatedBy: actor.id }).where(eq(listings.id, sib.listingId));
          await logActivity(tx, { userId: actor.id, entityType: "listing", entityId: sib.listingId, action: "model_mapped", diff: { modelId: { from: null, to: modelId }, suggestionId: sib.id } });
          updated += 1;
        }
      }
    }
    const status = r.action === "map" ? "mapped" : r.action === "create" ? "created" : "rejected";
    for (const sid of ids) {
      await tx.update(modelSuggestions).set({ status, mappedModelId: modelId, resolvedBy: actor.id }).where(eq(modelSuggestions.id, sid));
    }
    await logActivity(tx, { userId: actor.id, entityType: "model_suggestion", entityId: id, action: `suggestion_${status}`, diff: { rawText: s.rawText, modelId, siblings: ids.length } });
    return { ok: true as const, updatedListings: updated };
  });
}
