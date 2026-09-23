import { describe, expect, it } from "vitest";
import { unlinkUnpublishedGuides } from "./links";

describe("unlinkUnpublishedGuides", () => {
  it("deja los enlaces a guías publicadas y convierte en texto los demás", () => {
    const html = '<p>Mirá <a href="/guias/si">esta guía</a> y <a href="/guias/no">esta otra</a>, y las <a href="/motos/usadas">usadas</a>.</p>';
    expect(unlinkUnpublishedGuides(html, new Set(["si"]))).toBe('<p>Mirá <a href="/guias/si">esta guía</a> y esta otra, y las <a href="/motos/usadas">usadas</a>.</p>');
  });
});
