// GET /admin/leads/exportar — CSV del filtro (y del alcance del usuario).
import { withRole } from "@/lib/auth/session";
import { csvCell, exportLeads } from "@/components/admin/ops/leads-admin";

export const dynamic = "force-dynamic";

export const GET = withRole(["admin", "moderator", "dealer"], async (user, request) => {
  const q = new URL(request.url).searchParams;
  const rows = await exportLeads(user, { type: q.get("tipo") ?? undefined, crm: q.get("crm") ?? undefined, from: q.get("desde") ?? undefined, to: q.get("hasta") ?? undefined, exhausted: q.get("agotados") === "1" });
  const header = rows.length ? Object.keys(rows[0]) : ["fecha"];
  const body = [header.join(","), ...rows.map((r) => header.map((h) => csvCell((r as Record<string, unknown>)[h])).join(","))].join("\r\n");
  return new Response(`﻿${body}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"', "Cache-Control": "no-store" },
  });
});
