import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readCookie,
  sealSession,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  sessionNeedsRenewal,
  unsealSession,
} from "./session-seal";

const SECRET = "s".repeat(40);

afterEach(() => {
  vi.useRealTimers();
});

describe("cookie de sesión sellada", () => {
  it("ida y vuelta", async () => {
    const seal = await sealSession(42, SECRET);
    expect(await unsealSession(seal, SECRET)).toMatchObject({ uid: 42 });
  });

  it("otro secreto, cookie adulterada o basura → null", async () => {
    const seal = await sealSession(42, SECRET);
    expect(await unsealSession(seal, "t".repeat(40))).toBeNull();
    expect(await unsealSession(seal.slice(0, -4) + "AAAA", SECRET)).toBeNull();
    expect(await unsealSession("basura", SECRET)).toBeNull();
    expect(await unsealSession(undefined, SECRET)).toBeNull();
  });

  it("vence a los 7 días", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const seal = await sealSession(42, SECRET);
    vi.setSystemTime(new Date(Date.parse("2026-09-01T00:00:00Z") + (SESSION_TTL_SECONDS - 3600) * 1000));
    expect(await unsealSession(seal, SECRET)).not.toBeNull();
    vi.setSystemTime(new Date(Date.parse("2026-09-01T00:00:00Z") + (SESSION_TTL_SECONDS + 3600) * 1000));
    expect(await unsealSession(seal, SECRET)).toBeNull();
  });

  it("secreto corto → error de configuración, no una sesión débil", async () => {
    await expect(sealSession(1, "corto")).rejects.toThrow(/32/);
  });

  it("renovación después de un día", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    const iat = Math.floor(now.getTime() / 1000);
    expect(sessionNeedsRenewal({ uid: 1, iat: iat - 3600 }, now)).toBe(false);
    expect(sessionNeedsRenewal({ uid: 1, iat: iat - 86_400 }, now)).toBe(true);
  });

  it("opciones de cookie: httpOnly, sameSite=lax, 7 días", () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(sessionCookieOptions(true).maxAge).toBeLessThan(SESSION_TTL_SECONDS);
  });

  it("readCookie", () => {
    expect(readCookie("a=1; moto_admin=xyz%3D; b=2", "moto_admin")).toBe("xyz=");
    expect(readCookie("a=1", "moto_admin")).toBeNull();
    expect(readCookie(null, "moto_admin")).toBeNull();
  });
});
