import { describe, expect, it, vi } from "vitest";
import { generateManageToken, hashManageToken, isWellFormedManageToken, verifyManageToken } from "./manage-token";

vi.mock("@/db", () => ({ db: {} }));

describe("token del enlace privado (G-1)", () => {
  it("32 bytes en base64url, 43 caracteres, hash SHA-256 hex", () => {
    const { token, hash } = generateManageToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashManageToken(token));
    expect(hash).not.toContain(token);
  });

  it("no se repite", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateManageToken().token));
    expect(seen.size).toBe(200);
  });

  it("verifica el propio y rechaza cualquier otro", () => {
    const { token, hash } = generateManageToken();
    const other = generateManageToken();
    expect(verifyManageToken(token, hash)).toBe(true);
    expect(verifyManageToken(other.token, hash)).toBe(false);
    expect(verifyManageToken(token, null)).toBe(false);
    expect(verifyManageToken(token, "abc")).toBe(false);
    expect(verifyManageToken(token.slice(0, 42), hash)).toBe(false);
    expect(verifyManageToken(`${token.slice(0, 42)}!`, hash)).toBe(false);
  });

  it("forma", () => {
    expect(isWellFormedManageToken("x")).toBe(false);
    expect(isWellFormedManageToken("a".repeat(43))).toBe(true);
    expect(isWellFormedManageToken("a".repeat(44))).toBe(false);
  });
});
