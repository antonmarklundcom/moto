import { describe, expect, it } from "vitest";
import { clientIp, RateLimiter, trustedProxyHops } from "./rate-limit";

describe("RateLimiter", () => {
  it("deja pasar hasta el límite y frena después, por clave", () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.check("a", 0).allowed).toBe(true);
    expect(rl.check("a", 10).allowed).toBe(true);
    expect(rl.check("a", 20)).toMatchObject({ allowed: true, remaining: 0 });
    expect(rl.check("a", 30)).toMatchObject({ allowed: false, retryAfterMs: 970 });
    expect(rl.check("b", 30).allowed).toBe(true);
  });

  it("la ventana se desliza", () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.check("a", 0).allowed).toBe(true);
    expect(rl.check("a", 999).allowed).toBe(false);
    expect(rl.check("a", 1001).allowed).toBe(true);
  });

  it("no crece sin tope", () => {
    const rl = new RateLimiter(1, 1000, 2);
    rl.check("a", 0);
    rl.check("b", 0);
    rl.check("c", 0);
    expect(rl.check("a", 1).allowed).toBe(true); // "a" fue descartada
  });
});

describe("clientIp", () => {
  it("toma el valor que agregó el proxy (derecha), no el que manda el cliente (izquierda)", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 190.1.2.3" }), 1)).toBe("190.1.2.3");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 190.1.2.3, 172.16.0.1" }), 2)).toBe("190.1.2.3");
    expect(clientIp(new Headers({ "x-forwarded-for": "190.1.2.3" }), 2)).toBe("190.1.2.3");
  });

  it("valores que no son IP no cuentan; X-Real-IP de respaldo", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "x" }), 1)).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": "basura", "x-real-ip": "190.1.2.4" }), 1)).toBe("190.1.2.4");
    expect(clientIp(new Headers({ "x-real-ip": "no-ip" }), 1)).toBeNull();
    expect(clientIp(new Headers())).toBeNull();
  });

  it("TRUSTED_PROXY_HOPS inválido → 1", () => {
    expect(trustedProxyHops(undefined)).toBe(1);
    expect(trustedProxyHops("0")).toBe(1);
    expect(trustedProxyHops("2")).toBe(2);
    expect(trustedProxyHops("abc")).toBe(1);
  });
});
