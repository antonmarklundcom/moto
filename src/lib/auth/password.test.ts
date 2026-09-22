import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

describe("contraseñas", () => {
  it("bcrypt con coste 12 por defecto", async () => {
    const hash = await hashPassword("una-clave-bien-larga");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword("una-clave-bien-larga", hash)).toBe(true);
    expect(await verifyPassword("otra-clave-bien-larga", hash)).toBe(false);
  });

  it("hash inválido o vacío → false, nunca lanza", async () => {
    expect(await verifyPassword("x", "no-es-un-hash")).toBe(false);
    expect(await verifyPassword("", "")).toBe(false);
  });

  it("largo mínimo y máximo", () => {
    expect(passwordProblem("corta")).toMatch(/12/);
    expect(passwordProblem("a".repeat(73))).toMatch(/72/);
    expect(passwordProblem("a".repeat(12))).toBeNull();
  });
});
