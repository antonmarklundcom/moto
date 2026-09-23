// INTEGRATIONS.md §2.6: cada código de respuesta.
import { describe, expect, it } from "vitest";
import { classifyCrmResponse } from "./response";

describe("classifyCrmResponse", () => {
  it("201 → sent con ids", () => {
    const r = classifyCrmResponse(201, JSON.stringify({ contactId: "c1", dealId: 7, submissionId: "s1", duplicate: false }));
    expect(r).toMatchObject({ outcome: "sent", contactId: "c1", dealId: "7", error: null });
  });

  it("201 sin deal (sitio sin etapa por defecto) sigue siendo sent", () => {
    expect(classifyCrmResponse(201, JSON.stringify({ contactId: "c1", dealId: null, submissionId: "s1" }))).toMatchObject({
      outcome: "sent",
      dealId: null,
    });
  });

  it("200 duplicate:true → duplicate (es éxito)", () => {
    expect(classifyCrmResponse(200, JSON.stringify({ contactId: "c1", dealId: "d1", duplicate: true }))).toMatchObject({
      outcome: "duplicate",
      contactId: "c1",
      error: null,
    });
  });

  it("2xx con cuerpo mal formado → failed (reintento seguro), nunca sent", () => {
    expect(classifyCrmResponse(200, "<html>proxy</html>").outcome).toBe("failed");
    expect(classifyCrmResponse(200, JSON.stringify({ duplicate: false })).outcome).toBe("failed");
    expect(classifyCrmResponse(201, "no json").outcome).toBe("failed");
    expect(classifyCrmResponse(201, "{}").outcome).toBe("failed");
    expect(classifyCrmResponse(204, "").outcome).toBe("failed");
  });

  it("401 / 403 → failed, nivel error, con la pista de qué revisar", () => {
    const a = classifyCrmResponse(401, "{}");
    expect(a).toMatchObject({ outcome: "failed", level: "error" });
    expect(a.error).toContain("VENDERCRM_API_KEY");
    const b = classifyCrmResponse(403, "{}");
    expect(b).toMatchObject({ outcome: "failed", level: "error" });
    expect(b.error).toContain("Sitios");
  });

  it("422 guarda el cuerpo entero (nombra el campo)", () => {
    const body = JSON.stringify({ error: "validation", field: "email", message: "email inválido" });
    const r = classifyCrmResponse(422, body);
    expect(r.outcome).toBe("failed");
    expect(r.error).toBe(`422: ${body}`);
  });

  it("429 y 5xx → failed, nivel warn (se reintenta)", () => {
    expect(classifyCrmResponse(429, "{}")).toMatchObject({ outcome: "failed", level: "warn" });
    expect(classifyCrmResponse(502, "bad gateway")).toMatchObject({ outcome: "failed", level: "warn" });
  });
});
