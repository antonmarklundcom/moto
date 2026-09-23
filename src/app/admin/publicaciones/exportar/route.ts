// GET /admin/publicaciones/exportar — CSV del filtro actual (ADMIN_SPEC §4).
import { withRole } from "@/lib/auth/session";
import { exportAdminListings } from "@/components/admin/crud/listings-admin";
import { filtersFromQuery } from "@/components/admin/crud/listing-filters";
import { csvCell } from "@/components/admin/ops/leads-admin";

export const dynamic = "force-dynamic";

// Misma celda que la exportación de leads (anti-inyección de fórmulas, \r entre comillas).
const cell = csvCell;

export const GET = withRole(["admin", "moderator"], async (user, request) => {
  const rows = await exportAdminListings(user, filtersFromQuery(new URL(request.url).searchParams));
  const header = rows.length ? Object.keys(rows[0]) : ["referencia"];
  const body = [header.join(","), ...rows.map((r) => header.map((h) => cell((r as Record<string, unknown>)[h])).join(","))].join("\r\n");
  return new Response(`﻿${body}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="publicaciones.csv"',
      "Cache-Control": "no-store",
    },
  });
});
