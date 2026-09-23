// Texto que acompaña a cada formulario de lead y su versión, guardada en
// `leads.payload_json.consent_text_version` (BUILD_PLAN.md §5.2 A4): así se
// puede demostrar qué leyó cada persona antes de enviar.
//
// El texto de financiación es el obligatorio de PRODUCT_SPEC.md §2.3, literal.
// Esto NO es texto legal: los términos y la política de privacidad los escribe
// el abogado (LEGAL_AND_COMPLIANCE.md §10). Si el texto cambia, cambia la
// versión (fecha del cambio), nunca se edita el texto de una versión vieja.
// Los formularios (B5) muestran `LEAD_NOTICE[type].text`: una sola fuente.

import type { PublicLeadType } from "./types";

export type LeadNotice = { version: string; text: string } | null;

export const LEAD_NOTICE: Readonly<Record<PublicLeadType, LeadNotice>> = {
  financing: {
    version: "financiacion-2026-09-22",
    text: "Te contactamos para orientarte y derivarte con el comercio o la financiera. moto.com.py no otorga créditos ni garantiza aprobación.",
  },
  // Sin texto propio definido en la especificación todavía. [VERIFICAR: si el
  // abogado pide un aviso para seguros (LEGAL_AND_COMPLIANCE.md §3)]
  insurance: null,
  dealer_plan: null,
  advertising: null,
};

export function consentTextVersion(type: PublicLeadType): string | null {
  return LEAD_NOTICE[type]?.version ?? null;
}
