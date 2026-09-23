// INTEGRATIONS.md §2.8: backoff 1 min, 5 min, 30 min, 2 h; tope 5 intentos.
import { describe, expect, it } from "vitest";
import { FIRST_ATTEMPT_GRACE_MS, MAX_CRM_ATTEMPTS, nextAttemptDue } from "./backoff";

const created = new Date("2026-09-23T12:00:00Z");
const last = new Date("2026-09-23T12:10:00Z");
const min = 60_000;

describe("nextAttemptDue", () => {
  it("sin intentos: al minuto de creado (el envío inmediato va primero)", () => {
    expect(nextAttemptDue({ crmAttempts: 0, createdAt: created, lastAttemptAt: null })).toEqual(
      new Date(created.getTime() + FIRST_ATTEMPT_GRACE_MS),
    );
  });

  it.each([
    [1, 1],
    [2, 5],
    [3, 30],
    [4, 120],
  ])("tras el intento %i espera %i min", (attempts, minutes) => {
    expect(nextAttemptDue({ crmAttempts: attempts, createdAt: created, lastAttemptAt: last })).toEqual(
      new Date(last.getTime() + minutes * min),
    );
  });

  it("a los 5 intentos se detiene", () => {
    expect(MAX_CRM_ATTEMPTS).toBe(5);
    expect(nextAttemptDue({ crmAttempts: 5, createdAt: created, lastAttemptAt: last })).toBeNull();
    expect(nextAttemptDue({ crmAttempts: 9, createdAt: created, lastAttemptAt: last })).toBeNull();
  });
});
