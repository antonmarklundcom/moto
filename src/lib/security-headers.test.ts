import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, originOf, securityHeaders } from "./security-headers";

describe("originOf", () => {
  it("extrae el origen", () => {
    expect(originOf("https://crm.ejemplo.com/api/v1")).toBe("https://crm.ejemplo.com");
  });
  it("null para vacío o inválido", () => {
    expect(originOf("")).toBeNull();
    expect(originOf(null)).toBeNull();
    expect(originOf("no es url")).toBeNull();
    expect(originOf("javascript:alert(1)")).toBeNull();
  });
});

describe("contentSecurityPolicy (G-26)", () => {
  it("permite el origen de VenderCRM en script-src y connect-src", () => {
    const csp = contentSecurityPolicy({ vendercrmUrl: "https://crm.ejemplo.com" });
    expect(csp).toMatch(/script-src [^;]*https:\/\/crm\.ejemplo\.com/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/crm\.ejemplo\.com/);
  });

  it("sin VENDERCRM_URL no agrega orígenes externos", () => {
    const csp = contentSecurityPolicy({ vendercrmUrl: null });
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it("cierra frames, object, base-uri y form-action", () => {
    const csp = contentSecurityPolicy();
    for (const directive of [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it("'unsafe-eval' sólo en desarrollo", () => {
    expect(contentSecurityPolicy({ isDev: false })).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ isDev: true })).toContain("unsafe-eval");
  });
});

describe("securityHeaders", () => {
  it("incluye las cabeceras obligatorias en producción", () => {
    const keys = securityHeaders().map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });

  it("no manda HSTS en desarrollo (http://localhost)", () => {
    expect(securityHeaders({ isDev: true }).map((h) => h.key)).not.toContain(
      "Strict-Transport-Security",
    );
  });
});
