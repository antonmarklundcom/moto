import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

// B8: importación de stock de punta a punta con el build de producción contra
// la base de desarrollo. `next start` corre con NODE_ENV=production, así que
// la guarda de fixtures rechaza las filas DEV- (se prueba acá también). El
// camino feliz usa un comercio de prueba propio (`e2e-comercio`, con bloque de
// autorización) y títulos [DEV], que el próximo `npm run fixtures` borra.
const EMAIL = "e2e-admin@example.com";
const PASSWORD = "clave-e2e-bastante-larga";
const REF = `E2E-${Date.now().toString(36).toUpperCase()}`;
const DEALER = "e2e-comercio";
const DEALER_NAME = "[DEV] Comercio E2E";


const HEADER =
  "comercio,referencia,marca,modelo,condicion,anio,kilometraje,ciudad,categoria,precio_contado_gs,entrega_gs,cuota_gs,cantidad_cuotas,solo_financiado,negociable,acepta_permuta,estado_documentacion,telefono,whatsapp,titulo,descripcion";

test.beforeAll(() => {
  execFileSync("npx", ["tsx", "tests/e2e/support/ensure-e2e-dealer.ts"], { stdio: "inherit" });
  execFileSync("npx", ["tsx", "scripts/create-admin.ts", "--email", EMAIL, "--name", "[DEV] Admin E2E", "--reset"], {
    input: `${PASSWORD}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
});

test("planilla → vista previa → importar → foto → reporte y reconfirmar", async ({ page }) => {
  await page.goto("/admin/login?next=/admin/importar");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/importar$/);
  await expect(page.locator("h1")).toHaveText("Importar stock");

  const csv = [
    HEADER,
    `${DEALER},${REF},Honda,Wave 110S,0km,,,,Cub,9500000,1000000,480000,24,no,no,no,,,,[DEV] Honda Wave 110S 0 km E2E,Prueba E2E.`,
    `${DEALER},${REF}-MALA,Honda,Wave 110S,0km,,,,Cub,,,,,no,no,no,,,,[DEV] sin precio,Sin precio.`,
    `dev-comercio-uno,DEV-${REF},Honda,Wave 110S,0km,,,,Cub,9500000,,,,no,no,no,,,,,Demo.`,
  ].join("\n");
  await page.getByLabel("Planilla (.csv)").setInputFiles({ name: "stock.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Ver vista previa" }).click();
  await expect(page.getByText("Vista previa (todavía no se guardó nada)")).toBeVisible();
  await expect(page.getByText("1 nuevas · 0 a actualizar · 0 sin cambios · 2 rechazadas")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(`${REF}-MALA.*Rechazada`) })).toContainText("Sin precio");
  // Build de producción: la guarda de fixtures rechaza el stock de prueba (ADR-24).
  await expect(page.getByRole("row", { name: new RegExp(`DEV-${REF}.*Rechazada`) })).toContainText("NODE_ENV=production");

  await page.getByRole("button", { name: "Importar 1 fila" }).click();
  await expect(page.getByText("Importación terminada")).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText("1 creadas");
  await expect(page.getByRole("row", { name: new RegExp(`^\\d+ ${REF} `) })).toContainText("Creada");

  const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 30, g: 90, b: 160 } } }).jpeg().toBuffer();
  await page.getByLabel("Fotos", { exact: true }).setInputFiles({ name: `${REF}-1.jpg`, mimeType: "image/jpeg", buffer: photo });
  await page.getByRole("button", { name: "Subir fotos" }).click();
  await expect(page.getByText("Listo: 1 de 1 fotos cargadas.")).toBeVisible();
  await expect(page.getByText(`${REF}-1.jpg → ${REF}`)).toContainText("Foto agregada.");

  // Sin auto_approve: la moto queda en moderación, no en el mensaje de stock publicado.
  await expect(page.getByText(`${REF}-1.jpg → ${REF}`)).toContainText("En moderación");

  await page.getByRole("link", { name: DEALER_NAME }).click();
  await expect(page.locator("h1")).toHaveText(`${DEALER_NAME}: reporte y stock`);
  await expect(page.getByLabel("Texto para WhatsApp")).toHaveValue(/Reporte de \[DEV\] Comercio E2E en moto\.com\.py/);
  await expect(page.getByLabel("Mensaje para el comercio")).not.toHaveValue(new RegExp(REF));
});

test("la planilla modelo se descarga sólo con sesión de admin", async ({ page, request }) => {
  const anon = await request.get("/admin/importar/planilla", { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(anon.status());
  const anonPhoto = await request.post("/admin/importar/fotos", { maxRedirects: 0, multipart: { name: "x.jpg" } });
  expect([302, 307, 401]).toContain(anonPhoto.status());

  await page.goto("/admin/login?next=/admin/importar");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/importar$/);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Descargar la planilla modelo (.csv)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("planilla-stock-moto.csv");
  const text = (await readFile(await download.path())).toString("utf8");
  expect(text.replace(/^\uFEFF/, "").trim()).toBe(HEADER);
});
