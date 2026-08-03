import { sql } from "drizzle-orm";
import { db } from "@/db";
import { brands, cities } from "@/db/schema";

// Server component sin caché: T-005 exige que el sitio desplegado sirva una
// página con datos reales de la base, no una página completamente estática.
// La home con diseño final llega en T-120 (fase 1); esto sólo prueba la
// conexión a producción con un número real, nunca inventado (PLAN.md §5).
export const dynamic = "force-dynamic";

async function getCatalogSnapshot() {
  const [[{ count: cityCount }], [{ count: brandCount }]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(cities).where(sql`is_active = true`),
    db.select({ count: sql<number>`count(*)` }).from(brands).where(sql`is_active = true`),
  ]);
  return { cityCount, brandCount };
}

export default async function HomePage() {
  const { cityCount, brandCount } = await getCatalogSnapshot();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">moto.com.py</h1>
      <p className="text-base text-neutral-600">
        Estamos armando el portal de motos de Paraguay. Muy pronto vas a poder
        buscar motos, comparar cuotas y escribir por WhatsApp al vendedor.
      </p>
      <p className="text-sm text-neutral-500">
        Catálogo cargado hasta ahora: {cityCount} ciudades y {brandCount} marcas.
      </p>
    </main>
  );
}
