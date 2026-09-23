"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { reconfirmStock } from "@/lib/import/dealer-ops";

/** G-6: el comercio confirmó por WhatsApp que siguen disponibles. Admin y moderación. */
export async function reconfirmAction(form: FormData): Promise<void> {
  const user = await requireRole("admin", "moderator");
  const dealerId = Number(form.get("comercio"));
  if (!Number.isSafeInteger(dealerId) || dealerId <= 0) redirect("/admin/importar");
  const ids = form.getAll("publicacion").map(Number);
  const result = await reconfirmStock({ dealerId, listingIds: ids, userId: user.id });
  redirect(`/admin/comercios/${dealerId}/reporte?reconfirmadas=${result.updated}`);
}
