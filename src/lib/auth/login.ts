// Verificación de credenciales del panel. Separada de la cookie para poder
// probarla contra MySQL sin un request de Next.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { attemptKeys, isLockedOut, markAttemptSucceeded, reserveAttempt } from "./lockout";
import { burnPasswordCheck, verifyPassword } from "./password";
import { findLoginCandidate, isPlausibleEmail, normalizeEmail } from "./users";

export type LoginResult = { ok: true; userId: number } | { ok: false; reason: "invalid" | "locked" };

export async function authenticate(input: {
  email: string;
  password: string;
  ip: string | null;
  salt: string;
  now?: Date;
}): Promise<LoginResult> {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);
  const keys = attemptKeys(email, input.ip, input.salt);

  // Bloqueado: no se mira la contraseña ni se registra el intento. Así el
  // bloqueo termina 15 min después del quinto fallo aunque el atacante siga.
  if (await isLockedOut(keys, now)) return { ok: false, reason: "locked" };

  const attempt = await reserveAttempt(keys, now);
  if (attempt.overLimit) return { ok: false, reason: "locked" };

  const candidate = isPlausibleEmail(email) ? await findLoginCandidate(email) : null;
  let ok = false;
  if (candidate) {
    ok = await verifyPassword(input.password, candidate.passwordHash);
  } else {
    await burnPasswordCheck(input.password);
  }

  if (!ok || !candidate) return { ok: false, reason: "invalid" };
  await markAttemptSucceeded(attempt.id);

  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, candidate.id));
  return { ok: true, userId: candidate.id };
}
