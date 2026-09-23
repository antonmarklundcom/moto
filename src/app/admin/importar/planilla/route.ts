// GET /admin/importar/planilla — la planilla modelo vacía (sólo encabezados).
// Mismas columnas que docs/templates/stock-template.csv.
import { withRole } from "@/lib/auth/session";
import { STOCK_COLUMNS } from "@/lib/import/columns";
import { templateCsv } from "@/lib/import/csv";

export const dynamic = "force-dynamic";

export const GET = withRole(["admin"], async () => {
  // BOM: Excel abre el UTF-8 bien sólo con él.
  return new Response(`﻿${templateCsv(STOCK_COLUMNS)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="planilla-stock-moto.csv"',
      "Cache-Control": "no-store",
    },
  });
});
