"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { type CatalogKind, CATALOG_KINDS, proposeModel, resolveSuggestion, saveCatalogItem } from "@/components/admin/crud/catalog-admin";
import type { CrudState } from "@/components/admin/crud/crud-form";
import { bool, formValues, int, optStr, str } from "@/components/admin/crud/form-values";

export async function saveCatalogAction(prev: CrudState, form: FormData): Promise<CrudState> {
  const user = await requireRole("admin");
  const v = formValues(form);
  const kind = v.kind as CatalogKind;
  if (!(CATALOG_KINDS as readonly string[]).includes(kind)) return { ...prev, ok: false, message: "Tipo inválido.", version: prev.version + 1 };
  const id = Number(v.id) || null;
  const cc = int(v, "engineCc");
  const r = await saveCatalogItem(user, kind, id, {
    name: str(v, "name"),
    slug: str(v, "slug"),
    isActive: bool(v, "isActive"),
    sortOrder: Number(int(v, "sortOrder") ?? 0) || 0,
    brandId: Number(v.brandId) || null,
    categoryId: Number(v.categoryId) || null,
    engineCc: cc !== null && !Number.isNaN(cc) ? cc : null,
    department: optStr(v, "department"),
    isMetroAsuncion: bool(v, "isMetroAsuncion"),
  });
  if (!r.ok) return { ok: false, message: "Revisá los campos marcados.", errors: r.errors, values: v, version: prev.version + 1 };
  redirect(`/admin/catalogo?tipo=${kind}&ok=1`);
}

export async function resolveSuggestionAction(form: FormData): Promise<void> {
  const user = await requireRole("admin");
  const id = Number(form.get("id"));
  const action = String(form.get("accion"));
  const r =
    action === "map"
      ? await resolveSuggestion(user, id, { action: "map", modelId: Number(form.get("modelId")) })
      : action === "create"
        ? await resolveSuggestion(user, id, { action: "create", name: String(form.get("nombre") ?? "") })
        : await resolveSuggestion(user, id, { action: "reject" });
  redirect(`/admin/catalogo?tipo=sugerencias&${r.ok ? `resuelta=${r.updatedListings}` : `error=${encodeURIComponent(r.error)}`}`);
}

export async function proposeModelAction(form: FormData): Promise<void> {
  const user = await requireRole("admin", "moderator");
  const r = await proposeModel(user, Number(form.get("brandId")), String(form.get("modelo") ?? ""));
  redirect(`/admin/catalogo?tipo=sugerencias&${r.ok ? "propuesta=1" : `error=${encodeURIComponent(r.error ?? "")}`}`);
}
