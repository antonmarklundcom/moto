import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LEAD_NOTICE } from "@/lib/leads/consent";
import { PUBLIC_LEAD_TYPES } from "@/lib/leads/types";
import { validateLead } from "@/lib/leads/validate";
import { FORM_FIELDS } from "./fields";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
const { LeadForm } = await import("./lead-form");

/** El texto obligatorio tal como está en PRODUCT_SPEC.md §2.3 (la cita debajo de "Texto obligatorio junto al botón"). */
function specDisclaimer(): string {
  const spec = readFileSync("PRODUCT_SPEC.md", "utf8");
  const m = /\*\*Texto obligatorio junto al botón:\*\*\s*\n> (.+)\n/.exec(spec);
  if (!m) throw new Error("No encontré el texto obligatorio en PRODUCT_SPEC.md §2.3");
  return m[1];
}

describe("descargo de financiación (PRODUCT_SPEC §2.3, LEGAL §3)", () => {
  it("el texto de A4 es el de la especificación, byte por byte", () => {
    expect(Buffer.from(LEAD_NOTICE.financing!.text, "utf8").equals(Buffer.from(specDisclaimer(), "utf8"))).toBe(true);
  });

  it("el formulario lo muestra literal, junto al botón", () => {
    const html = renderToStaticMarkup(
      createElement(LeadForm, { type: "financing", pagePath: "/financiacion", notice: LEAD_NOTICE.financing!.text, thanksPath: "/gracias?tipo=financiacion" }),
    );
    expect(html).toContain(specDisclaimer());
    // Justo antes del botón.
    expect(html.indexOf(specDisclaimer())).toBeLessThan(html.indexOf("Enviar consulta"));
    expect(html.slice(html.indexOf(specDisclaimer()), html.indexOf("Enviar consulta"))).not.toContain("<input");
  });
});

describe("formularios", () => {
  it("todo campo tiene su label; honeypot; tipo y página ocultos; sin JS postea a /api/leads", () => {
    for (const type of PUBLIC_LEAD_TYPES) {
      const html = renderToStaticMarkup(createElement(LeadForm, { type, pagePath: "/x", notice: null, thanksPath: "/gracias" }));
      expect(html).toContain('action="/api/leads"');
      expect(html).toContain(`name="tipo" value="${type}"`);
      expect(html).toContain('name="website"');
      for (const f of FORM_FIELDS[type]) {
        if (f.kind === "radio") expect(html).toContain(`<legend class="font-medium">${f.label}</legend>`);
        else expect(html).toContain(`for="lead-${type}-${f.name}"`);
      }
      // Nada de cédula ni datos bancarios (§2.3).
      expect(html.toLowerCase()).not.toMatch(/c[eé]dula|cuenta bancaria|n[uú]mero de cuenta/);
    }
  });

  it("cada campo del formulario lo acepta la validación de A4", () => {
    const sample: Record<string, string> = {
      nombre: "Ana",
      telefono: "0981 123 456",
      ciudad: "Luque",
      moto_interes: "Honda Wave",
      entrega_gs: "1.500.000",
      plazo_meses: "24",
      situacion_laboral: "independiente",
      anio: "2021",
      comercio_nombre: "Motos Ana",
      cantidad_motos: "30",
      mensaje: "Hola",
      empresa: "Taller Ana",
      email: "ana@example.com",
    };
    for (const type of PUBLIC_LEAD_TYPES) {
      const fields = Object.fromEntries(FORM_FIELDS[type].map((f) => [f.name, sample[f.name]]));
      const res = validateLead({ tipo: type, ...fields });
      expect(res.ok, `${type}: ${JSON.stringify(!res.ok && res.errors)}`).toBe(true);
    }
  });
});
