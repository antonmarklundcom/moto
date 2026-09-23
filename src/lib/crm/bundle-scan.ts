// Escaneo del bundle de cliente (.next/static) en busca de secretos del CRM
// (TEST_PLAN.md §9, A4). Lo corre `npm run check:bundle` después del build,
// dentro de `npm run verify`. Sin dependencias de Next ni de la base.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type BundleHit = { file: string; needle: string };

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else yield full;
  }
}

/**
 * Busca cada aguja en cada archivo de `dir`. Agujas vacías o de menos de 8
 * caracteres se ignoran (una key real nunca es tan corta y una aguja corta
 * daría falsos positivos).
 */
export function scanForSecrets(dir: string, needles: readonly (string | null | undefined)[]): BundleHit[] {
  const real = needles.filter((n): n is string => typeof n === "string" && n.length >= 8);
  const hits: BundleHit[] = [];
  for (const file of files(dir)) {
    const content = readFileSync(file, "utf8");
    for (const needle of real) if (content.includes(needle)) hits.push({ file, needle });
  }
  return hits;
}
