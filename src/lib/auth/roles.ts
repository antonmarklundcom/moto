// Roles y autorización del lado del servidor (ADMIN_SPEC.md §2, CLAUDE.md §3.3).
//
// Ocultar un botón no es un permiso: toda mutación pasa por `assertRole` (o por
// `requireRole`/`withRole`, que lo llaman) y, para roles con alcance, por el
// filtro de fila de este archivo. Módulo puro: sin base ni cookies, se prueba
// con unitarias.
import { and, eq, type SQL } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";
import type { userRoleEnum } from "@/db/schema";

export type Role = (typeof userRoleEnum)[number];

/** El usuario de la sesión, recargado de la base en cada request (nunca sólo de la cookie). */
export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  /** Obligatorio si role = dealer (validado en aplicación, DATABASE_SCHEMA.md §2.1). */
  dealerId: number | null;
};

/** Roles que pueden entrar a /admin. `seller` no tiene panel (G-1: enlace privado). */
export const ADMIN_AREA_ROLES: readonly Role[] = ["admin", "moderator", "dealer"];

/** Sin sesión válida → 401 en API, redirección al login en páginas. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Sesión requerida") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Con sesión pero sin permiso (rol o fila ajena) → 403. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Sin permiso") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Lanza si no hay usuario o si su rol no está en `roles`. Devuelve el usuario ya estrechado. */
export function assertRole(user: SessionUser | null | undefined, roles: readonly Role[]): SessionUser {
  if (!user) throw new UnauthorizedError();
  if (!roles.includes(user.role)) throw new ForbiddenError(`Rol ${user.role} no autorizado`);
  if (user.role === "dealer" && user.dealerId === null) {
    // Un dealer sin comercio no tiene alcance: nunca se lo trata como "todo".
    throw new ForbiddenError("Usuario dealer sin comercio asignado");
  }
  return user;
}

/**
 * Alcance de fila de un usuario:
 * - admin, moderator → todo;
 * - dealer → sólo filas con `dealer_id` = su comercio;
 * - seller → sólo filas con `owner_user_id` = su id.
 */
export type RowScope =
  | { kind: "all" }
  | { kind: "dealer"; dealerId: number }
  | { kind: "owner"; ownerId: number };

export function rowScope(user: SessionUser): RowScope {
  switch (user.role) {
    case "admin":
    case "moderator":
      return { kind: "all" };
    case "dealer":
      if (user.dealerId === null) throw new ForbiddenError("Usuario dealer sin comercio asignado");
      return { kind: "dealer", dealerId: user.dealerId };
    case "seller":
      return { kind: "owner", ownerId: user.id };
  }
}

/** Columnas de alcance de una tabla. `owner` es opcional: `leads` no tiene dueño usuario. */
export type ScopeColumns = { dealer: MySqlColumn; owner?: MySqlColumn };

/**
 * Condición SQL del alcance, para sumar al WHERE de toda lectura y mutación.
 * `undefined` = sin filtro (admin, moderator). Una tabla sin columna de dueño
 * con un `seller` da una condición imposible, no "todo".
 */
export function scopeCondition(user: SessionUser, columns: ScopeColumns): SQL | undefined {
  const scope = rowScope(user);
  if (scope.kind === "all") return undefined;
  if (scope.kind === "dealer") return eq(columns.dealer, scope.dealerId);
  if (!columns.owner) return eq(columns.dealer, -1);
  return eq(columns.owner, scope.ownerId);
}

/** `where` con el alcance aplicado: `and(cond, alcance)`. */
export function withScope(user: SessionUser, columns: ScopeColumns, condition?: SQL): SQL | undefined {
  return and(condition, scopeCondition(user, columns));
}

/** ¿La fila entra en el alcance del usuario? Para chequear una fila ya leída. */
export function inScope(
  user: SessionUser,
  row: { dealerId: number | null; ownerUserId?: number | null },
): boolean {
  const scope = rowScope(user);
  if (scope.kind === "all") return true;
  if (scope.kind === "dealer") return row.dealerId === scope.dealerId;
  return row.ownerUserId !== undefined && row.ownerUserId !== null && row.ownerUserId === scope.ownerId;
}

export function assertInScope(
  user: SessionUser,
  row: { dealerId: number | null; ownerUserId?: number | null },
): void {
  if (!inScope(user, row)) throw new ForbiddenError("Fila fuera del alcance del usuario");
}
