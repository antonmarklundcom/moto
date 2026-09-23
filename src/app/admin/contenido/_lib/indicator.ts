// Indicador de indexabilidad del editor de `intro_html` (ADMIN_SPEC §9).
// No decide nada propio: repite `isIndexable()` de A2 con el modo "rules"
// (¿cumple el umbral §2.1?) y con el modo global actual (¿se indexa hoy?).
import { isIndexable, THRESHOLDS, type ProgrammaticPageType } from "@/lib/seo/indexability";
import type { SiteIndexingMode } from "@/lib/env";

export type IntroIndicator = {
  minLive: number;
  minWords: number;
  meetsThreshold: boolean;
  indexableNow: boolean;
  missingLive: number;
  missingWords: number;
};

export function introIndicator(type: ProgrammaticPageType, live: number, words: number, mode: SiteIndexingMode): IntroIndicator {
  const { minLive, minWords } = THRESHOLDS[type];
  return {
    minLive,
    minWords,
    meetsThreshold: isIndexable(type, live, words, "rules"),
    indexableNow: isIndexable(type, live, words, mode),
    missingLive: Math.max(0, minLive - live),
    missingWords: Math.max(0, minWords - words),
  };
}
