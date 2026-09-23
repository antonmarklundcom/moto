// Validación del formulario de lead (INTEGRATIONS.md §2.7 regla 3). Pura.
// Recibe los campos tal como llegan (form o JSON, todo como texto) y devuelve
// el lead normalizado o los errores por campo, en español paraguayo, listos
// para mostrar junto al campo.
//
// Nombres de campo del formulario (los usan los formularios de B5):
//   tipo*, telefono*, nombre, email, mensaje, aviso (public_ref), pagina,
//   website (honeypot, lo mira la ruta antes de validar)
//   financing:   ciudad, entrega_gs, plazo_meses, situacion_laboral, moto_interes
//   insurance:   ciudad, moto_interes, anio
//   dealer_plan: comercio_nombre, ciudad, cantidad_motos
//   advertising: empresa

import { EMAIL_PATTERN } from "@/lib/crm/payload";
import { normalizePhone } from "@/lib/phone";
import { parsePublicRef } from "@/lib/slug";
import { isPublicLeadType, type PublicLeadType } from "./types";

export const HONEYPOT_FIELD = "website";

export const SITUACION_LABORAL = ["relacion_dependencia", "independiente", "otro"] as const;

export type LeadExtraValue = string | number;

export type LeadSubmission = {
  type: PublicLeadType;
  phoneE164: string;
  phoneRaw: string;
  name: string | null;
  email: string | null;
  message: string | null;
  /** `public_ref` normalizado (mayúsculas) o null. Se resuelve contra la base al guardar. */
  listingRef: string | null;
  /** Ruta del sitio donde estaba el formulario (sin query), o null. */
  pagePath: string | null;
  /** Datos propios del tipo, con los nombres que van en `fields` del CRM. */
  extras: Record<string, LeadExtraValue>;
};

export type LeadValidation =
  | { ok: true; value: LeadSubmission }
  | { ok: false; errors: Record<string, string> };

type Raw = Record<string, string | undefined>;

 
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function text(raw: string | undefined, max: number, multiline = false): string | null {
  if (raw === undefined) return null;
  let v = raw.replace(CONTROL, "");
  if (!multiline) v = v.replace(/\s+/g, " ");
  v = v.trim();
  return v === "" ? null : v.slice(0, max);
}

/** Entero escrito por una persona: "2.000.000", "Gs. 2 000 000" → 2000000. */
export function parseIntegerInput(raw: string | undefined, min: number, max: number): number | null | "invalid" {
  const t = raw?.trim() ?? "";
  if (t === "") return null;
  const digits = t.replace(/^gs\.?\s*/i, "").replace(/[.\s]/g, "");
  if (!/^\d{1,15}$/.test(digits)) return "invalid";
  const n = Number(digits);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : "invalid";
}

/** Ruta interna segura: empieza con una sola "/", sin query ni fragmento. */
export function safePagePath(raw: string | undefined | null): string | null {
  const t = raw?.trim() ?? "";
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("\\")) return null;
  const path = t.split(/[?#]/)[0];
   
  return /^[\x21-\x7e]+$/.test(path) ? path.slice(0, 500) : null;
}

export const LEAD_ERRORS = {
  tipo: "No pudimos identificar la consulta. Volvé a cargar la página e intentá de nuevo.",
  telefonoVacio: "Escribí tu número de teléfono.",
  telefonoInvalido: "Revisá el número: por ejemplo 0981 123 456.",
  email: "Revisá el correo o dejalo vacío.",
  entrega: "Escribí la entrega sólo con números, en guaraníes.",
  plazo: "Elegí un plazo válido, en meses.",
  situacion: "Elegí una opción de la lista.",
  anio: "Revisá el año.",
  cantidad: "Escribí la cantidad sólo con números.",
} as const;

export function validateLead(raw: Raw, now: Date = new Date()): LeadValidation {
  const errors: Record<string, string> = {};
  const tipo = raw.tipo?.trim() ?? "";
  if (!isPublicLeadType(tipo)) {
    return { ok: false, errors: { tipo: LEAD_ERRORS.tipo } };
  }

  const phoneRaw = text(raw.telefono, 30);
  let phoneE164 = "";
  if (!phoneRaw) {
    errors.telefono = LEAD_ERRORS.telefonoVacio;
  } else {
    try {
      // Fijo también: perder un lead porque dejó el teléfono de la casa es peor
      // que llamarlo en vez de escribirle.
      phoneE164 = normalizePhone(phoneRaw, { allowLandline: true });
    } catch {
      errors.telefono = LEAD_ERRORS.telefonoInvalido;
    }
  }

  const email = text(raw.email, 320);
  if (email && !EMAIL_PATTERN.test(email)) errors.email = LEAD_ERRORS.email;

  const extras: Record<string, LeadExtraValue> = {};
  const putText = (field: string, key: string, max = 200) => {
    const v = text(raw[field], max);
    if (v) extras[key] = v;
  };
  const putInt = (field: string, key: string, min: number, max: number, message: string) => {
    const v = parseIntegerInput(raw[field], min, max);
    if (v === "invalid") errors[field] = message;
    else if (v !== null) extras[key] = v;
  };

  switch (tipo) {
    case "financing": {
      putText("ciudad", "ciudad", 120);
      putInt("entrega_gs", "entrega_disponible_gs", 0, 10_000_000_000, LEAD_ERRORS.entrega);
      putInt("plazo_meses", "plazo_deseado_meses", 1, 120, LEAD_ERRORS.plazo);
      const situacion = raw.situacion_laboral?.trim() ?? "";
      if (situacion !== "") {
        if ((SITUACION_LABORAL as readonly string[]).includes(situacion)) extras.situacion_laboral = situacion;
        else errors.situacion_laboral = LEAD_ERRORS.situacion;
      }
      putText("moto_interes", "moto_interes");
      break;
    }
    case "insurance":
      putText("ciudad", "ciudad", 120);
      putText("moto_interes", "moto_interes");
      putInt("anio", "anio", 1950, now.getUTCFullYear() + 1, LEAD_ERRORS.anio);
      break;
    case "dealer_plan":
      putText("comercio_nombre", "comercio_nombre");
      putText("ciudad", "ciudad", 120);
      putInt("cantidad_motos", "cantidad_motos", 0, 100_000, LEAD_ERRORS.cantidad);
      break;
    case "advertising":
      putText("empresa", "empresa");
      break;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      type: tipo,
      phoneE164,
      phoneRaw: phoneRaw!,
      name: text(raw.nombre, 200),
      email,
      message: text(raw.mensaje, 5000, true),
      listingRef: raw.aviso ? parsePublicRef(raw.aviso) : null,
      pagePath: safePagePath(raw.pagina),
      extras,
    },
  };
}
