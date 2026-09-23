// Apoyo de tests/e2e/publish.spec.ts. Sólo base local.
//   reset         → da de baja (deleted_at) las publicaciones E2E anteriores y
//                   les quita la IP, para que el límite de 3 por IP no frene la corrida.
//   token <marca> → emite el enlace /mi-aviso de la última publicación E2E con
//                   esa marca en la descripción (en producción lo emite la
//                   aprobación de moderación) y lo imprime.
import "dotenv/config";

import { fixturesRefusalReason } from "../../../scripts/lib/dev-fixtures-core";

async function main() {
  const refusal = fixturesRefusalReason({ ...process.env, NODE_ENV: "development" });
  if (refusal) throw new Error(`publish-e2e: ${refusal}`);
  const { desc, like, sql } = await import("drizzle-orm");
  const { closeDb, db } = await import("../../../src/db");
  const { listings } = await import("../../../src/db/schema");
  const { rotateManageToken } = await import("../../../src/lib/manage-token");
  const [cmd, marker] = process.argv.slice(2);
  if (cmd === "reset") {
    await db
      .update(listings)
      .set({ submittedIp: null, deletedAt: sql`COALESCE(${listings.deletedAt}, NOW())` })
      .where(like(listings.description, "%E2E-PUB-%"));
  } else if (cmd === "token" && marker) {
    const [row] = await db.select({ id: listings.id }).from(listings).where(like(listings.description, `%${marker}%`)).orderBy(desc(listings.id)).limit(1);
    if (!row) throw new Error(`publish-e2e: no hay publicación con ${marker}`);
    process.stdout.write(`${row.id} ${await rotateManageToken(row.id)}\n`);
  } else {
    throw new Error("uso: publish-e2e reset | token <marca>");
  }
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
