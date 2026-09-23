import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scanForSecrets } from "./bundle-scan";

const dir = mkdtempSync(join(tmpdir(), "bundle-scan-"));
mkdirSync(join(dir, "chunks", "app"), { recursive: true });
writeFileSync(join(dir, "chunks", "app", "page.js"), 'console.log("hola")');
writeFileSync(join(dir, "chunks", "leak.js"), 'const k="vc_live_ABCDEF123456";const n="VENDERCRM_API_KEY"');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("scanForSecrets", () => {
  it("encuentra el nombre de la variable y el valor de la key en subcarpetas", () => {
    const hits = scanForSecrets(dir, ["VENDERCRM_API_KEY", "vc_live_ABCDEF123456"]);
    expect(hits.map((h) => h.needle).sort()).toEqual(["VENDERCRM_API_KEY", "vc_live_ABCDEF123456"]);
    expect(hits.every((h) => h.file.endsWith("leak.js"))).toBe(true);
  });

  it("agujas vacías o cortas se ignoran; bundle limpio → sin hallazgos", () => {
    expect(scanForSecrets(join(dir, "chunks", "app"), ["VENDERCRM_API_KEY", "", null, "hola"])).toEqual([]);
  });
});
