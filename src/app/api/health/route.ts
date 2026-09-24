// GET /api/health — ¿está bien instalada la app? Para el propietario, desde el
// navegador, sin SSH ni logs: base, tablas, pasos del arranque y variables.
// Sin secretos (ver src/lib/boot/health.ts). /api/ está fuera de robots.txt.
import { count, eq } from "drizzle-orm";
import { bootState, errorCode } from "@/lib/boot/boot";
import { dbHint, envReport } from "@/lib/boot/health";
import { siteIndexingMode } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), ms).unref());
}

async function database(): Promise<Record<string, unknown>> {
  if (!process.env.DATABASE_URL) return { ok: false, code: "MISSING", hint: dbHint("MISSING") };
  try {
    const { db } = await import("@/db");
    const { brands, users } = await import("@/db/schema");
    const [[b], [a]] = await Promise.race([
      Promise.all([
        db.select({ n: count() }).from(brands),
        db.select({ n: count() }).from(users).where(eq(users.role, "admin")),
      ]),
      timeout(5000),
    ]);
    return { ok: true, brands: Number(b?.n ?? 0), admin: Number(a?.n ?? 0) > 0 };
  } catch (error) {
    const code = errorCode(error);
    return { ok: false, code, hint: dbHint(code) };
  }
}

export async function GET(): Promise<Response> {
  const db = await database();
  const env = envReport(process.env);
  const { steps, attempts } = bootState();
  const ok = db.ok === true && env.DATABASE_URL && env.SESSION_SECRET && env.IP_HASH_SALT && env.SITE_URL;
  return Response.json(
    {
      ok,
      database: db,
      boot: { attempts, steps },
      env,
      indexing: siteIndexingMode(),
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
