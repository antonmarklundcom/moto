import path from "node:path";
import { expect, test } from "@playwright/test";

// C2, TEST_PLAN.md §8: axe sin violaciones críticas ni serias en las páginas
// clave (móvil). Se inyecta axe-core (devDependency) sin plugins extra.
const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

type AxeViolation = { id: string; impact: string | null; help: string; nodes: Array<{ target: string[] }> };

async function violations(page: import("@playwright/test").Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    // @ts-expect-error axe se inyecta arriba
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations as AxeViolation[];
  });
  return result.filter((v) => v.impact === "critical" || v.impact === "serious");
}

const PAGES = ["/", "/motos", "/motos/honda", "/motos/honda/wave", "/motos/en-cuotas", "/financiacion", "/publicar", "/comercios", "/admin/login"];

for (const path of PAGES) {
  test(`axe ${path}: sin violaciones críticas ni serias`, async ({ page }) => {
    await page.goto(path);
    const found = await violations(page);
    expect(found.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
  });
}

test("axe ficha de publicación: sin violaciones críticas ni serias", async ({ page }) => {
  await page.goto("/motos/honda/wave");
  await page.locator('a[href^="/aviso/"]').first().click();
  await expect(page).toHaveURL(/\/aviso\//);
  const found = await violations(page);
  expect(found.map((v) => `${v.id} (${v.impact}): ${v.help}`)).toEqual([]);
});
