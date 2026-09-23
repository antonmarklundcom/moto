import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// B10: contenido con el build de producción contra la base de desarrollo.
const EMAIL = "e2e-admin@example.com";
const PASSWORD = "clave-e2e-bastante-larga";
const SLUG = `dev-guia-e2e-${Date.now().toString(36)}`;
const BODY = `<p>${"Texto de prueba revisado para la guía de punta a punta en moto.com.py. ".repeat(20)}</p><h2>Seguí</h2><p><a href="/motos/usadas">motos usadas</a></p>`;

test.beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/create-admin.ts", "--email", EMAIL, "--name", "[DEV] Admin E2E", "--reset"], {
    input: `${PASSWORD}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
});

test("borradores, revisor obligatorio (400 por POST directo), guía publicada y textos de páginas", async ({ page }) => {
  await page.goto("/admin/login?next=/admin/contenido");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/contenido$/);

  await page.getByRole("button", { name: "Cargar borradores de content/guias" }).click();
  await expect(page.getByText(/Borradores cargados: \d+\. Ya existían: \d+\./)).toBeVisible();
  await expect(page.getByRole("link", { name: "Cómo transferir una moto en Paraguay: pasos y papeles" })).toBeVisible();

  // POST directo desde la sesión del admin, sin revisor: 400.
  const direct = await page.evaluate(async (slug) => {
    const body = new URLSearchParams({ title: "[DEV] Guía E2E", slug, bodyHtml: "<p>x</p>", status: "published" });
    const res = await fetch("/admin/contenido/guardar", { method: "POST", body });
    return { status: res.status, json: await res.json() };
  }, SLUG);
  expect(direct.status).toBe(400);
  expect(direct.json.code).toBe("reviewer_required");

  // Por la pantalla: con revisor se publica.
  await page.getByRole("link", { name: "Nueva guía" }).click();
  await page.getByLabel("Título (es el h1 de la guía)").fill("[DEV] Guía E2E");
  await page.getByLabel("Slug").fill(SLUG);
  await page.getByLabel(/^Texto \(HTML/).fill(BODY);
  await page.getByLabel("Estado").selectOption("published");
  await page.getByLabel(/Revisada por/).selectOption({ label: "[DEV] Admin E2E" });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/editar=\d+&ok=1/);
  const editUrl = page.url();
  await page.screenshot({ path: "test-results/b10-admin-guias.png", fullPage: true });

  await page.goto(`/guias/${SLUG}`);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("[DEV] Guía E2E");
  await expect(page.getByText(/Publicada el \d+ de \w+ de \d{4}/)).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join("\n")).toContain('"@type":"Article"');
  expect(ld.join("\n")).not.toMatch(/AggregateRating|Review/);
  await page.screenshot({ path: "test-results/b10-guia.png", fullPage: true });
  await page.goto("/guias");
  await expect(page.getByRole("link", { name: "[DEV] Guía E2E" })).toBeVisible();

  // Volver a borrador: deja de verse.
  await page.goto(editUrl);
  await page.getByLabel("Estado").selectOption("draft");
  // La URL de edición ya trae ok=1: se espera la respuesta del guardado, no la URL.
  const [saved] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/admin/contenido/guardar")), page.getByRole("button", { name: "Guardar" }).click()]);
  expect(saved.status()).toBe(200);
  expect((await page.request.get(`/guias/${SLUG}`)).status()).toBe(404);

  await page.goto("/admin/contenido?tab=textos&tipo=brand");
  await expect(page.getByRole("table")).toContainText(/Cumple el umbral|No cumple: noindex/);
  await page.getByRole("link", { name: "Editar texto" }).first().click();
  await expect(page.getByText("Indicador (guardado):")).toBeVisible();
  await page.screenshot({ path: "test-results/b10-admin-textos.png", fullPage: true });
});

test("estáticas: cómo funciona, términos y privacidad (noindex, sin texto legal)", async ({ page }) => {
  await page.goto("/como-funciona");
  await expect(page.locator("h1")).toHaveText("Cómo funciona");
  await expect(page.getByText("moto.com.py no otorga créditos ni garantiza aprobación")).toBeVisible();
  for (const [path, h1] of [
    ["/terminos", "Términos y condiciones"],
    ["/privacidad", "Política de privacidad"],
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveText(h1);
    await expect(page.getByText("Texto en revisión legal.")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  expect((await page.request.get("/guias/no-existe")).status()).toBe(404);
});
