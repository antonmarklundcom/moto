"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import type { CrudState } from "@/components/admin/crud/crud-form";
import { bool, formValues, int, optStr, str } from "@/components/admin/crud/form-values";
import { type PhotoAction, photoAction } from "@/components/admin/crud/listing-photos";
import { type BulkAction, bulkListings, listingStateAction, updateListingAdmin } from "@/components/admin/crud/listings-admin";
import type { TransitionAction } from "@/lib/listings/state";

export async function bulkAction(form: FormData): Promise<void> {
  const user = await requireRole("admin", "moderator");
  const ids = form.getAll("ids").map(Number);
  const action = String(form.get("accion")) as BulkAction;
  const back = String(form.get("volver") ?? "/admin/publicaciones");
  const safeBack = back.startsWith("/admin/publicaciones") ? back : "/admin/publicaciones";
  if (!["pause", "expire", "extend"].includes(action) || ids.length === 0) redirect(safeBack);
  const r = await bulkListings(user, ids, action, Number(form.get("dias")) || 30);
  const sep = safeBack.includes("?") ? "&" : "?";
  redirect(`${safeBack}${sep}hechas=${r.done}&omitidas=${r.skipped.length}`);
}

export async function stateAction(form: FormData): Promise<void> {
  const user = await requireRole("admin", "moderator");
  const id = Number(form.get("id"));
  const r = await listingStateAction(user, id, String(form.get("accion")) as TransitionAction);
  redirect(`/admin/publicaciones/${id}?${r.ok ? "estado=ok" : `error=${encodeURIComponent(r.error)}`}`);
}

export async function editAction(prev: CrudState, form: FormData): Promise<CrudState> {
  const user = await requireRole("admin", "moderator");
  const v = formValues(form);
  const nums = ["priceGs", "downPaymentGs", "installmentGs", "installmentCount", "year", "mileageKm"] as const;
  const parsed = Object.fromEntries(nums.map((k) => [k, int(v, k)])) as Record<(typeof nums)[number], number | null>;
  const bad = nums.filter((k) => Number.isNaN(parsed[k]));
  if (bad.length) {
    return { ok: false, message: "Revisá los números.", errors: Object.fromEntries(bad.map((k) => [k, "Sólo números."])), values: v, version: prev.version + 1 };
  }
  const doc = str(v, "documentationStatus");
  const r = await updateListingAdmin(user, Number(v.id), {
    title: str(v, "title"),
    description: optStr(v, "description"),
    ...parsed,
    hasFinancingOnly: bool(v, "hasFinancingOnly"),
    isNegotiable: bool(v, "isNegotiable"),
    acceptsTradeIn: bool(v, "acceptsTradeIn"),
    contactPhone: str(v, "contactPhone"),
    contactWhatsapp: bool(v, "contactWhatsapp"),
    documentationStatus: doc === "al_dia" || doc === "transferencia_pendiente" || doc === "no_declara" ? doc : null,
    cityId: Number(v.cityId),
    categoryId: Number(v.categoryId),
    modelId: Number(v.modelId) || null,
    dealerId: Number(v.dealerId) || null,
    internalNote: optStr(v, "internalNote"),
  });
  if (!r.ok) return { ok: false, message: "Revisá los campos marcados.", errors: r.errors, values: v, version: prev.version + 1 };
  return { ok: true, message: r.changed.length ? `Guardado (${r.changed.length} cambios).` : "Sin cambios.", errors: {}, values: { ...v, internalNote: "" }, version: prev.version + 1 };
}

export async function photoFormAction(form: FormData): Promise<void> {
  const user = await requireRole("admin", "moderator");
  const id = Number(form.get("id"));
  const action = String(form.get("accion")) as PhotoAction;
  if (!["delete", "up", "down", "cover"].includes(action)) redirect(`/admin/publicaciones/${id}`);
  const r = await photoAction(user, id, Number(form.get("foto")), action);
  redirect(`/admin/publicaciones/${id}?${r.ok ? "fotos=ok" : `error=${encodeURIComponent(r.error)}`}#fotos`);
}
