// Normalización de teléfono a E.164 paraguayo (+595XXXXXXXXX). Corre siempre
// en el servidor, nunca en el cliente (DATABASE_SCHEMA.md, convenciones
// globales). Entradas inválidas lanzan error, nunca devuelven un valor a medias
// (TEST_PLAN.md §2 punto 2).

const PARAGUAY_COUNTRY_CODE = "595";

/**
 * Normaliza un teléfono paraguayo a E.164: "+595981123456".
 * Acepta, entre otros: "0981 123 456", "0981123456", "+595 981 123456",
 * "595981123456".
 */
export function normalizePhone(raw: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("normalizePhone: número vacío");
  }

  const digits = raw.replace(/[^\d]/g, "");

  let national: string;
  if (raw.trim().startsWith("+")) {
    if (!digits.startsWith(PARAGUAY_COUNTRY_CODE)) {
      throw new Error(`normalizePhone: número inválido: ${raw}`);
    }
    national = digits.slice(PARAGUAY_COUNTRY_CODE.length);
  } else if (digits.startsWith(PARAGUAY_COUNTRY_CODE) && digits.length > 9) {
    national = digits.slice(PARAGUAY_COUNTRY_CODE.length);
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  // Celular paraguayo: 9 dígitos nacionales (ej. 981123456), sin el 0 inicial.
  if (!/^9\d{8}$/.test(national)) {
    throw new Error(`normalizePhone: número inválido: ${raw}`);
  }

  return `+${PARAGUAY_COUNTRY_CODE}${national}`;
}
