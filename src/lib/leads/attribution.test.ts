import { describe, expect, it } from "vitest";
import { EMPTY_ATTRIBUTION, readAttribution } from "./attribution";

const attr = {
  utm_source: "facebook",
  utm_medium: "cpc",
  utm_campaign: "cuotas-septiembre",
  gclid: "g-1",
  fbclid: "f-1",
  landing_page: "https://moto.com.py/motos/en-cuotas?utm_source=facebook",
  referrer: "https://l.facebook.com/",
};

describe("readAttribution (cookie vc_attr)", () => {
  it("codificada (como la escribe vc-attribution.js) y ya decodificada", () => {
    const expected = {
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "cuotas-septiembre",
      utmTerm: null,
      utmContent: null,
      gclid: "g-1",
      fbclid: "f-1",
      landingPage: "https://moto.com.py/motos/en-cuotas?utm_source=facebook",
      referrer: "https://l.facebook.com/",
    };
    expect(readAttribution(encodeURIComponent(JSON.stringify(attr)))).toEqual(expected);
    expect(readAttribution(JSON.stringify(attr))).toEqual(expected);
  });

  it("basura, vacío, tipos raros o URLs no http → vacío/null, nunca lanza", () => {
    expect(readAttribution(undefined)).toEqual(EMPTY_ATTRIBUTION);
    expect(readAttribution("%E0%A4%A")).toEqual(EMPTY_ATTRIBUTION);
    expect(readAttribution("[1,2]")).toEqual(EMPTY_ATTRIBUTION);
    const r = readAttribution(JSON.stringify({ utm_source: 5, referrer: "javascript:alert(1)", utm_term: "x".repeat(500) }));
    expect(r.utmSource).toBeNull();
    expect(r.referrer).toBeNull();
    expect(r.utmTerm).toHaveLength(200);
  });
});
