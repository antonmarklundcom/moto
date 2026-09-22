import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas unitarias: sin base de datos, sin red. `npm test`.
// Las de integración (*.int.test.ts) van con vitest.int.config.mts.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lanza fuera de un bundle de servidor de Next; en las
      // pruebas se reemplaza por su variante vacía.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["**/*.int.test.ts", "node_modules/**"],
  },
});
