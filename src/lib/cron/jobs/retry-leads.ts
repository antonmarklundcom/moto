// Reintento de leads que no llegaron a VenderCRM (T-110, INTEGRATIONS.md §2.8).
// Backoff 1 min → 5 min → 30 min → 2 h; se detiene a los 5 intentos (el admin
// muestra la alarma, B9). Mismo idempotency_key en cada intento: reintentar es
// seguro. También manda los `pending` que quedaron sin intentar porque el CRM
// no estaba configurado (S-6) o porque el proceso se reinició antes del envío.
//
// De a pocos por ejecución: el CRM limita a 60/min por sitio.
import { crmConfigFromEnv } from "@/lib/crm/client";
import { deliverLead, dueLeads } from "@/lib/leads/deliver";
import type { JobFn } from "../runner";

export const RETRY_BATCH = 30;

export const retryLeads: JobFn = async ({ now }) => {
  const config = crmConfigFromEnv();
  const due = await dueLeads(now, RETRY_BATCH);
  if (!config) {
    return { skipped: "crm_not_configured", due: due.length };
  }
  const counts = { sent: 0, duplicate: 0, failed: 0, skipped: 0 };
  for (const lead of due) {
    const res = await deliverLead(lead.id, { config });
    counts[res.status] += 1;
  }
  return { due: due.length, ...counts };
};
