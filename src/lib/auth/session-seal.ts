// Sellado de la cookie de sesión (iron-session, ADMIN_SPEC.md §1). Sin base y
// sin `server-only`, para que lo use también el middleware: quien llama pasa
// el secreto (env.sessionSecret()).
//
// La cookie sólo lleva el id de usuario y la fecha de emisión. Rol, comercio y
// estado se recargan de la base en cada request (session.ts): desactivar un
// usuario o cambiarle el rol corta su acceso en el acto.
import { sealData, unsealData } from "iron-session";

export const SESSION_COOKIE = "moto_admin";
/** 7 días, renovables (ADMIN_SPEC.md §1). */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Una sesión con más de un día se vuelve a sellar: 7 días desde el último uso. */
export const SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60;

export type SessionPayload = { uid: number; iat: number };

function assertSecret(secret: string): void {
  // iron-session exige ≥ 32 caracteres; se falla con un mensaje propio.
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET tiene que tener al menos 32 caracteres.");
  }
}

export async function sealSession(uid: number, secret: string, now = new Date()): Promise<string> {
  assertSecret(secret);
  const payload: SessionPayload = { uid, iat: Math.floor(now.getTime() / 1000) };
  return sealData(payload, { password: secret, ttl: SESSION_TTL_SECONDS });
}

/** `null` ante cookie ausente, vencida, adulterada o con forma inesperada. Nunca lanza por la cookie. */
export async function unsealSession(value: string | undefined | null, secret: string): Promise<SessionPayload | null> {
  assertSecret(secret);
  if (!value) return null;
  try {
    const data = await unsealData<Partial<SessionPayload>>(value, { password: secret, ttl: SESSION_TTL_SECONDS });
    if (typeof data?.uid !== "number" || !Number.isSafeInteger(data.uid) || data.uid <= 0) return null;
    if (typeof data.iat !== "number") return null;
    return { uid: data.uid, iat: data.iat };
  } catch {
    return null;
  }
}

export function sessionNeedsRenewal(payload: SessionPayload, now = new Date()): boolean {
  return Math.floor(now.getTime() / 1000) - payload.iat >= SESSION_RENEW_AFTER_SECONDS;
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    // El sello vence a los 7 días; la cookie, un minuto antes.
    maxAge: SESSION_TTL_SECONDS - 60,
  };
}

/** Lee una cookie de un header `Cookie` crudo. Para route handlers y pruebas. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      const raw = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}
