// vc-attribution.js de VenderCRM (INTEGRATIONS.md §2.7 regla 6): guarda el
// primer utm_*/gclid/fbclid en la cookie `vc_attr` (90 días, no se
// sobrescribe). El servidor la lee al guardar un lead (src/lib/leads).
// Sin VENDERCRM_URL no se carga nada. La CSP ya permite ese origen
// (src/lib/security-headers.ts). Sólo la URL pública del CRM llega al HTML;
// la key nunca.
import "server-only";

import { env } from "@/lib/env";

export function CrmAttributionScript() {
  const url = env.vendercrmUrl();
  if (!url) return null;
  return <script src={`${url}/vc-attribution.js`} defer />;
}
