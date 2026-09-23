import "dotenv/config";
import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";

// B5: lead de financiación de punta a punta (móvil). Con el servidor
// levantado con VENDERCRM_URL apuntando al VenderCRM falso
// (tests/e2e/support/mock-crm.ts) el lead termina `sent`; sin CRM
// configurado queda `pending` (A4) y la página de gracias es la misma.

// /api/leads (A4) compara Origin con SITE_URL y redirige (sin JS) a una URL
// absoluta con SITE_URL; el servidor E2E puede correr en otro puerto. Acá se
// manda el Origin configurado y se vuelve relativa la redirección. El chequeo
// de origen en sí lo prueban las pruebas de A4 (link-pass: redirección relativa).
async function sameOriginAsSiteUrl(page: Page) {
  const siteUrl = new URL(process.env.SITE_URL ?? "http://localhost:3000").origin;
  await page.route("**/api/leads", async (route) => {
    const response = await route.fetch({ headers: { ...route.request().headers(), origin: siteUrl }, maxRedirects: 0 });
    const location = response.headers().location;
    await route.fulfill({
      response,
      headers: location ? { ...response.headers(), location: location.replace(siteUrl, "") } : response.headers(),
    });
  });
}

function leadStatus(phoneE164: string): { type: string; listingId: number | null; crmStatus: string; payload: { consent_text_version?: string } } | null {
  const out = execFileSync("npx", ["tsx", "tests/e2e/support/lead-status.ts", phoneE164], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop()!);
}

const randomPhone = () => {
  const n = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  return { display: `0985 ${n.slice(0, 3)} ${n.slice(3)}`, e164: `+595985${n}` };
};

test("desde una ficha: formulario precargado, descargo literal, lead guardado y /gracias", async ({ page }) => {
  await sameOriginAsSiteUrl(page);
  await page.goto("/motos/en-cuotas");
  await page.locator('a[href^="/aviso/"]').first().click();
  await page.getByRole("link", { name: "Quiero financiarla" }).click();
  await expect(page).toHaveURL(/\/financiacion\?aviso=[a-z0-9]{8}$/);
  await expect(page.locator("h1")).toHaveText("Comprá tu moto en cuotas");
  await expect(page.getByText("moto.com.py no otorga créditos ni garantiza aprobación.")).toBeVisible();
  await expect(page.getByLabel("Moto que te interesa")).not.toHaveValue("");

  const phone = randomPhone();
  await page.getByLabel("Tu nombre").fill("[DEV] E2E");
  await page.getByLabel(/Tu teléfono/).fill(phone.display);
  await page.getByLabel("Entrega que tenés disponible (Gs.)").fill("1.500.000");
  await page.getByLabel("Plazo que te gustaría").selectOption("24");
  await page.getByLabel("Soy independiente").check();
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(page).toHaveURL(/\/gracias\?tipo=financiacion$/);
  await expect(page.locator("h1")).toHaveText("Recibimos tu consulta de financiación");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const lead = leadStatus(phone.e164);
  expect(lead).toMatchObject({ type: "financing", payload: { consent_text_version: "financiacion-2026-09-22" } });
  expect(lead!.listingId).not.toBeNull();
  if (process.env.VENDERCRM_URL) {
    await expect.poll(() => leadStatus(phone.e164)?.crmStatus, { timeout: 15_000 }).toBe("sent");
  } else {
    expect(["pending", "sent"]).toContain(lead!.crmStatus);
  }
});

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("teléfono inválido vuelve con el error junto al campo y lo escrito; válido llega a /gracias", async ({ page }) => {
    await sameOriginAsSiteUrl(page);
    await page.goto("/seguros");
    await page.getByLabel("Tu nombre").fill("[DEV] Nombre sin JS");
    await page.getByLabel(/Tu teléfono/).fill("123");
    await page.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(page).toHaveURL(/\/seguros\?error=telefono$/);
    await expect(page.getByText("Revisá el número: por ejemplo 0981 123 456.")).toBeVisible();
    // Lo escrito vuelve (cookie cifrada de 5 min, nunca en la URL).
    await expect(page.getByLabel("Tu nombre")).toHaveValue("[DEV] Nombre sin JS");
    await expect(page.getByLabel(/Tu teléfono/)).toHaveValue("123");
    expect(page.url()).not.toContain("Nombre");
    const phone = randomPhone();
    await page.getByLabel(/Tu teléfono/).fill(phone.display);
    await page.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(page).toHaveURL(/\/gracias\?tipo=seguro$/);
  });
});

test("comercios: índice real y página con AutoDealer, sin Review/AggregateRating, WhatsApp por /ir/wa", async ({ page }) => {
  await page.goto("/comercios");
  await expect(page.locator("h1")).toHaveText("Comercios de motos");
  await page.locator('main a[href^="/comercios/"]').first().click();
  await expect(page).toHaveURL(/\/comercios\/[a-z0-9-]+$/);
  await expect(page.locator("h1")).toHaveCount(1);
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"@type":"AutoDealer"');
  expect(ld).not.toMatch(/AggregateRating|"Review"/);
  await expect(page.getByRole("link", { name: "Escribir por WhatsApp" }).first()).toHaveAttribute("href", /^\/ir\/wa\/comercio\/\d+$/);
});
