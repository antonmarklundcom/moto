"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { retryLead, setLeadSpam } from "@/components/admin/ops/leads-admin";

function back(form: FormData): string {
  const b = String(form.get("volver") ?? "/admin/leads");
  return b.startsWith("/admin/leads") ? b : "/admin/leads";
}

export async function retryLeadAction(form: FormData): Promise<void> {
  const user = await requireRole("admin");
  const r = await retryLead(user, Number(form.get("id")));
  const b = back(form);
  redirect(`${b}${b.includes("?") ? "&" : "?"}${r.ok ? `reintento=${encodeURIComponent(r.status)}` : `error=${encodeURIComponent(r.error)}`}`);
}

export async function spamAction(form: FormData): Promise<void> {
  const user = await requireRole("admin");
  await setLeadSpam(user, Number(form.get("id")), form.get("spam") === "1");
  redirect(back(form));
}
