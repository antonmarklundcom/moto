import { describe, expect, it } from "vitest";
import {
  countWords,
  isContentPageIndexable,
  isDealerPageIndexable,
  isIndexable,
  isListingIndexable,
  isMotosIndexIndexable,
  THRESHOLDS,
  type ProgrammaticPageType,
} from "./indexability";

// SEO_ARCHITECTURE.md §2.1, copiado a mano a propósito: si alguien cambia
// THRESHOLDS sin escalar, esta prueba falla.
const SPEC: Record<ProgrammaticPageType, [number, number]> = {
  brand: [5, 300],
  model: [3, 250],
  category: [8, 300],
  city: [8, 250],
  brand_city: [10, 200],
  category_city: [10, 200],
  condition: [15, 300],
  en_cuotas: [10, 400],
};

describe("isIndexable — bordes exactos de §2.1 (SITE_NOINDEX=false)", () => {
  it("THRESHOLDS coincide con la tabla del documento", () => {
    for (const [type, [live, words]] of Object.entries(SPEC)) {
      expect(THRESHOLDS[type as ProgrammaticPageType]).toEqual({ minLive: live, minWords: words });
    }
  });

  for (const [type, [live, words]] of Object.entries(SPEC) as Array<[ProgrammaticPageType, [number, number]]>) {
    describe(type, () => {
      it(`N = ${live} vivas y ${words} palabras → indexable`, () => {
        expect(isIndexable(type, live, words, "rules")).toBe(true);
      });
      it(`N - 1 = ${live - 1} vivas → noindex`, () => {
        expect(isIndexable(type, live - 1, words, "rules")).toBe(false);
      });
      it(`${words - 1} palabras → noindex aunque sobren publicaciones (ambas condiciones)`, () => {
        expect(isIndexable(type, live * 100, words - 1, "rules")).toBe(false);
      });
      it("0 y 0 → noindex", () => {
        expect(isIndexable(type, 0, 0, "rules")).toBe(false);
      });
      it("SITE_NOINDEX=true y =content fuerzan noindex aunque pase el umbral", () => {
        expect(isIndexable(type, live, words, "none")).toBe(false);
        expect(isIndexable(type, live, words, "content")).toBe(false);
      });
    });
  }

  it("sin modo explícito lee SITE_NOINDEX y falla cerrado", () => {
    const before = process.env.SITE_NOINDEX;
    try {
      delete process.env.SITE_NOINDEX;
      expect(isIndexable("brand", 1000, 1000)).toBe(false);
      process.env.SITE_NOINDEX = "tal-vez";
      expect(isIndexable("brand", 1000, 1000)).toBe(false);
      process.env.SITE_NOINDEX = "false";
      expect(isIndexable("brand", 1000, 1000)).toBe(true);
    } finally {
      if (before === undefined) delete process.env.SITE_NOINDEX;
      else process.env.SITE_NOINDEX = before;
    }
  });
});

describe("otras páginas", () => {
  it("/motos: ≥ 1 viva y modo rules", () => {
    expect(isMotosIndexIndexable(1, "rules")).toBe(true);
    expect(isMotosIndexIndexable(0, "rules")).toBe(false);
    expect(isMotosIndexIndexable(500, "content")).toBe(false);
  });

  it("comercio: active con ≥ 1 viva", () => {
    expect(isDealerPageIndexable("active", 1, "rules")).toBe(true);
    expect(isDealerPageIndexable("active", 0, "rules")).toBe(false);
    expect(isDealerPageIndexable("paused", 10, "rules")).toBe(false);
    expect(isDealerPageIndexable("active", 10, "none")).toBe(false);
  });

  it("contenido: indexable con content y false, noindex con true", () => {
    expect(isContentPageIndexable("none")).toBe(false);
    expect(isContentPageIndexable("content")).toBe(true);
    expect(isContentPageIndexable("rules")).toBe(true);
  });

  describe("ficha (§4)", () => {
    const now = new Date("2026-09-22T12:00:00Z");
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
    it("published indexable; expired/paused no", () => {
      expect(isListingIndexable({ status: "published", soldAt: null }, now, "rules")).toBe(true);
      expect(isListingIndexable({ status: "expired", soldAt: null }, now, "rules")).toBe(false);
      expect(isListingIndexable({ status: "paused", soldAt: null }, now, "rules")).toBe(false);
    });
    it("sold: < 90 días indexable, ≥ 90 días noindex", () => {
      expect(isListingIndexable({ status: "sold", soldAt: daysAgo(89) }, now, "rules")).toBe(true);
      expect(isListingIndexable({ status: "sold", soldAt: new Date(daysAgo(90).getTime() + 1) }, now, "rules")).toBe(true);
      expect(isListingIndexable({ status: "sold", soldAt: daysAgo(90) }, now, "rules")).toBe(false);
      expect(isListingIndexable({ status: "sold", soldAt: null }, now, "rules")).toBe(false);
    });
    it("borrada o modo global cerrado → noindex", () => {
      expect(isListingIndexable({ status: "published", soldAt: null, deletedAt: now }, now, "rules")).toBe(false);
      expect(isListingIndexable({ status: "published", soldAt: null }, now, "content")).toBe(false);
    });
  });
});

describe("countWords", () => {
  it("cuenta palabras visibles, no etiquetas ni scripts", () => {
    expect(countWords("<p>Motos <strong>Honda</strong> en Paraguay.</p>")).toBe(4);
    expect(countWords("<script>uno dos tres</script><style>a{}</style><p>hola</p>")).toBe(1);
    expect(countWords("año&nbsp;2020 — ¿qué tal?")).toBe(4);
    expect(countWords("uno<br>dos<br/>tres")).toBe(3);
    expect(countWords(null)).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});
