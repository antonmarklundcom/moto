import { describe, expect, it, vi } from "vitest";

// Pruebas unitarias sin base: la inserción se prueba en events.int.test.ts.
vi.mock("@/db", () => ({ db: {} }));

import { detectBot, isBotUserAgent, isOwnReferer, sanitizeReferrer, visitorHashes } from "./events";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const site = "https://moto.com.py";

describe("isBotUserAgent (ANALYTICS_AND_KPIS.md §2.1)", () => {
  it("navegadores reales no son bots", () => {
    expect(isBotUserAgent(CHROME_ANDROID)).toBe(false);
    expect(isBotUserAgent(SAFARI_IOS)).toBe(false);
  });
  it("buscadores, previsualizaciones y herramientas sí", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "WhatsApp/2.23.20.0 A",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "TelegramBot (like TwitterBot)",
      "curl/8.5.0",
      "python-requests/2.31.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    ]) {
      expect(isBotUserAgent(ua), ua).toBe(true);
    }
  });
  it("vacío o muy corto → bot", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("Mozilla")).toBe(true);
  });
});

describe("detectBot", () => {
  const human = { userAgent: CHROME_ANDROID, referer: `${site}/aviso/x-a3f9k2p7`, siteUrl: site, internalNavigation: true, burst: false };
  it("clic de CTA con referer propio → persona", () => {
    expect(detectBot(human)).toBe(false);
    expect(detectBot({ ...human, referer: "https://www.moto.com.py/motos" })).toBe(false);
  });
  it("clic de CTA sin referer propio → bot", () => {
    expect(detectBot({ ...human, referer: null })).toBe(true);
    expect(detectBot({ ...human, referer: "https://otro-sitio.com/" })).toBe(true);
    expect(detectBot({ ...human, referer: "https://moto.com.py.evil.com/" })).toBe(true);
  });
  it("una vista puede llegar sin referer (enlace compartido por WhatsApp)", () => {
    expect(detectBot({ ...human, referer: null, internalNavigation: false })).toBe(false);
  });
  it("más de 30 vistas en 10 minutos → bot", () => {
    expect(detectBot({ ...human, internalNavigation: false, burst: true })).toBe(true);
  });
});

describe("privacidad", () => {
  it("referrer sin query ni fragmento", () => {
    expect(sanitizeReferrer("https://www.google.com/search?q=tel+0981123456#x")).toBe("https://www.google.com/search");
    expect(sanitizeReferrer("android-app://com.whatsapp/")).toBeNull();
    expect(sanitizeReferrer("no es url")).toBeNull();
    expect(sanitizeReferrer(null)).toBeNull();
  });
  it("isOwnReferer ignora www y compara host completo", () => {
    expect(isOwnReferer("https://moto.com.py/x", site)).toBe(true);
    expect(isOwnReferer("https://moto.com.py:8443/x", site)).toBe(false);
    expect(isOwnReferer("garbage", site)).toBe(false);
  });
  it("hashes con sal, sin valores en claro; sesión cambia de día", () => {
    const day1 = new Date("2026-09-22T10:00:00Z");
    const day2 = new Date("2026-09-23T10:00:00Z");
    const a = visitorHashes("181.120.1.2", CHROME_ANDROID, "sal-de-prueba", day1);
    expect(a.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.userAgentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.sessionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(a)).not.toContain("181.120");
    expect(visitorHashes("181.120.1.2", CHROME_ANDROID, "sal-de-prueba", day1).sessionHash).toBe(a.sessionHash);
    const b = visitorHashes("181.120.1.2", CHROME_ANDROID, "sal-de-prueba", day2);
    expect(b.sessionHash).not.toBe(a.sessionHash);
    expect(b.ipHash).toBe(a.ipHash);
    expect(visitorHashes("181.120.1.2", CHROME_ANDROID, "otra-sal", day1).ipHash).not.toBe(a.ipHash);
  });
  it("sin sal no se guarda nada identificable", () => {
    expect(visitorHashes("181.120.1.2", CHROME_ANDROID, null, new Date())).toEqual({ sessionHash: null, ipHash: null, userAgentHash: null });
  });
});
