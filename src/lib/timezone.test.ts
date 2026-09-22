import { describe, expect, it } from "vitest";

// G-25: Paraguay pasó a UTC-3 permanente en octubre de 2024.
// Un Node con tzdata/ICU viejo mostraría las horas corridas una hora durante
// medio año (el antiguo horario de invierno era UTC-4). Si esta prueba falla en
// el servidor, el Node del slot necesita un ICU más nuevo — no se "arregla" el test.
// [VERIFICAR: versión de Node disponible en el slot de Hostinger]
function hourInAsuncion(iso: string): string {
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

describe("zona horaria America/Asuncion (G-25)", () => {
  it("julio 2026 es UTC-3 (no UTC-4)", () => {
    expect(hourInAsuncion("2026-07-15T12:00:00Z")).toBe("09:00");
  });

  it("enero 2027 es UTC-3", () => {
    expect(hourInAsuncion("2027-01-15T12:00:00Z")).toBe("09:00");
  });
});
