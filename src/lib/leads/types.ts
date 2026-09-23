// Tipos de lead que acepta el formulario público. Son los comerciales de
// ADR-08: los únicos que van a VenderCRM. `general` existe en el esquema pero
// no entra por acá (ver docs/log/A4.md).

export const PUBLIC_LEAD_TYPES = ["financing", "insurance", "dealer_plan", "advertising"] as const;
export type PublicLeadType = (typeof PUBLIC_LEAD_TYPES)[number];

export function isPublicLeadType(value: string): value is PublicLeadType {
  return (PUBLIC_LEAD_TYPES as readonly string[]).includes(value);
}

/** `fields.tipo_lead` en el CRM y `?tipo=` de la página de gracias. */
export const LEAD_TYPE_SLUG: Readonly<Record<PublicLeadType, string>> = {
  financing: "financiacion",
  insurance: "seguro",
  dealer_plan: "plan_comercio",
  advertising: "publicidad",
};
