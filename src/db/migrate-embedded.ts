// Migraciones desde el bundle (src/generated/embedded.ts), sin leer /drizzle
// del disco: en Hostinger esa carpeta puede no estar junto al build. Mismo
// migrador y misma tabla __drizzle_migrations que `migrate()` de drizzle-orm,
// así que una base migrada con `npm run db:migrate` sigue igual.
import type { MySql2Database } from "drizzle-orm/mysql2";
import { MIGRATIONS } from "@/generated/embedded";

type Migrator = {
  dialect: { migrate(migrations: unknown, session: unknown, config: { migrationsFolder: string }): Promise<void> };
  session: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function migrateEmbedded(db: MySql2Database<any>): Promise<{ migrations: number }> {
  // `dialect` y `session` no son públicos en los tipos; drizzle hace lo mismo en su migrate().
  const m = db as unknown as Migrator;
  await m.dialect.migrate(MIGRATIONS, m.session, { migrationsFolder: "(embebidas)" });
  return { migrations: MIGRATIONS.length };
}
