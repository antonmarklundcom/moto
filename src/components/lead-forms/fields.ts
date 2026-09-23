// Campos de cada formulario de lead (PRODUCT_SPEC.md §2.3) con los nombres
// que valida A4 (src/lib/leads/validate.ts). Puro: lo usan el formulario y
// las pruebas. Nada de cédula, cuenta bancaria ni ingreso exacto (§2.3).
import type { PublicLeadType } from "@/lib/leads/types";

export type FieldDef =
  | { name: string; label: string; kind: "text" | "tel" | "email" | "number"; required?: boolean; hint?: string; autoComplete?: string; placeholder?: string }
  | { name: string; label: string; kind: "select" | "radio"; options: ReadonlyArray<{ value: string; label: string }>; hint?: string }
  | { name: string; label: string; kind: "textarea"; hint?: string };

const nombre: FieldDef = { name: "nombre", label: "Tu nombre", kind: "text", autoComplete: "name" };
const telefono: FieldDef = {
  name: "telefono",
  label: "Tu teléfono (WhatsApp si tenés)",
  kind: "tel",
  required: true,
  autoComplete: "tel",
  placeholder: "0981 123 456",
};
const ciudad: FieldDef = { name: "ciudad", label: "Ciudad donde vivís", kind: "text", autoComplete: "address-level2" };

export const FORM_FIELDS: Readonly<Record<PublicLeadType, readonly FieldDef[]>> = {
  financing: [
    nombre,
    telefono,
    ciudad,
    { name: "moto_interes", label: "Moto que te interesa", kind: "text", placeholder: "Ej.: Honda Wave 110S" },
    { name: "entrega_gs", label: "Entrega que tenés disponible (Gs.)", kind: "number", placeholder: "1.500.000", hint: "Si no tenés entrega, dejalo vacío." },
    {
      name: "plazo_meses",
      label: "Plazo que te gustaría",
      kind: "select",
      options: [12, 18, 24, 30, 36, 48].map((m) => ({ value: String(m), label: `${m} meses` })),
    },
    {
      name: "situacion_laboral",
      label: "¿Cómo cobrás?",
      kind: "radio",
      options: [
        { value: "relacion_dependencia", label: "Con recibo de sueldo (en relación de dependencia)" },
        { value: "independiente", label: "Soy independiente" },
        { value: "otro", label: "Otro" },
      ],
    },
  ],
  insurance: [
    nombre,
    telefono,
    ciudad,
    { name: "moto_interes", label: "Tu moto (marca y modelo)", kind: "text", placeholder: "Ej.: Yamaha XTZ 150" },
    { name: "anio", label: "Año de la moto", kind: "number", placeholder: "2021" },
  ],
  dealer_plan: [
    nombre,
    telefono,
    { name: "comercio_nombre", label: "Nombre del comercio", kind: "text", autoComplete: "organization" },
    { name: "ciudad", label: "Ciudad del comercio", kind: "text" },
    { name: "cantidad_motos", label: "¿Cuántas motos tenés en stock, más o menos?", kind: "number" },
    { name: "mensaje", label: "¿Algo más que quieras contarnos?", kind: "textarea" },
  ],
  advertising: [
    nombre,
    telefono,
    { name: "empresa", label: "Empresa", kind: "text", autoComplete: "organization" },
    { name: "email", label: "Correo (opcional)", kind: "email", autoComplete: "email" },
    { name: "mensaje", label: "¿Qué te gustaría anunciar?", kind: "textarea" },
  ],
};

export const SUBMIT_LABEL = "Enviar consulta";
