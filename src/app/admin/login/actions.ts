"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeAdminNext } from "@/lib/auth/admin-sections";
import { authenticate } from "@/lib/auth/login";
import { endSession, startSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { clientIp, RateLimiter } from "@/lib/rate-limit";

export type LoginState = { error: string | null };

// Primera barrera, en memoria: 20 envíos por minuto por IP. El bloqueo que
// cuenta (5 fallos) es el persistente de auth_attempts.
const burst = new RateLimiter(20, 60_000);

const INVALID = "El email o la contraseña no coinciden.";
const LOCKED = "Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.";

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  // Honeypot: un humano no ve ni completa este campo.
  if (String(form.get("website") ?? "") !== "") return { error: INVALID };

  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Completá el email y la contraseña." };

  const ip = clientIp(await headers());
  if (!burst.check(ip ?? "sin-ip").allowed) return { error: LOCKED };

  const result = await authenticate({ email, password, ip, salt: env.ipHashSalt() });
  if (!result.ok) return { error: result.reason === "locked" ? LOCKED : INVALID };

  await startSession(result.userId);
  redirect(safeAdminNext(String(form.get("next") ?? "")));
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/admin/login");
}
