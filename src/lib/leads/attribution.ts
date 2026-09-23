// Cookie `vc_attr` de vc-attribution.js (INTEGRATIONS.md §2.7 regla 6): la
// escribe el script del CRM con el primer toque (utm_*, gclid, fbclid) y no
// la sobrescribe durante 90 días. Se lee sólo en el servidor. Pura.
//
// Formato: JSON codificado con encodeURIComponent. Según quién la lea puede
// llegar ya decodificada (cookies() de Next decodifica) o no: se aceptan las
// dos. Cualquier cosa rara → atribución vacía, nunca un error.

export type Attribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  gclid: string | null;
  fbclid: string | null;
  landingPage: string | null;
  referrer: string | null;
};

export const EMPTY_ATTRIBUTION: Attribution = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  gclid: null,
  fbclid: null,
  landingPage: null,
  referrer: null,
};

export const ATTRIBUTION_COOKIE = "vc_attr";

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // Sin caracteres de control: van a columnas y a un JSON del CRM.
   
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return clean === "" ? null : clean.slice(0, max);
}

function url(value: unknown): string | null {
  const s = str(value, 2000);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}

export function readAttribution(cookieValue: string | null | undefined): Attribution {
  if (!cookieValue) return { ...EMPTY_ATTRIBUTION };
  let obj = parseObject(cookieValue);
  if (!obj) {
    try {
      obj = parseObject(decodeURIComponent(cookieValue));
    } catch {
      obj = null;
    }
  }
  if (!obj) return { ...EMPTY_ATTRIBUTION };
  return {
    utmSource: str(obj.utm_source, 200),
    utmMedium: str(obj.utm_medium, 200),
    utmCampaign: str(obj.utm_campaign, 200),
    utmTerm: str(obj.utm_term, 200),
    utmContent: str(obj.utm_content, 200),
    gclid: str(obj.gclid, 200),
    fbclid: str(obj.fbclid, 200),
    landingPage: url(obj.landing_page),
    referrer: url(obj.referrer),
  };
}
