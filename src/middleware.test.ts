import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sealSession, SESSION_COOKIE, unsealSession } from "@/lib/auth/session-seal";
import { middleware } from "./middleware";

const SECRET = "m".repeat(48);
let saved: string | undefined;

beforeAll(() => {
  saved = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = SECRET;
});
afterAll(() => {
  process.env.SESSION_SECRET = saved;
});

function req(path: string, cookie?: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(cookie)}` } : {},
  });
}

describe("middleware del panel", () => {
  it("anónimo en /admin/** → login con next", async () => {
    const res = await middleware(req("/admin/leads?page=2"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("next")).toBe("/admin/leads?page=2");
  });

  it("anónimo en /api/admin/** → 401", async () => {
    const res = await middleware(req("/api/admin/algo"));
    expect(res.status).toBe(401);
  });

  it("cookie adulterada → como anónimo", async () => {
    const res = await middleware(req("/admin", "Fe26.2**basura"));
    expect(res.status).toBe(307);
  });

  it("el login pasa sin sesión", async () => {
    const res = await middleware(req("/admin/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("sesión válida → pasa, noindex, y se renueva si tiene más de un día", async () => {
    const fresh = await sealSession(5, SECRET);
    const ok = await middleware(req("/admin", fresh));
    expect(ok.headers.get("location")).toBeNull();
    expect(ok.headers.get("x-robots-tag")).toContain("noindex");
    expect(ok.cookies.get(SESSION_COOKIE)).toBeUndefined();

    const old = await sealSession(5, SECRET, new Date(Date.now() - 2 * 86_400_000));
    const renewed = await middleware(req("/admin", old));
    const cookie = renewed.cookies.get(SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    const payload = await unsealSession(cookie!.value, SECRET);
    expect(payload?.uid).toBe(5);
    expect(Date.now() / 1000 - payload!.iat).toBeLessThan(60);
  });
});
