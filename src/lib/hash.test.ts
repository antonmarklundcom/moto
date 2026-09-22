import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashWithSalt, leadIdempotencyKey, sha256Hex, utcHourBucket } from "./hash";

describe("hashWithSalt", () => {
  it("devuelve un hex de 64 caracteres", () => {
    const hash = hashWithSalt("127.0.0.1", "sal-de-prueba");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es un HMAC-SHA256 con la sal como clave (F-6)", () => {
    const expected = createHmac("sha256", "sal").update("127.0.0.1").digest("hex");
    expect(hashWithSalt("127.0.0.1", "sal")).toBe(expected);
    const naive = createHash("sha256").update("127.0.0.1|sal").digest("hex");
    expect(hashWithSalt("127.0.0.1", "sal")).not.toBe(naive);
  });

  it("es determinístico para la misma entrada y sal", () => {
    expect(hashWithSalt("127.0.0.1", "sal")).toBe(hashWithSalt("127.0.0.1", "sal"));
  });

  it("cambia si cambia la sal", () => {
    expect(hashWithSalt("127.0.0.1", "sal-a")).not.toBe(hashWithSalt("127.0.0.1", "sal-b"));
  });

  it("nunca expone el valor original en el resultado", () => {
    expect(hashWithSalt("127.0.0.1", "sal")).not.toContain("127.0.0.1");
  });

  it("rechaza una sal vacía", () => {
    expect(() => hashWithSalt("127.0.0.1", "")).toThrow();
  });
});

describe("sha256Hex", () => {
  it("coincide con node:crypto", () => {
    expect(sha256Hex("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
  });
});

describe("utcHourBucket", () => {
  it("usa UTC, no la zona del proceso", () => {
    expect(utcHourBucket(new Date("2026-09-22T23:59:59-03:00"))).toBe("2026-09-23-02");
  });
});

// TEST_PLAN.md §2 punto 3, con la fórmula de ADR-25.
describe("leadIdempotencyKey (ADR-25)", () => {
  const phone = "+595981123456";
  const at = new Date("2026-09-22T14:10:00Z");

  it("sigue la fórmula sha256(phone|type|YYYY-MM-DD-HH)", () => {
    expect(leadIdempotencyKey(phone, "financing", at)).toBe(
      sha256Hex("+595981123456|financing|2026-09-22-14"),
    );
  });

  it("misma entrada y misma hora → misma clave", () => {
    const later = new Date("2026-09-22T14:59:59Z");
    expect(leadIdempotencyKey(phone, "financing", at)).toBe(
      leadIdempotencyKey(phone, "financing", later),
    );
  });

  it("hora distinta → clave distinta", () => {
    const nextHour = new Date("2026-09-22T15:00:00Z");
    expect(leadIdempotencyKey(phone, "financing", at)).not.toBe(
      leadIdempotencyKey(phone, "financing", nextHour),
    );
  });

  it("tipo distinto en la misma hora → clave distinta (F-3)", () => {
    expect(leadIdempotencyKey(phone, "financing", at)).not.toBe(
      leadIdempotencyKey(phone, "insurance", at),
    );
  });

  it("largo entre 8 y 100 (INTEGRATIONS.md §2.3)", () => {
    const key = leadIdempotencyKey(phone, "financing", at);
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(100);
  });

  it("rechaza un teléfono sin normalizar", () => {
    expect(() => leadIdempotencyKey("0981 123 456", "financing", at)).toThrow();
  });
});
