import { describe, expect, it } from "vitest";
import { hashWithSalt } from "./hash";

describe("hashWithSalt", () => {
  it("devuelve un hex de 64 caracteres (SHA-256)", () => {
    const hash = hashWithSalt("127.0.0.1", "sal-de-prueba");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es determinístico para la misma entrada y sal", () => {
    expect(hashWithSalt("127.0.0.1", "sal")).toBe(hashWithSalt("127.0.0.1", "sal"));
  });

  it("cambia si cambia la sal", () => {
    expect(hashWithSalt("127.0.0.1", "sal-a")).not.toBe(hashWithSalt("127.0.0.1", "sal-b"));
  });

  it("nunca expone el valor original en el resultado", () => {
    const hash = hashWithSalt("127.0.0.1", "sal");
    expect(hash).not.toContain("127.0.0.1");
  });

  it("rechaza una sal vacía", () => {
    expect(() => hashWithSalt("127.0.0.1", "")).toThrow();
  });
});
