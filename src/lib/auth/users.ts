// Carga y alta de usuarios del panel. Sin `server-only` a propósito: lo usa
// también scripts/create-admin.ts, que corre con tsx fuera de Next.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "./password";
import { ADMIN_AREA_ROLES, type Role, type SessionUser } from "./roles";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Usuario activo, no borrado y con rol de panel. `null` para cualquier otra
 * cosa: la sesión de un usuario desactivado deja de valer en el próximo request.
 */
export async function loadSessionUser(id: number): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      dealerId: users.dealerId,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  if (!row || !row.isActive || !ADMIN_AREA_ROLES.includes(row.role)) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, dealerId: row.dealerId };
}

/** Para el login: incluye el hash. Sólo usuarios activos, no borrados, con rol de panel. */
export async function findLoginCandidate(email: string) {
  const [row] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(and(eq(users.email, normalizeEmail(email)), isNull(users.deletedAt)))
    .limit(1);
  if (!row || !row.isActive || !ADMIN_AREA_ROLES.includes(row.role)) return null;
  return row;
}

export type CreatePanelUserInput = {
  email: string;
  name: string;
  password: string;
  role: Extract<Role, "admin" | "moderator">;
  /** Si el email ya existe: `false` → error; `true` → se reemplaza la contraseña y se reactiva. */
  resetIfExists?: boolean;
};

/**
 * Alta de un admin o moderador (ADMIN_SPEC.md §1: sin registro público; por
 * script o por un admin existente). Los dealers se crean desde Comercios (fase 2).
 */
export async function createPanelUser(input: CreatePanelUserInput): Promise<{ id: number; created: boolean }> {
  const email = normalizeEmail(input.email);
  if (!isPlausibleEmail(email)) throw new Error(`Email inválido: ${input.email}`);
  const name = input.name.trim();
  if (!name) throw new Error("Falta el nombre.");
  const passwordHash = await hashPassword(input.password);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    if (!input.resetIfExists) {
      throw new Error(`Ya existe un usuario con ${email}. Usá --reset para cambiarle la contraseña.`);
    }
    await db
      .update(users)
      .set({ passwordHash, name, role: input.role, isActive: true, deletedAt: null })
      .where(eq(users.id, existing.id));
    return { id: existing.id, created: false };
  }

  const [res] = await db.insert(users).values({ email, name, passwordHash, role: input.role, isActive: true });
  return { id: res.insertId, created: true };
}
