import { execFileSync } from "node:child_process";
import "dotenv/config";
import { expect, test } from "@playwright/test";

// B3: ficha en móvil contra el build de producción y la base de desarrollo.
type Targets = Record<"published" | "publishedRef" | "publishedPhone" | "callsOnly" | "sold" | "expired" | "oldSold" | "deleted", string>;
let t: Targets;

test.beforeAll(() => {
  const out = execFileSync("npx", ["tsx", "tests/e2e/support/detail-targets.ts"], { encoding: "utf8" });
  t = JSON.parse(out.trim().split("\n").pop()!) as Targets;
});

test("publicada: un h1, CTA de WhatsApp por /ir/wa visible sin scroll, sin teléfono en el HTML", async ({ page, request }) => {
  const res = await page.goto(t.published);
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  const cta = page.getByRole("link", { name: "Escribir por WhatsApp" }).first();
  await expect(cta).toHaveAttribute("href", /^\/ir\/wa\/\d+$/);
  await expect(cta).toBeInViewport();
  const html = await (await request.get(t.published)).text();
  // Ni en E.164 ni en formato visible (0981 123 456).
  const national = t.publishedPhone.slice(4);
  expect(html).not.toContain(t.publishedPhone);
  expect(html).not.toContain(`0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`);
  await expect(page.getByText("Antes de pagar:")).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.filter((x) => x.includes('"@type":"Product"'))).toHaveLength(1);
  expect(ld.join(" ")).not.toMatch(/AggregateRating|"Review"/);

  // El CTA pasa por /ir/wa y termina en wa.me (302).
  const wa = await request.get((await cta.getAttribute("href"))!, { maxRedirects: 0 });
  expect(wa.status()).toBe(302);
  expect(wa.headers().location).toMatch(/^https:\/\/wa\.me\/595\d+\?text=/);

  // Compartir: 302 a WhatsApp con el enlace de la ficha.
  const share = await request.get(`${t.published}/compartir`, { maxRedirects: 0 });
  expect(share.status()).toBe(302);
  expect(decodeURIComponent(share.headers().location)).toContain(t.published);

  // /api/telefono (A4) compara Origin con SITE_URL; el servidor E2E corre en
  // otro puerto que el SITE_URL local, así que ese pedido sale con el origen
  // configurado. El chequeo de origen en sí lo prueban las pruebas de A4.
  const siteUrl = new URL(process.env.SITE_URL ?? "http://localhost:3000").origin;
  await page.route("**/api/telefono/**", (route) => route.continue({ headers: { ...route.request().headers(), origin: siteUrl } }));
  await page.getByRole("button", { name: "Ver teléfono" }).click();
  await expect(page.getByRole("link", { name: /^Llamar al 09\d{2} \d{3} \d{3}$/ })).toBeVisible();
});

test("sólo llamadas: botón Llamar, sin WhatsApp", async ({ page }) => {
  await page.goto(t.callsOnly);
  const contact = page.getByRole("group", { name: "Contacto con el vendedor" });
  await expect(contact.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveCount(0);
  await expect(contact.getByRole("button", { name: "Llamar" })).toBeVisible();
});

test("vendida: banner, precio visible, sin CTA de contacto", async ({ page }) => {
  expect((await page.goto(t.sold))?.status()).toBe(200);
  await expect(page.getByText(/Esta moto ya se vendió/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Escribir por WhatsApp" }).first()).not.toBeInViewport();
});

test("vencida: 200, noindex y banner", async ({ page }) => {
  expect((await page.goto(t.expired))?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Esta publicación venció")).toBeVisible();
});

test("slug viejo con el ref correcto → redirección permanente a la canónica; > 12 meses → página del modelo; borrada → 404", async ({ request }) => {
  const wrong = await request.get(`/aviso/un-slug-viejo-${t.publishedRef}`, { maxRedirects: 0 });
  expect([301, 308]).toContain(wrong.status());
  expect(wrong.headers().location).toMatch(new RegExp(`${t.published}$`));
  const old = await request.get(t.oldSold, { maxRedirects: 0 });
  expect([301, 308]).toContain(old.status());
  expect(old.headers().location).toMatch(/\/motos\/[a-z0-9-]+\/[a-z0-9-]+$/);
  // 410 pedido por SEO §4; Next no permite 410 desde una página (docs/log/B3.md).
  expect((await request.get(t.deleted)).status()).toBe(404);
});

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("denuncia: formulario común con respuesta honesta", async ({ page }) => {
    await page.goto(t.published);
    await page.getByText("Denunciar esta publicación").click();
    await page.getByLabel("El vendedor no responde").check();
    await page.getByRole("button", { name: "Enviar denuncia" }).click();
    await expect(page.getByText("Recibimos tu denuncia y la vamos a revisar.")).toBeVisible();
  });
});
