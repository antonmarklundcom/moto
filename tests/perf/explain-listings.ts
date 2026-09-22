// EXPLAIN de las 5 consultas principales de listado sobre moto_dev escalada a
// ~10.000 filas (T-101: "EXPLAIN sin escaneo completo"). Usa los mismos
// constructores que la app (src/lib/listings/query.ts), no SQL copiado a mano.
//
//   npx tsx --conditions=react-server tests/perf/explain-listings.ts
import "dotenv/config";

type Explainable = { toSQL(): { sql: string; params: unknown[] } };

async function main() {
  const { db, closeDb } = await import("../../src/db");
  const { brands, cities } = await import("../../src/db/schema");
  const { countQuery, groupCountQuery, pageIdsQuery } = await import("../../src/lib/listings/query");
  const { eq, sql } = await import("drizzle-orm");

  const [brand] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, "honda"));
  const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, "asuncion"));
  const now = new Date();
  const page = (filters: object, sort: "recientes" | "precio_asc" = "recientes") =>
    pageIdsQuery({ filters, sort, page: 1, perPage: 24, now, scope: "live" });

  const cases: Array<[string, Explainable]> = [
    ["1a /motos — conteo", countQuery({}, { now })],
    ["1b /motos — página 1 (recientes)", page({})],
    ["2a /motos/honda — conteo (umbral)", countQuery({ brandId: brand.id }, { now })],
    ["2b /motos/honda — página 1", page({ brandId: brand.id })],
    ["3a /motos/ciudad/asuncion — conteo", countQuery({ cityId: city.id }, { now })],
    ["3b /motos/ciudad/asuncion — página 1", page({ cityId: city.id })],
    ["4a /motos/honda/ciudad/asuncion — conteo (umbral)", countQuery({ brandId: brand.id, cityId: city.id }, { now })],
    ["4b sitemap — vivas por marca × ciudad", groupCountQuery(["brand", "city"], {}, now)],
    ["5a /motos/en-cuotas?cuota_max=700000&precio_max=15000000&orden=precio_asc — conteo", countQuery({ withFinancing: true, installmentMax: 700_000, priceMax: 15_000_000 }, { now })],
    ["5b ídem — página 1", page({ withFinancing: true, installmentMax: 700_000, priceMax: 15_000_000 }, "precio_asc")],
    ["extra /motos?q=honda cg — FULLTEXT + LIKE", page({ q: "honda cg" })],
  ];

  const [[{ n, live }]] = (await db.execute(
    sql`SELECT COUNT(*) AS n, SUM(status = 'published' AND deleted_at IS NULL) AS live FROM listings`,
  )) as unknown as [[{ n: number; live: number }]];
  console.log(`listings: ${n} filas, ${live} published sin borrar\n`);
  for (const [name, query] of cases) {
    const { sql: text, params } = query.toSQL();
    const [plan] = (await db.execute(sql.raw(`EXPLAIN ${inline(text, params)}`))) as unknown as [Array<Record<string, unknown>>];
    console.log(`### ${name}`);
    for (const row of plan) {
      console.log(
        `  ${row.table} type=${row.type} key=${row.key ?? "—"} rows=${row.rows} extra=${row.Extra ?? ""}`,
      );
    }
    const full = plan.some((row) => row.table === "listings" && row.type === "ALL");
    const times: number[] = [];
    for (let run = 0; run < 7; run += 1) {
      const started = performance.now();
      await db.execute(sql.raw(inline(text, params)));
      times.push(performance.now() - started);
    }
    times.sort((a, b) => a - b);
    const median = times[3].toFixed(1);
    console.log(`  ${full ? "⚠ escaneo completo de listings" : "ok: sin escaneo completo de listings"} · mediana ${median} ms (7 corridas)\n`);
  }
  await closeDb();
}

/** Sustituye los `?` por literales para EXPLAIN (sólo números, fechas y cadenas simples). */
function inline(text: string, params: unknown[]): string {
  let i = 0;
  return text.replace(/\?/g, () => {
    const p = params[i++];
    if (typeof p === "number") return String(p);
    if (p instanceof Date) return `'${p.toISOString().slice(0, 19).replace("T", " ")}'`;
    return `'${String(p).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
