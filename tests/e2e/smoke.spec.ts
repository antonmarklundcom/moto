import { expect, test } from "@playwright/test";

// Humo: la home responde, tiene un solo h1 y, con SITE_NOINDEX=true, noindex.
test("la home carga con un solo h1 y noindex", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  if ((process.env.SITE_NOINDEX ?? "true") === "true") {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response?.headers()["x-powered-by"]).toBeUndefined();
});
