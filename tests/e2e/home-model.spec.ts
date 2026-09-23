import { expect, test } from "@playwright/test";

// B2: home con la cuota primero, páginas de modelo con comparación entre
// comercios, /motos/en-cuotas. Base de desarrollo con `npm run fixtures` +
// stock demo (Wave 110S en 3 comercios, NX500 en uno).

test("home: la cuota primero lleva a /motos con cuota_max, sin contadores", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("¿Cuánto podés pagar por mes?");
  await expect(page.getByRole("heading", { name: "Recién publicadas" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/\d+ (motos|publicaciones|comercios) (publicadas|cargadas)/);
  await page.getByLabel("Cuota máxima por mes (Gs.)").fill("500.000");
  await page.getByRole("button", { name: "Ver motos en cuotas" }).click();
  await expect(page).toHaveURL(/\/motos\?cuota_max=500000$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("modelo con ≥ 2 comercios: una fila por comercio, cada una informada por el comercio", async ({ page }) => {
  await page.goto("/motos/honda/wave");
  await expect(page.locator("h1")).toHaveText("Honda Wave 110S en Paraguay");
  const table = page.getByRole("table", { name: /por comercio/ });
  const rows = table.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThanOrEqual(2);
  await expect(rows.filter({ hasText: "informado por el comercio" })).toHaveCount(await rows.count());
  await rows.first().getByRole("link", { name: "Ver" }).click();
  await expect(page).toHaveURL(/\/aviso\//);
});

test("modelo con un comercio: oferta única, sin tabla de relleno", async ({ page }) => {
  await page.goto("/motos/honda/nx500");
  await expect(page.getByRole("heading", { name: "Oferta de un comercio" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("modelo inexistente → 404; /motos/en-cuotas lista motos con cuotas y compara", async ({ page, request }) => {
  expect((await request.get("/motos/honda/no-existe")).status()).toBe(404);
  await page.goto("/motos/en-cuotas");
  await expect(page.locator("h1")).toHaveText("Motos en cuotas en Paraguay");
  await expect(page.getByRole("heading", { name: "El mismo modelo en distintos comercios" })).toBeVisible();
});
