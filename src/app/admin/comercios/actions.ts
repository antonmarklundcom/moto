"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import type { CrudState } from "@/components/admin/crud/crud-form";
import { saveDealer, withdrawDealerStock } from "@/components/admin/crud/dealers-admin";
import { bool, formValues, int, optStr, str } from "@/components/admin/crud/form-values";
import type { dealerStatusEnum } from "@/db/schema";

export async function saveDealerAction(prev: CrudState, form: FormData): Promise<CrudState> {
  const user = await requireRole("admin");
  const v = formValues(form);
  const id = Number(v.id) || null;
  const ttl = int(v, "listingTtlDays");
  const result = await saveDealer(user, id, {
    name: str(v, "name"),
    slug: str(v, "slug"),
    cityId: Number(v.cityId),
    address: optStr(v, "address"),
    phone: str(v, "phone"),
    email: optStr(v, "email"),
    websiteUrl: optStr(v, "websiteUrl"),
    description: optStr(v, "description"),
    status: (str(v, "status") || "prospect") as (typeof dealerStatusEnum)[number],
    isVerified: bool(v, "isVerified"),
    autoApprove: bool(v, "autoApprove"),
    authorizationNote: optStr(v, "authorizationNote"),
    authorizationDate: optStr(v, "authorizationDate"),
    authorizationChannel: optStr(v, "authorizationChannel"),
    freeUntil: optStr(v, "freeUntil"),
    listingTtlDays: ttl !== null && Number.isNaN(ttl) ? -1 : ttl,
  });
  if (!result.ok) return { ok: false, message: "Revisá los campos marcados.", errors: result.errors, values: v, version: prev.version + 1 };
  if (!id) redirect(`/admin/comercios/${result.id}?creado=1`);
  return { ok: true, message: "Guardado.", errors: {}, values: v, version: prev.version + 1 };
}

export async function withdrawStockAction(form: FormData): Promise<void> {
  const user = await requireRole("admin");
  const id = Number(form.get("id"));
  if (form.get("confirmar") !== "BAJA") redirect(`/admin/comercios/${id}?baja=confirmar`);
  const r = await withdrawDealerStock(user, id, String(form.get("nota") ?? ""));
  redirect(`/admin/comercios/${id}?baja=${r.ok ? `ok-${r.paused}` : "error"}`);
}
