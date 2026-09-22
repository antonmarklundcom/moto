/* eslint-disable @typescript-eslint/no-explicit-any -- inspección de JSON-LD sin tipos en pruebas */
import { describe, expect, it } from "vitest";
import {
  articleJsonLd,
  autoDealerJsonLd,
  breadcrumbJsonLd,
  collectionPageJsonLd,
  faqPageJsonLd,
  findForbiddenJsonLd,
  listingJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  webSiteJsonLd,
  type JsonLdDocument,
  type ListingJsonLdInput,
} from "./jsonld";

const site = "https://moto.com.py";
const listing: ListingJsonLdInput = {
  url: `${site}/aviso/honda-cg-150-2022-asuncion-a3f9k2p7`,
  title: "Honda CG 150 Titan 2022",
  description: "Única dueña.",
  images: [`${site}/media/a.webp`],
  brandName: "Honda",
  modelName: "CG 150 Titan",
  year: 2022,
  mileageKm: 12_300,
  engineCc: 150,
  condition: "used",
  status: "published",
  priceGs: 12_500_000,
  hasFinancingOnly: false,
  cityName: "Asunción",
  sellerName: "Comercio de prueba",
};

/** Todos los constructores con todos sus campos: ninguno puede emitir Review/AggregateRating. */
function everyBuilder(): JsonLdDocument[] {
  return [
    organizationJsonLd(site),
    webSiteJsonLd(site),
    breadcrumbJsonLd([{ name: "Inicio", url: site }, { name: "Motos", url: `${site}/motos` }]),
    collectionPageJsonLd({ url: `${site}/motos`, name: "Motos", description: "d", itemUrls: [listing.url], firstPosition: 25 }),
    listingJsonLd(listing),
    listingJsonLd({ ...listing, status: "sold", hasFinancingOnly: true, priceGs: null }),
    autoDealerJsonLd({ url: `${site}/comercios/x`, name: "X", telephone: "+595981123456", cityName: "Luque", streetAddress: "Ruta 2", department: "Central" }),
    articleJsonLd({ url: `${site}/guias/x`, headline: "Guía", datePublished: new Date(), dateModified: new Date(), siteUrl: site }),
    faqPageJsonLd([{ question: "¿?", answer: "Sí." }])!,
  ];
}

describe("JSON-LD — nunca Review ni AggregateRating (ADR-10)", () => {
  it("ningún constructor los emite", () => {
    for (const doc of everyBuilder()) {
      const text = JSON.stringify(doc);
      expect(text).not.toMatch(/"review"|"reviews"|"aggregateRating"|"Review"|"AggregateRating"/i);
      expect(findForbiddenJsonLd(doc)).toBeNull();
      expect(() => serializeJsonLd(doc)).not.toThrow();
    }
  });

  it("serializeJsonLd lanza si alguien los agrega, en cualquier nivel", () => {
    const withRating = { ...listingJsonLd(listing), aggregateRating: { "@type": "AggregateRating", ratingValue: 5 } };
    expect(() => serializeJsonLd(withRating)).toThrow(/ADR-10/);
    const nested = listingJsonLd(listing) as JsonLdDocument & { offers: Record<string, unknown> };
    nested.offers.review = [{ "@type": "Review" }];
    expect(() => serializeJsonLd(nested)).toThrow(/ADR-10/);
    expect(() => serializeJsonLd([organizationJsonLd(site), { "@context": "https://schema.org", "@type": "https://schema.org/Review" }])).toThrow();
    expect(() => serializeJsonLd({ "@context": "https://schema.org", "@type": ["Thing", "UserReview"] })).toThrow();
  });

  it("escapa HTML: un título con </script> no rompe la página", () => {
    const text = serializeJsonLd(listingJsonLd({ ...listing, title: "</script><script>alert(1)</script> & co" }));
    expect(text).not.toContain("</script>");
    expect(text).not.toContain("<");
    expect(JSON.parse(text).name).toBe("</script><script>alert(1)</script> & co");
  });
});

describe("ficha (§6)", () => {
  it("Product + Offer PYG + Vehicle, availability real", () => {
    const doc = listingJsonLd(listing) as Record<string, any>;
    expect(doc["@type"]).toBe("Product");
    expect(doc.offers).toMatchObject({ "@type": "Offer", priceCurrency: "PYG", price: 12_500_000, availability: "https://schema.org/InStock" });
    expect(doc.offers.itemOffered).toMatchObject({ "@type": "Vehicle", vehicleModelDate: "2022", mileageFromOdometer: { value: 12_300, unitCode: "KMT" } });
    expect(doc.offers).not.toHaveProperty("priceValidUntil");
    const sold = listingJsonLd({ ...listing, status: "sold" }) as Record<string, any>;
    expect(sold.offers.availability).toBe("https://schema.org/SoldOut");
  });

  it("financiación sola: sin price", () => {
    const doc = listingJsonLd({ ...listing, hasFinancingOnly: true, priceGs: 15_000_000 }) as Record<string, any>;
    expect(doc.offers).not.toHaveProperty("price");
  });

  it("datos ausentes se omiten, no se rellenan", () => {
    const doc = listingJsonLd({ ...listing, modelName: null, year: null, mileageKm: null, engineCc: null, description: null, images: [], sellerName: null }) as Record<string, any>;
    expect(doc).not.toHaveProperty("model");
    expect(doc).not.toHaveProperty("image");
    expect(doc).not.toHaveProperty("description");
    expect(doc.offers.itemOffered).not.toHaveProperty("vehicleModelDate");
    expect(doc.offers.itemOffered).not.toHaveProperty("mileageFromOdometer");
    expect(doc.offers).not.toHaveProperty("seller");
  });
});

describe("otros", () => {
  it("BreadcrumbList con posiciones desde 1", () => {
    const doc = breadcrumbJsonLd([{ name: "Inicio", url: site }, { name: "Motos", url: `${site}/motos` }]) as Record<string, any>;
    expect(doc.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
  });
  it("FAQPage sólo con preguntas reales", () => {
    expect(faqPageJsonLd([])).toBeNull();
  });
  it("CollectionPage numera desde firstPosition", () => {
    const doc = collectionPageJsonLd({ url: site, name: "x", itemUrls: ["a", "b"], firstPosition: 25 }) as Record<string, any>;
    expect(doc.mainEntity.itemListElement.map((i: any) => i.position)).toEqual([25, 26]);
  });
});
