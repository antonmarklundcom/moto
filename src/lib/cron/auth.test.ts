import { describe, expect, it } from "vitest";
import { checkCronAuth } from "./auth";

describe("checkCronAuth (ADR-19)", () => {
  it("sin CRON_SECRET → unconfigured (503), aunque venga un header", () => {
    expect(checkCronAuth("Bearer algo", null)).toBe("unconfigured");
  });
  it("bearer correcto → ok", () => {
    expect(checkCronAuth("Bearer s3cret-largo", "s3cret-largo")).toBe("ok");
    expect(checkCronAuth("bearer s3cret-largo", "s3cret-largo")).toBe("ok");
  });
  it("ausente, otro esquema o distinto → unauthorized", () => {
    expect(checkCronAuth(null, "s3cret-largo")).toBe("unauthorized");
    expect(checkCronAuth("Basic s3cret-largo", "s3cret-largo")).toBe("unauthorized");
    expect(checkCronAuth("Bearer s3cret-larg", "s3cret-largo")).toBe("unauthorized");
    expect(checkCronAuth("Bearer ", "s3cret-largo")).toBe("unauthorized");
  });
});
