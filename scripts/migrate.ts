// Aplica las migraciones versionadas de /drizzle (DATABASE_SCHEMA.md §4).
// Usa el migrador de drizzle-orm, no drizzle-kit, para que funcione igual en
// el slot de Hostinger (donde sólo hay dependencias de producción) y en local.
// tsx no carga .env solo (CLAUDE.md §2): se carga explícitamente, primero.
import "dotenv/config";

import { migrate } from "drizzle-orm/mysql2/migrator";
import { closeDb, db } from "../src/db";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("migrate: migraciones aplicadas");
}

main()
  .then(() => closeDb())
  .catch(async (error) => {
    console.error(error);
    await closeDb().catch(() => {});
    process.exit(1);
  });
