// TEST_PLAN.md §2 punto 4: el payload nunca lleva pipeline/stage/owner/tag,
// omite los opcionales vacíos y siempre tiene phone.
import { describe, expect, it } from "vitest";
import { buildCrmPayload, CRM_SOURCE } from "./payload";
import { validateLikeCrm } from "./testing/mock-vendercrm";

const base = { phoneE164: "+595981123456", idempotencyKey: "a".repeat(64) };

describe("buildCrmPayload", () => {
  it("mínimo: phone, idempotency_key y source; nada más", () => {
    expect(buildCrmPayload(base)).toEqual({ phone: "+595981123456", idempotency_key: "a".repeat(64), source: CRM_SOURCE });
  });

  it("omite opcionales vacíos, en blanco o null en vez de mandar \"\"", () => {
    const p = buildCrmPayload({
      ...base,
      name: "",
      email: "",
      message: "   ",
      utmSource: null,
      utmMedium: undefined,
      gclid: "",
      pageUrl: "",
      referrer: null,
      fields: { a: "", b: null, c: undefined },
    });
    for (const key of ["name", "email", "message", "utm_source", "utm_medium", "gclid", "page_url", "referrer", "fields"]) {
      expect(p).not.toHaveProperty(key);
    }
    expect(Object.values(p)).not.toContain("");
  });

  it("nunca pipeline/stage/owner/tag, ni en la raíz ni en fields", () => {
    const sneaky = {
      ...base,
      fields: { pipeline: "x", Stage: "y", owner: "z", tag: "t", tags: "u", tipo_lead: "financiacion" },
    } as Parameters<typeof buildCrmPayload>[0];
    Object.assign(sneaky, { pipeline: "p", stage: "s", owner: "o", tag: "t" });
    const p = buildCrmPayload(sneaky) as Record<string, unknown>;
    const json = JSON.stringify(p);
    for (const k of ["pipeline", "stage", "Stage", "owner", "tag", "tags"]) {
      expect(p).not.toHaveProperty(k);
      expect(p.fields).not.toHaveProperty(k);
      expect(json).not.toContain(`"${k}"`);
    }
    expect(p.fields).toEqual({ tipo_lead: "financiacion" });
  });

  it("phone e idempotency_key obligatorios", () => {
    expect(() => buildCrmPayload({ ...base, phoneE164: "" })).toThrow();
    expect(() => buildCrmPayload({ ...base, idempotencyKey: "corta" })).toThrow();
    expect(() => buildCrmPayload({ ...base, idempotencyKey: "x".repeat(101) })).toThrow();
  });

  it("email inválido se omite (un 422 costaría el lead entero); válido se manda", () => {
    expect(buildCrmPayload({ ...base, email: "no-es-mail" })).not.toHaveProperty("email");
    expect(buildCrmPayload({ ...base, email: " ana@example.com " }).email).toBe("ana@example.com");
  });

  it("recorta a los largos del contrato y el resultado pasa la validación del CRM falso", () => {
    const p = buildCrmPayload({
      ...base,
      name: "n".repeat(500),
      message: "m".repeat(6000),
      utmCampaign: "c".repeat(300),
      pageUrl: `https://moto.com.py/${"p".repeat(3000)}`,
      fields: { largo: "f".repeat(2000), numero: 12500000, ok: true, nan: Number.NaN },
    });
    expect(p.name).toHaveLength(200);
    expect(p.message).toHaveLength(5000);
    expect(p.utm_campaign).toHaveLength(200);
    expect(p.page_url).toHaveLength(2000);
    expect(p.fields).toEqual({ largo: "f".repeat(1000), numero: 12500000, ok: true });
    expect(validateLikeCrm(p as unknown as Record<string, unknown>)).toBeNull();
  });
});
