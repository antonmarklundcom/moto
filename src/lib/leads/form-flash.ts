// Formulario de lead sin JS: si el servidor lo devuelve con un error, lo que
// la persona escribió vuelve en una cookie cifrada de 5 minutos (nunca en la
// URL: nombre y teléfono no van a logs ni al historial). La página la lee y
// precarga el formulario; con JS esto no hace falta (el error llega por JSON).
import "server-only";

import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { HONEYPOT_FIELD } from "./validate";

export const FORM_FLASH_COOKIE = "moto_lead_form";
export const FORM_FLASH_TTL_SECONDS = 300;
const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const SKIP = new Set([HONEYPOT_FIELD, "pagina", "idempotency_key"]);

type Flash = { tipo: string; values: Record<string, string> };

/** Sólo campos con nombre simple y valores cortos; el total entra en una cookie. */
export function flashValues(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  let size = 0;
  for (const [k, v] of Object.entries(fields)) {
    if (!KEY.test(k) || SKIP.has(k) || k === "tipo") continue;
    const value = v.slice(0, 500);
    size += k.length + value.length;
    if (size > 2500) break;
    out[k] = value;
  }
  return out;
}

function secret(): string | null {
  const s = process.env.SESSION_SECRET?.trim() ?? "";
  return s.length >= 32 ? s : null;
}

/** Cabecera Set-Cookie con los valores, o `null` sin SESSION_SECRET. */
export async function formFlashCookie(tipo: string, fields: Record<string, string>): Promise<string | null> {
  const password = secret();
  if (!password) return null;
  const sealed = await sealData({ tipo, values: flashValues(fields) } satisfies Flash, { password, ttl: FORM_FLASH_TTL_SECONDS });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${FORM_FLASH_COOKIE}=${sealed}; Path=/; Max-Age=${FORM_FLASH_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

/** Valores devueltos para este tipo de formulario, o `{}`. */
export async function readFormFlash(tipo: string): Promise<Record<string, string>> {
  const password = secret();
  const raw = (await cookies()).get(FORM_FLASH_COOKIE)?.value;
  if (!password || !raw) return {};
  try {
    const data = await unsealData<Partial<Flash>>(raw, { password, ttl: FORM_FLASH_TTL_SECONDS });
    return data.tipo === tipo && data.values ? flashValues(data.values) : {};
  } catch {
    return {};
  }
}
