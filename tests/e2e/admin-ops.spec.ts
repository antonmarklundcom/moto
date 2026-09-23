import "dotenv/config";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// B9: bandeja de leads, monetización, salud, configuración y actividad (escritorio).
const EMAIL = "e2e-admin@example.com";
const PASSWORD = "clave-e2e-bastante-larga";

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

test.beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/create-admin.ts", "--email", EMAIL, "--name", "[DEV] Admin E2E", "--reset"], {
    input: `${PASSWORD}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
});

test("las cinco pantallas cargan con un h1; configuración sin secretos", async ({ page }) => {
  await page.goto("/admin/login?next=/admin/leads");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("h1")).toHaveText("Leads");
  await expect(page.getByRole("heading", { name: "CRM, últimas 24 h" })).toBeVisible();
  for (const [path, h1] of [
    ["/admin/monetizacion", "Monetización"],
    ["/admin/salud", "Salud del sitio"],
    ["/admin/config", "Configuración"],
    ["/admin/actividad", "Actividad"],
  ] as const) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveText(h1);
  }
  await page.goto("/admin/config");
  const html = await page.content();
  for (const name of ["SESSION_SECRET", "IP_HASH_SALT", "CRON_SECRET", "VENDERCRM_API_KEY"]) {
    const value = process.env[name];
    if (value && value.length >= 8) expect(html).not.toContain(value);
  }
});
