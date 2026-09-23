import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// B6: cola de moderación con el teclado, contra la base de desarrollo
// (`npm run fixtures` deja publicaciones en moderación). Aprueba una de verdad.
const EMAIL = "e2e-admin@example.com";
const PASSWORD = "clave-e2e-bastante-larga";

test.beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/create-admin.ts", "--email", EMAIL, "--name", "[DEV] Admin E2E", "--reset"], {
    input: `${PASSWORD}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
});

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

test("cola: una publicación a la vez, señales, rechazo con motivo por número y aprobación con A", async ({ page }) => {
  await page.goto("/admin/login?next=/admin/moderacion");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/moderacion$/);
  await expect(page.locator("h1")).toHaveText("Moderación");
  await expect(page.getByText(/\d+ en cola · 1 de \d+/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Señales/ })).toBeVisible();

  // Tecla 1 = primer motivo: precarga el aviso editable.
  await page.locator("body").press("1");
  await expect(page.getByLabel("Aviso para el vendedor (editable)")).toHaveValue(/No pudimos publicar tu moto porque las fotos/);

  const title = await page.locator("main h2").filter({ hasNotText: /Señales|Fotos/ }).first().textContent();
  await page.locator("body").press("a");
  const ok = page.getByRole("heading", { name: "Publicada" });
  const needsModel = page.getByRole("alert").filter({ hasText: "Para publicar falta" });
  await expect(ok.or(needsModel)).toBeVisible();
  if (await ok.isVisible()) {
    await expect(page.getByLabel("Mensaje para el vendedor (WhatsApp)")).toHaveValue(/moto\.com\.py/);
    expect(title).toBeTruthy();
  }
});

test("denuncias: la cola se muestra por estado", async ({ page }) => {
  await page.goto("/admin/login?next=/admin/denuncias");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/denuncias$/);
  await expect(page.getByRole("link", { name: "Pendientes" })).toHaveAttribute("aria-current", "page");
});
