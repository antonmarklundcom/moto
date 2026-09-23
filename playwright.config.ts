import { defineConfig, devices } from "@playwright/test";

// E2E (TEST_PLAN.md §4): Chromium con viewport móvil. En las sesiones de
// Claude el navegador ya está en /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH);
// nunca correr `playwright install`. @playwright/test está fijado a la versión
// que corresponde a ese Chromium.
//
// Requiere un build previo: `npm run build && npm run e2e`.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "./test-results",
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    // Los jobs automáticos no corren durante las pruebas (tocarían los datos de prueba).
    env: { INTERNAL_CRON: "false" },
    timeout: 60_000,
  },
});
