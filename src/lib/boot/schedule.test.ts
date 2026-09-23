import { describe, expect, it } from "vitest";
import { autoSetupEnabled, firstDelayMs, internalCronEnabled, JOB_EVERY_MS } from "./schedule";

describe("programador interno", () => {
  it("reintenta leads cada 5 minutos", () => {
    expect(JOB_EVERY_MS["retry-leads"]).toBe(5 * 60_000);
  });
  it("sólo en producción y apagable", () => {
    expect(internalCronEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(internalCronEnabled({ NODE_ENV: "production", INTERNAL_CRON: "false" })).toBe(false);
    expect(internalCronEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(autoSetupEnabled({})).toBe(true);
    expect(autoSetupEnabled({ AUTO_SETUP: "FALSE" })).toBe(false);
    expect(firstDelayMs(0)).toBeGreaterThanOrEqual(60_000);
  });
});
