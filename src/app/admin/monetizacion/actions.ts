"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { int, optStr, str, formValues } from "@/components/admin/crud/form-values";
import { createFeatured, saveAd, savePlan, setFeaturedStatus } from "@/components/admin/ops/monetization";
import type { adPlacementStatusEnum } from "@/db/schema";

const done = (msg: string, ok: boolean) => redirect(`/admin/monetizacion?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);

export async function featuredAction(form: FormData): Promise<void> {
  const user = await requireRole("admin");
  const v = formValues(form);
  const r = await createFeatured(user, {
    ref: str(v, "ref"),
    days: Number(int(v, "dias")),
    amountGs: Number(int(v, "monto") ?? 0),
    method: str(v, "medio"),
    reference: optStr(v, "referencia"),
    paid: v.cobrado === "1",
  });
  done(r.ok ? "Destacado cargado." : r.error, r.ok);
}

export async function featuredStatusAction(form: FormData): Promise<void> {
  const user = await requireRole("admin");
  const status = String(form.get("estado"));
  if (!["active", "refunded", "cancelled"].includes(status)) done("Estado inválido.", false);
  const r = await setFeaturedStatus(user, Number(form.get("id")), status as "active");
  done(r.ok ? "Actualizado." : (r.error ?? "Error"), r.ok);
}

export async function planAction(form: FormData): Promise<void> {
  const user = await requireRole("admin");
  const v = formValues(form);
  const limit = int(v, "limite");
  const r = await savePlan(user, {
    dealerId: Number(v.comercio),
    planCode: str(v, "plan"),
    listingLimit: limit !== null && !Number.isNaN(limit) ? limit : null,
    monthlyPriceGs: Number(int(v, "precio") ?? 0),
    startsAt: str(v, "desde"),
    endsAt: optStr(v, "hasta"),
    notes: optStr(v, "notas"),
  });
  done(r.ok ? "Plan cargado." : r.error, r.ok);
}

export async function adAction(form: FormData): Promise<void> {
  const user = await requireRole("admin");
  const v = formValues(form);
  const amount = int(v, "monto");
  const r = await saveAd(user, Number(v.id) || null, {
    advertiserName: str(v, "anunciante"),
    slotCode: str(v, "espacio"),
    imagePath: optStr(v, "imagen"),
    targetUrl: optStr(v, "destino"),
    altText: optStr(v, "alt"),
    cityId: Number(v.ciudad) || null,
    brandId: Number(v.marca) || null,
    categoryId: Number(v.categoria) || null,
    startsAt: str(v, "desde"),
    endsAt: str(v, "hasta"),
    amountGs: amount !== null && !Number.isNaN(amount) ? amount : null,
    status: (str(v, "estado") || "draft") as (typeof adPlacementStatusEnum)[number],
  });
  done(r.ok ? "Publicidad guardada." : r.error, r.ok);
}
