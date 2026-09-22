import { afterEach, describe, expect, it, vi } from "vitest";
import { env, globalIndexingAllows, parseSiteIndexingMode, siteIndexingMode } from "./env";

describe("parseSiteIndexingMode (ADR-26)", () => {
  it.each([
    ["true", "none"],
    ["TRUE", "none"],
    ["content", "content"],
    [" Content ", "content"],
    ["false", "rules"],
  ] as const)("%s → %s", (raw, mode) => {
    expect(parseSiteIndexingMode(raw)).toBe(mode);
  });

  it.each([[undefined], [null], [""], ["0"], ["no"], ["off"], ["flase"]])(
    "falla cerrado: %s → none",
    (raw) => {
      expect(parseSiteIndexingMode(raw)).toBe("none");
    },
  );
});

describe("globalIndexingAllows", () => {
  it("none bloquea todo", () => {
    expect(globalIndexingAllows("content", "none")).toBe(false);
    expect(globalIndexingAllows("inventory", "none")).toBe(false);
  });

  it("content sólo deja contenido", () => {
    expect(globalIndexingAllows("content", "content")).toBe(true);
    expect(globalIndexingAllows("inventory", "content")).toBe(false);
  });

  it("rules deja pasar todo (el umbral lo decide src/lib/seo)", () => {
    expect(globalIndexingAllows("content", "rules")).toBe(true);
    expect(globalIndexingAllows("inventory", "rules")).toBe(true);
  });
});

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("siteIndexingMode lee SITE_NOINDEX", () => {
    vi.stubEnv("SITE_NOINDEX", "content");
    expect(siteIndexingMode()).toBe("content");
  });

  it("siteUrl quita la barra final", () => {
    vi.stubEnv("SITE_URL", "https://moto.com.py/");
    expect(env.siteUrl()).toBe("https://moto.com.py");
  });

  it("los opcionales vacíos son null, no cadena vacía", () => {
    vi.stubEnv("VENDERCRM_URL", "");
    vi.stubEnv("VENDERCRM_API_KEY", "  ");
    expect(env.vendercrmUrl()).toBeNull();
    expect(env.vendercrmApiKey()).toBeNull();
  });

  it("un obligatorio faltante lanza al usarse, con el nombre", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => env.sessionSecret()).toThrow(/SESSION_SECRET/);
  });

  it("smtp es null sin host", () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(env.smtp()).toBeNull();
  });
});
