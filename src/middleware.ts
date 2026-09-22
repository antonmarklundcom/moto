// Primera barrera del panel (ADMIN_SPEC.md §1): sin cookie de sesión válida,
// /admin/** redirige al login y /api/admin/** responde 401. También renueva la
// sesión (7 días desde el último uso).
//
// No reemplaza a requireRole: el middleware no mira rol ni si el usuario sigue
// activo. Toda página, acción y route handler lo vuelve a validar en el servidor.
import { NextResponse, type NextRequest } from "next/server";
import {
  sealSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionNeedsRenewal,
  unsealSession,
} from "@/lib/auth/session-seal";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return NextResponse.next();

  // Mismo secreto que env.sessionSecret(); se lee directo porque env.ts es
  // `server-only` y el middleware corre en el runtime edge.
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  const payload = secret.length >= 32 ? await unsealSession(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (sessionNeedsRenewal(payload)) {
    response.cookies.set(
      SESSION_COOKIE,
      await sealSession(payload.uid, secret),
      sessionCookieOptions(process.env.NODE_ENV === "production"),
    );
  }
  return response;
}
