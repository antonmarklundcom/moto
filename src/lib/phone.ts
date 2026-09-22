// Normalización de teléfono a E.164 paraguayo (+595…). Corre siempre en el
// servidor, nunca en el cliente (DATABASE_SCHEMA.md, convenciones globales).
// Entradas inválidas lanzan error, nunca devuelven un valor a medias
// (TEST_PLAN.md §2 punto 2).

const PARAGUAY_COUNTRY_CODE = "595";

// Celular: 9 dígitos nacionales que empiezan con 9 (ej. 981123456).
const MOBILE_NATIONAL = /^9\d{8}$/;
// Línea fija (F-7): código de área de 2 o 3 dígitos que no empieza con 9
// (21 Asunción, 61 Ciudad del Este, 71 Encarnación, 336 Pedro Juan Caballero…)
// más el número de abonado; 8 o 9 dígitos nacionales en total.
// [VERIFICAR: plan de numeración vigente de CONATEL para fijos]
const LANDLINE_NATIONAL = /^[2-8]\d{7,8}$/;

export type NormalizePhoneOptions = {
  /**
   * Acepta líneas fijas además de celulares. Sólo para contacto de comercio y
   * publicaciones con `contact_whatsapp = false` ("solo llamadas", G-3).
   * Por defecto `false`: todo lo que termina en un enlace de WhatsApp tiene
   * que ser un celular.
   */
  allowLandline?: boolean;
};

function toNational(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  // "+595 0981 …" es un error de tipeo frecuente: el 0 nacional después del
  // código de país se descarta.
  const afterCountryCode = (rest: string) => (rest.startsWith("0") ? rest.slice(1) : rest);
  if (raw.trim().startsWith("+")) {
    if (!digits.startsWith(PARAGUAY_COUNTRY_CODE)) {
      throw new Error(`normalizePhone: número inválido: ${raw}`);
    }
    return afterCountryCode(digits.slice(PARAGUAY_COUNTRY_CODE.length));
  }
  if (digits.startsWith("00" + PARAGUAY_COUNTRY_CODE)) {
    return afterCountryCode(digits.slice(2 + PARAGUAY_COUNTRY_CODE.length));
  }
  if (digits.startsWith(PARAGUAY_COUNTRY_CODE) && digits.length > 9) {
    return afterCountryCode(digits.slice(PARAGUAY_COUNTRY_CODE.length));
  }
  if (digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Normaliza un teléfono paraguayo a E.164: "+595981123456".
 * Acepta, entre otros: "0981 123 456", "0981123456", "+595 981 123456",
 * "595981123456". Con `{ allowLandline: true }` también "021 123 456".
 */
export function normalizePhone(raw: string, options: NormalizePhoneOptions = {}): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("normalizePhone: número vacío");
  }

  const national = toNational(raw);
  const isMobile = MOBILE_NATIONAL.test(national);
  const isLandline = !isMobile && LANDLINE_NATIONAL.test(national);

  if (!isMobile && !(options.allowLandline && isLandline)) {
    throw new Error(`normalizePhone: número inválido: ${raw}`);
  }

  return `+${PARAGUAY_COUNTRY_CODE}${national}`;
}

/** `true` si el número E.164 es un celular paraguayo (puede tener WhatsApp). */
export function isWhatsAppCapable(phoneE164: string): boolean {
  return (
    phoneE164.startsWith(`+${PARAGUAY_COUNTRY_CODE}`) &&
    MOBILE_NATIONAL.test(phoneE164.slice(1 + PARAGUAY_COUNTRY_CODE.length))
  );
}

/**
 * Formato visible (CLAUDE.md §3.2): celular "0981 123 456"; fijo "021 123 456"
 * o "021 123 4567" (código de 2 dígitos) / "0336 123 456" (código de 3).
 */
export function formatPhoneDisplay(phoneE164: string): string {
  const national = phoneE164.startsWith(`+${PARAGUAY_COUNTRY_CODE}`)
    ? phoneE164.slice(1 + PARAGUAY_COUNTRY_CODE.length)
    : null;
  if (national === null || !/^\d+$/.test(national)) {
    throw new Error(`formatPhoneDisplay: no es un E.164 paraguayo: ${phoneE164}`);
  }
  if (MOBILE_NATIONAL.test(national)) {
    return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  // Fijo: con 8 dígitos el código es de 2 (21 123456); con 9, se asume código de
  // 2 y abonado de 7 (21 1234567), que es el caso de Asunción.
  return `0${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
}
