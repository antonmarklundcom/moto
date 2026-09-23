import "dotenv/config";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// C2: los casos de TEST_PLAN.md §4 que ninguna fase cubría de punta a punta
// (el resto: publish, moderation, detail, financing, admin-auth). Build de
// producción + `npm run fixtures` + stock demo, como el resto del E2E.

const siteOrigin = new URL(process.env.SITE_URL ?? "http://localhost:3000").origin;

function lastLead(phoneE164: string): unknown {
  const out = execFileSync("npx", ["tsx", "tests/e2e/support/lead-status.ts", phoneE164], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop()!);
}

// Local no hay proxy: cada pedido con su propia IP para no chocar con el tope de leads por IP de corridas anteriores.
const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

const randomPhone = () => {
  const n = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  return { display: `0986 ${n.slice(0, 3)} ${n.slice(3)}`, e164: `+595986${n}` };
};

test("§4.5 WhatsApp: el CTA pasa por /ir/wa y responde 302 a wa.me con el mensaje armado", async ({ page, request }) => {
  await page.goto("/motos");
  const href = await page.locator('a[href^="/ir/wa/"]').first().getAttribute("href");
  expect(href).toMatch(/^\/ir\/wa\/\d+$/);
  expect(await page.locator('a[href*="wa.me"]').count()).toBe(0); // nunca directo (ADR-07)
  const res = await request.get(href!, { maxRedirects: 0, headers: { referer: `${siteOrigin}/motos` } });
  expect(res.status()).toBe(302);
  const location = new URL(res.headers().location);
  expect(location.hostname).toBe("wa.me");
  expect(location.searchParams.get("text")).toMatch(/moto\.com\.py/);
});

test("§4.7 honeypot: el campo trampa lleno responde como éxito y no guarda nada", async ({ request }) => {
  const phone = randomPhone();
  const res = await request.post("/api/leads", {
    maxRedirects: 0,
    headers: { origin: siteOrigin, "x-forwarded-for": randomIp() },
    form: { tipo: "financing", pagina: "/financiacion", nombre: "[DEV] trampa", telefono: phone.display, website: "http://spam.example" },
  });
  expect(res.status()).toBe(303);
  expect(res.headers().location).toMatch(/\/gracias\?tipo=financiacion$/);
  expect(lastLead(phone.e164)).toBeNull();
});

test("§4.6 lead de financiación: se guarda y el visitante ve /gracias aunque el CRM no esté (o falle)", async ({ request }) => {
  const phone = randomPhone();
  const res = await request.post("/api/leads", {
    maxRedirects: 0,
    headers: { origin: siteOrigin, "x-forwarded-for": randomIp() },
    form: { tipo: "financing", pagina: "/financiacion", nombre: "[DEV] E2E C2", telefono: phone.display },
  });
  expect(res.status()).toBe(303);
  expect(res.headers().location).toMatch(/\/gracias\?tipo=financiacion$/);
  // Guardado antes de llamar al CRM: la fila existe sea cual sea el estado del CRM.
  expect(lastLead(phone.e164)).toMatchObject({ type: "financing" });
});

test("§4.8 búsqueda vacía: estado vacío honesto, sin tarjetas inventadas, con salida útil", async ({ page }) => {
  await page.goto("/motos?precio_max=1000");
  await expect(page.locator('a[href^="/aviso/"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Escribinos qué moto buscás" })).toHaveAttribute("href", /^\/ir\/wa\/general/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
