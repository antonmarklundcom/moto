import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";

// B7: comercios, catálogo y publicaciones en el admin (escritorio), contra la
// base de desarrollo. Crea un comercio de prueba con nombre [DEV] nuevo por corrida.
const EMAIL = "e2e-admin@example.com";
const PASSWORD = "clave-e2e-bastante-larga";
const RUN = Date.now().toString(36);

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

test.beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/create-admin.ts", "--email", EMAIL, "--name", "[DEV] Admin E2E", "--reset"], {
    input: `${PASSWORD}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
});

async function login(page: Page, next: string) {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("h1")).not.toHaveText("Entrar al panel");
}

test("comercio: activar sin autorización se rechaza junto al campo; con autorización se crea", async ({ page }) => {
  await login(page, "/admin/comercios/nuevo");
  await expect(page.locator("h1")).toHaveText("Nuevo comercio");
  await page.getByLabel("Nombre *").fill(`[DEV] E2E Motos ${RUN}`);
  await page.getByLabel("Teléfono (WhatsApp si es celular) *").fill("0981 555 000");
  await page.getByLabel("Estado").selectOption("active");
  await page.getByRole("button", { name: "Crear comercio" }).click();
  await expect(page.getByText("Para activar el comercio hace falta el bloque de autorización")).toBeVisible();
  // Lo escrito sigue ahí.
  await expect(page.getByLabel("Nombre *")).toHaveValue(`[DEV] E2E Motos ${RUN}`);
  await page.getByLabel("Autorización: texto exacto aceptado").fill("[DEV] Autorizo publicar mi stock (prueba E2E).");
  await page.getByLabel("Autorización: fecha").fill("2026-09-01");
  await page.getByRole("button", { name: "Crear comercio" }).click();
  await expect(page).toHaveURL(/\/admin\/comercios\/\d+\?creado=1$/);
  await expect(page.getByText("Comercio creado.")).toBeVisible();
  await page.goto("/admin/comercios");
  await expect(page.getByRole("link", { name: `[DEV] E2E Motos ${RUN}` })).toBeVisible();
});

test("catálogo: un slug reservado se rechaza (G-15)", async ({ page }) => {
  await login(page, "/admin/catalogo?tipo=categorias");
  await page.getByLabel("Nombre *").fill("Ciudad");
  await page.getByLabel("Slug").fill("ciudad");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/«ciudad» está reservado/)).toBeVisible();
});

test("publicaciones: tabla, búsqueda, ficha con línea de tiempo y CSV", async ({ page }) => {
  await login(page, "/admin/publicaciones");
  await expect(page.locator("h1")).toHaveText("Publicaciones");
  await page.getByLabel("Estado").selectOption("published");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/estado=published/);
  await page.locator("tbody a").first().click();
  await expect(page.getByRole("heading", { name: "Línea de tiempo" })).toBeVisible();
  await page.goto("/admin/publicaciones");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exportar CSV" }).click()]);
  expect(download.suggestedFilename()).toBe("publicaciones.csv");
});
