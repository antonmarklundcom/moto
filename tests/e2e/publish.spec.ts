import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

// B4: /publicar de punta a punta (móvil) con el build de producción contra la
// base de desarrollo, y el enlace privado /mi-aviso. El enlace lo emite la
// aprobación de moderación; acá lo emite el script de apoyo para no depender
// del panel. Límite de 3 por IP: `reset` saca de la cuenta las corridas previas.
const DESCRIPTION = (marker: string) =>
  `Honda en muy buen estado, service al día, cubiertas nuevas y papeles en regla. La vendo porque me compré un auto. ${marker} Prueba E2E.`;

function support(...args: string[]): string {
  return execFileSync("npx", ["tsx", "tests/e2e/support/publish-e2e.ts", ...args], { encoding: "utf8" }).trim();
}

test.beforeAll(() => {
  support("reset");
});

test("con JS: de a un paso, foto subida, borrador guardado y /mi-aviso", async ({ page }) => {
  const marker = `E2E-PUB-${Date.now().toString(36).toUpperCase()}`;
  await page.goto("/publicar");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByText("Paso 1 de 5: Fotos")).toBeVisible();

  const photo = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 160, g: 40, b: 30 } } }).jpeg().toBuffer();
  await page.getByLabel(/Elegí fotos de tu moto/).setInputFiles({ name: "moto.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(page.getByAltText("Foto 1")).toBeVisible();
  await page.getByRole("button", { name: "Siguiente →" }).click();

  await expect(page.getByText("Paso 2 de 5: La moto")).toBeVisible();
  await page.locator('select[name="marca"]').selectOption({ label: "Honda" });
  const firstModel = await page.locator('select[name="modelo"]').locator("option").nth(1).getAttribute("value");
  await page.locator('select[name="modelo"]').selectOption(firstModel!);
  await page.locator('select[name="categoria"]').selectOption({ index: 1 });
  await page.getByRole("radio", { name: "Usada" }).check();
  await page.getByLabel("Año").fill("2021");
  await page.getByLabel("Kilómetros").fill("15.000");
  await page.locator('select[name="documentacion"]').selectOption("al_dia");

  // Autoguardado: recargar no pierde lo cargado.
  await page.reload();
  await expect(page.getByText("Paso 2 de 5: La moto")).toBeVisible();
  await expect(page.getByLabel("Año")).toHaveValue("2021");
  await expect(page.getByAltText("Foto 1")).toBeAttached(); // paso 1, oculto pero guardado
  await page.getByRole("button", { name: "Siguiente →" }).click();

  await page.getByLabel("Precio de contado (Gs.)").fill("12.500.000");
  await page.getByRole("button", { name: "Siguiente →" }).click();
  await page.locator('select[name="ciudad"]').selectOption({ index: 1 });
  await page.getByLabel("Teléfono").fill("0981 555 123");
  await page.getByRole("button", { name: "Siguiente →" }).click();
  await page.getByLabel("Contá cómo está la moto").fill(DESCRIPTION(marker));
  await page.getByRole("button", { name: "Publicá tu moto gratis" }).click();

  await expect(page).toHaveURL(/\/publicar\/listo$/);
  await expect(page.locator("h1")).toHaveText("Recibimos tu publicación");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.screenshot({ path: "test-results/b4-listo.png" });

  // Enlace privado: estado en revisión, cambio de precio y token malo = 404.
  const [, token] = support("token", marker).split(" ");
  await page.goto(`/mi-aviso/${token}`);
  await expect(page.getByText("En revisión (menos de 24 h)")).toBeVisible();
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  await page.getByLabel("Precio de contado (Gs.)").fill("11.900.000");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toHaveText("Guardado.");
  await expect(page.getByLabel("Precio de contado (Gs.)")).toHaveValue(/11\.?900\.?000/);
  await page.screenshot({ path: "test-results/b4-mi-aviso.png", fullPage: true });

  const bad = await page.goto(`/mi-aviso/${token.slice(0, -2)}xx`);
  expect(bad?.status()).toBe(404);
});

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("todo el formulario a la vista, errores por campo y envío sin fotos", async ({ page }) => {
    const marker = `E2E-PUB-${Date.now().toString(36).toUpperCase()}N`;
    await page.goto("/publicar");
    await expect(page.getByText("Para subir fotos hace falta JavaScript.")).toBeVisible();
    await page.getByRole("button", { name: "Publicá tu moto gratis" }).click();
    await expect(page.getByRole("alert")).toHaveText("Revisá los campos marcados.");
    await expect(page.getByLabel("Precio de contado (Gs.)")).toHaveAttribute("aria-invalid", "true");

    await page.locator('select[name="marca"]').selectOption({ label: "Honda" });
    await page.locator('select[name="modelo"]').selectOption("otro");
    await page.getByLabel("Si no está en la lista: escribí el modelo").fill("CG 150 Titan edición E2E");
    await page.locator('select[name="categoria"]').selectOption({ index: 1 });
    await page.getByRole("radio", { name: "Usada" }).check();
    await page.getByLabel("Año").fill("2019");
    await page.getByLabel("Kilómetros").fill("30000");
    await page.locator('select[name="documentacion"]').selectOption("al_dia");
    await page.getByLabel("Precio de contado (Gs.)").fill("9.000.000");
    await page.locator('select[name="ciudad"]').selectOption({ index: 1 });
    await page.getByLabel("Teléfono").fill("0981 555 124");
    await page.getByLabel("Contá cómo está la moto").fill(DESCRIPTION(marker));
    await page.getByRole("button", { name: "Publicá tu moto gratis" }).click();

    await expect(page).toHaveURL(/\/publicar\/listo\?fotos=0$/);
    await expect(page.getByText("Llegó sin fotos")).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /^\/ir\/wa\/general\?/);
  });
});
