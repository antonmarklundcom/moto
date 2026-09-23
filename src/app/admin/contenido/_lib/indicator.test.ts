import { describe, expect, it } from "vitest";
import { isIndexable, THRESHOLDS } from "@/lib/seo/indexability";
import { introIndicator } from "./indicator";

describe("introIndicator coincide con isIndexable() en el borde del umbral", () => {
  it.each(Object.keys(THRESHOLDS) as Array<keyof typeof THRESHOLDS>)("%s", (type) => {
    const { minLive, minWords } = THRESHOLDS[type];
    for (const [live, words] of [
      [minLive, minWords],
      [minLive - 1, minWords],
      [minLive, minWords - 1],
      [minLive + 5, minWords + 5],
    ]) {
      for (const mode of ["none", "content", "rules"] as const) {
        const i = introIndicator(type, live, words, mode);
        expect(i.meetsThreshold).toBe(isIndexable(type, live, words, "rules"));
        expect(i.indexableNow).toBe(isIndexable(type, live, words, mode));
      }
    }
  });

  it("marca en 5/300 y no en 5/299 (marca)", () => {
    expect(introIndicator("brand", 5, 300, "rules")).toMatchObject({ meetsThreshold: true, indexableNow: true, missingLive: 0, missingWords: 0 });
    expect(introIndicator("brand", 5, 299, "rules")).toMatchObject({ meetsThreshold: false, missingWords: 1 });
    expect(introIndicator("brand", 4, 300, "rules")).toMatchObject({ meetsThreshold: false, missingLive: 1 });
    // Con SITE_NOINDEX=true o content, cumplir el umbral no alcanza para indexar hoy.
    expect(introIndicator("brand", 5, 300, "content")).toMatchObject({ meetsThreshold: true, indexableNow: false });
  });
});
