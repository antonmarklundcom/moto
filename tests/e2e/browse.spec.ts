import { expect, test } from "@playwright/test";

// B1: listados con el build de producción contra la base de desarrollo
// (`npm run fixtures` + stock demo). Móvil (Pixel 7). El formulario de
// filtros tiene que andar sin JavaScript.

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("filtrar por marca y ciudad lleva a la URL limpia; un filtro de monto queda en el query y es noindex", async ({ page }) => {
    await page.goto("/motos");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Motos en venta en Paraguay");
    await page.getByLabel("Marca").selectOption("honda");
    await page.getByLabel("Ciudad").selectOption("asuncion");
    await page.getByRole("button", { name: "Ver motos" }).click();
    await expect(page).toHaveURL(/\/motos\/honda\/ciudad\/asuncion$/);
    await expect(page.locator("h1")).toHaveText("Motos Honda en Asunción");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/motos\/honda\/ciudad\/asuncion$/);

    await page.getByLabel("Cuota máxima (Gs.)").fill("500.000");
    await page.getByRole("button", { name: "Ver motos" }).click();
    await expect(page).toHaveURL(/\/motos\/honda\/ciudad\/asuncion\?cuota_max=500000$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/motos\/honda\/ciudad\/asuncion$/);
    await page.getByRole("link", { name: /Cuota hasta Gs\. 500\.000/ }).click();
    await expect(page).toHaveURL(/\/motos\/honda\/ciudad\/asuncion$/);
  });
});

test("un tipo de página por ruta, con un solo h1, migas y tarjetas con WhatsApp rastreado", async ({ page }) => {
  for (const [path, h1] of [
    ["/motos/honda", "Motos Honda en Paraguay"],
    ["/motos/tipo/naked", "Motos Naked en Paraguay"],
    ["/motos/ciudad/asuncion", "Motos en Asunción"],
    ["/motos/tipo/naked/ciudad/asuncion", "Motos Naked en Asunción"],
    ["/motos/nuevas", "Motos 0 km en Paraguay"],
    ["/motos/usadas", "Motos usadas en Paraguay"],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(h1);
    await expect(page.getByRole("navigation", { name: "Migas de pan" })).toBeVisible();
    const wa = page.getByRole("link", { name: "Escribir por WhatsApp" }).first();
    await expect(wa).toHaveAttribute("href", /^\/ir\/wa\/\d+$/);
  }
});

test("combinaciones prohibidas y slugs desconocidos → 404", async ({ request }) => {
  for (const path of ["/motos/honda/wave/2019", "/motos/honda/wave/ciudad/asuncion", "/motos/tipo", "/motos/no-existe", "/motos/honda?page=99"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test("paginación real con rel=next y título de página 2", async ({ page }) => {
  await page.goto("/motos");
  await page.getByRole("link", { name: "Siguiente →" }).click();
  await expect(page).toHaveURL(/\/motos\?page=2$/);
  await expect(page).toHaveTitle(/— Página 2/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/motos\?page=2$/);
});
