// Contraseñas del admin: bcrypt coste 12 (ADMIN_SPEC.md §1, DATABASE_SCHEMA.md §2.1).
// bcryptjs es JavaScript puro: nada que compilar en el slot de Hostinger.
import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 12;
/** bcrypt sólo mira los primeros 72 bytes; más largo se rechaza en vez de truncar en silencio. */
export const MAX_PASSWORD_BYTES = 72;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `La contraseña no puede pasar de ${MAX_PASSWORD_BYTES} bytes.`;
  }
  return null;
}

export async function hashPassword(password: string, cost = BCRYPT_COST): Promise<string> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  return bcrypt.hash(password, cost);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// Hash de una contraseña que nadie conoce, con el mismo coste. Cuando el email
// no existe se compara contra éste para que el tiempo de respuesta no revele
// qué cuentas existen.
const DUMMY_HASH = "$2b$12$BOsTkg2leEtT51r2UT601uF0mYDhJBjknegYEmpcKngDK9e0EaRfi";

export async function burnPasswordCheck(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_HASH);
}
