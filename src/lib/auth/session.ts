// Sesión del panel en el servidor: cookie sellada (session-seal.ts) + usuario
// recargado de la base. `requireRole` es la puerta de toda página, acción y
// route handler del admin (CLAUDE.md §3.3).
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { assertRole, ForbiddenError, UnauthorizedError, type Role, type SessionUser } from "./roles";
import {
  readCookie,
  sealSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  unsealSession,
} from "./session-seal";
import { loadSessionUser } from "./users";

export function secureCookies(): boolean {
  return env.isProduction();
}

/** Usuario de una cookie ya leída. `null` si no hay sesión válida. */
export async function sessionUserFromCookieValue(value: string | null | undefined): Promise<SessionUser | null> {
  const payload = await unsealSession(value, env.sessionSecret());
  if (!payload) return null;
  return loadSessionUser(payload.uid);
}

/** Usuario de la sesión actual (páginas, server actions). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return sessionUserFromCookieValue(store.get(SESSION_COOKIE)?.value);
}

/**
 * Para server actions y route handlers: lanza UnauthorizedError (401) o
 * ForbiddenError (403). Devuelve el usuario para aplicar el alcance de fila.
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  return assertRole(await getSessionUser(), roles);
}

/**
 * Para páginas del admin: sin sesión → login (volviendo a `path`); con rol
 * insuficiente → portada del panel con aviso. Nunca muestra la página.
 */
export async function requirePageRole(path: string, ...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  try {
    return assertRole(user, roles);
  } catch {
    redirect("/admin?aviso=sin-permiso");
  }
}

/** Crea la sesión tras un login correcto (server action). */
export async function startSession(userId: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await sealSession(userId, env.sessionSecret()), sessionCookieOptions(secureCookies()));
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Envuelve un route handler de mutación: sin sesión → 401, rol o fila ajena →
 * 403, antes de que el handler toque nada. El handler recibe el usuario y
 * aplica el alcance de fila (assertInScope / scopeCondition); si lanza
 * ForbiddenError también sale como 403.
 */
export function withRole<Ctx>(
  roles: readonly Role[],
  handler: (user: SessionUser, request: Request, ctx: Ctx) => Promise<Response>,
): (request: Request, ctx: Ctx) => Promise<Response> {
  return async (request, ctx) => {
    try {
      const value = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
      const user = assertRole(await sessionUserFromCookieValue(value), roles);
      return await handler(user, request, ctx);
    } catch (error) {
      if (error instanceof UnauthorizedError) return json(401, { error: "unauthorized" });
      if (error instanceof ForbiddenError) return json(403, { error: "forbidden" });
      throw error;
    }
  };
}
