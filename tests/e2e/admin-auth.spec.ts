import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// A1: puerta del panel de punta a punta, con el build de producción contra la
// base de desarrollo. Crea (o resetea) un admin de prueba con el script real,
// pasando la contraseña por stdin como indica scripts/create-admin.ts.
const EMAIL = "e2e-admin@example.com";
const PASSWORD = "clave-e2e-bastante-larga";

test.beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/create-admin.ts", "--email", EMAIL, "--name", "[DEV] Admin E2E", "--reset"], {
    input: `${PASSWORD}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
});

test("anónimo → login; clave mala → error; clave buena → panel con navegación; salir", async ({ page, request }) => {
  const api = await request.post("/api/admin/cualquier-cosa");
  expect(api.status()).toBe(401);
  expect((await request.post("/api/cron/expire-listings")).status()).toBe(401);

  await page.goto("/admin/moderacion");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fmoderacion/);
  await expect(page.locator("h1")).toHaveText("Entrar al panel");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill("no-es-la-clave-larga");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("El email o la contraseña no coinciden.");

  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/moderacion$/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Moderación");
  const nav = page.getByRole("navigation", { name: "Secciones del panel" });
  await expect(nav.getByRole("link")).toHaveCount(12);

  const cookie = (await page.context().cookies()).find((c) => c.name === "moto_admin");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("moderador: sin Configuración en el menú y /admin/config lo devuelve con aviso", async ({ page }) => {
  const email = "e2e-moderador@example.com";
  execFileSync("npx", ["tsx", "scripts/create-admin.ts", "--email", email, "--name", "[DEV] Moderador E2E", "--role", "moderator", "--reset"], {
    input: `${PASSWORD}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const nav = page.getByRole("navigation", { name: "Secciones del panel" });
  await expect(nav.getByRole("link", { name: "Moderación" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Configuración" })).toHaveCount(0);

  await page.goto("/admin/config");
  await expect(page).toHaveURL(/\/admin\?aviso=sin-permiso$/);
  await expect(page.locator("main").getByRole("alert")).toContainText("No tenés permiso");
});
