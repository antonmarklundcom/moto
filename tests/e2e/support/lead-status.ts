// Estado del último lead de un teléfono (E.164) en la base de desarrollo, en JSON.
import "dotenv/config";

async function main() {
  const phone = process.argv[2];
  const { desc, eq } = await import("drizzle-orm");
  const { closeDb, db } = await import("../../../src/db");
  const { leads } = await import("../../../src/db/schema");
  const [row] = await db
    .select({ id: leads.id, type: leads.type, listingId: leads.listingId, crmStatus: leads.crmStatus, payload: leads.payloadJson })
    .from(leads)
    .where(eq(leads.phoneE164, phone))
    .orderBy(desc(leads.id))
    .limit(1);
  console.log(JSON.stringify(row ?? null));
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
