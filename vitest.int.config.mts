import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas de integración contra MySQL real: `npm run test:int`.
// Usan TEST_DATABASE_URL (la crea el hook de SessionStart). Corren en serie
// porque comparten una sola base.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  // tsconfig tiene jsx: "preserve" (lo exige Next); las pruebas que
  // renderizan componentes necesitan que Vite transforme el JSX.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts", "scripts/**/*.int.test.ts"],
    setupFiles: ["./vitest.int.setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
