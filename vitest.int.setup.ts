// Corre antes de cada archivo de integración, antes de que se importe src/db.
// Apunta DATABASE_URL a la base de pruebas y se niega a seguir si no parece
// una base de pruebas: estas pruebas insertan y borran filas.
import "dotenv/config";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL no está definida. En una sesión de Claude la crea .claude/hooks/session-start.sh; en local, ver .env.example.",
  );
}
const dbName = new URL(testUrl).pathname.replace(/^\//, "");
if (!/test/i.test(dbName)) {
  throw new Error(`TEST_DATABASE_URL apunta a "${dbName}", que no es una base de pruebas (debe contener "test").`);
}
process.env.DATABASE_URL = testUrl;
