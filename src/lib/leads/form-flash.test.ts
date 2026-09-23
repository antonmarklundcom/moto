import { describe, expect, it } from "vitest";
import { flashValues } from "./form-flash";

describe("flashValues", () => {
  it("guarda los campos del formulario, sin honeypot, tipo, página ni claves raras", () => {
    expect(flashValues({ nombre: "Ana", telefono: "123", website: "spam", tipo: "insurance", pagina: "/seguros", "x y": "1", Mayus: "2" })).toEqual({ nombre: "Ana", telefono: "123" });
  });
  it("recorta valores largos y el total", () => {
    const v = flashValues({ mensaje: "a".repeat(5000), otro: "b" });
    expect(v.mensaje).toHaveLength(500);
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`campo_${i}`, "x".repeat(400)]));
    expect(JSON.stringify(flashValues(many)).length).toBeLessThan(3000);
  });
});
