import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/session";
import { CrudForm } from "@/components/admin/crud/crud-form";
import { NEW_DEALER_TTL_DAYS } from "@/components/admin/crud/dealers-admin";
import { saveDealerAction } from "../actions";
import { dealerFields } from "../dealer-fields";

export default async function Page() {
  await requirePageRole("/admin/comercios/nuevo", "admin");
  const cityOpts = await db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder));
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Nuevo comercio</h1>
      <CrudForm
        action={saveDealerAction}
        fields={dealerFields({ cities: cityOpts, slugLocked: false })}
        initial={{ status: "prospect", listingTtlDays: String(NEW_DEALER_TTL_DAYS), cityId: String(cityOpts[0]?.id ?? "") }}
        submitLabel="Crear comercio"
      />
    </main>
  );
}
