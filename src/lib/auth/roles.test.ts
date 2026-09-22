import { describe, expect, it } from "vitest";
import { listings } from "@/db/schema";
import {
  assertInScope,
  assertRole,
  ForbiddenError,
  inScope,
  rowScope,
  scopeCondition,
  type SessionUser,
  UnauthorizedError,
} from "./roles";

const admin: SessionUser = { id: 1, email: "a@x.py", name: "A", role: "admin", dealerId: null };
const moderator: SessionUser = { ...admin, id: 2, role: "moderator" };
const dealer: SessionUser = { ...admin, id: 3, role: "dealer", dealerId: 7 };
const orphanDealer: SessionUser = { ...admin, id: 4, role: "dealer", dealerId: null };
const seller: SessionUser = { ...admin, id: 5, role: "seller" };

describe("assertRole", () => {
  it("sin usuario → 401", () => {
    expect(() => assertRole(null, ["admin"])).toThrow(UnauthorizedError);
  });
  it("rol fuera de la lista → 403", () => {
    expect(() => assertRole(moderator, ["admin"])).toThrow(ForbiddenError);
    expect(() => assertRole(dealer, ["admin", "moderator"])).toThrow(ForbiddenError);
    expect(() => assertRole(seller, ["admin", "moderator", "dealer"])).toThrow(ForbiddenError);
  });
  it("rol permitido → devuelve el usuario", () => {
    expect(assertRole(admin, ["admin"])).toBe(admin);
    expect(assertRole(dealer, ["admin", "dealer"])).toBe(dealer);
  });
  it("dealer sin comercio → 403 aunque el rol esté permitido", () => {
    expect(() => assertRole(orphanDealer, ["dealer"])).toThrow(ForbiddenError);
  });
});

describe("alcance de fila", () => {
  it("admin y moderator ven todo", () => {
    expect(rowScope(admin)).toEqual({ kind: "all" });
    expect(rowScope(moderator)).toEqual({ kind: "all" });
    expect(scopeCondition(admin, { dealer: listings.dealerId, owner: listings.ownerUserId })).toBeUndefined();
  });

  it("dealer → sólo su dealerId", () => {
    expect(rowScope(dealer)).toEqual({ kind: "dealer", dealerId: 7 });
    expect(inScope(dealer, { dealerId: 7 })).toBe(true);
    expect(inScope(dealer, { dealerId: 8 })).toBe(false);
    expect(inScope(dealer, { dealerId: null, ownerUserId: 3 })).toBe(false);
    expect(() => assertInScope(dealer, { dealerId: 8 })).toThrow(ForbiddenError);
    expect(scopeCondition(dealer, { dealer: listings.dealerId })).toBeDefined();
  });

  it("seller → sólo su ownerId", () => {
    expect(rowScope(seller)).toEqual({ kind: "owner", ownerId: 5 });
    expect(inScope(seller, { dealerId: null, ownerUserId: 5 })).toBe(true);
    expect(inScope(seller, { dealerId: null, ownerUserId: 6 })).toBe(false);
    expect(inScope(seller, { dealerId: null, ownerUserId: null })).toBe(false);
    expect(inScope(seller, { dealerId: 7 })).toBe(false);
  });

  it("dealer sin comercio no tiene alcance", () => {
    expect(() => rowScope(orphanDealer)).toThrow(ForbiddenError);
  });

  it("seller sobre una tabla sin dueño → condición, nunca 'todo'", () => {
    expect(scopeCondition(seller, { dealer: listings.dealerId })).toBeDefined();
  });
});
