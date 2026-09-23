// Denuncias contra MySQL: tope de 5 por IP por día y regla de pausa automática.
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { activityLog, listings, reports } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { submitReport } from "./reports";

const TAG = `b3rep${Date.now()}`;
const SALT = "sal-de-prueba";
let fx: Awaited<ReturnType<typeof createFixtures>>;

beforeAll(async () => {
  fx = await createFixtures(TAG);
});
afterAll(async () => {
  if (fx.ids.listings.length) await db.delete(reports).where(inArray(reports.listingId, fx.ids.listings));
  await fx.cleanup();
  await closeDb();
});

async function publishedListing() {
  const id = await fx.listing({ status: "published", publishedAt: new Date() });
  const [row] = await db.select({ ref: listings.publicRef }).from(listings).where(eq(listings.id, id));
  return { id, ref: row.ref.toLowerCase() };
}

const report = (ref: string, ip: string, reason = "estafa", extra: Partial<Parameters<typeof submitReport>[0]> = {}) =>
  submitReport({ ref, reason, ip, salt: SALT, ...extra });

describe("denuncias", () => {
  it("5 por IP en 24 h; la 6.ª → 429 y no se guarda", async () => {
    const { id, ref } = await publishedListing();
    for (let i = 0; i < 5; i += 1) expect((await report(ref, "10.0.0.1", "no_responde")).ok).toBe(true);
    expect(await report(ref, "10.0.0.1", "no_responde")).toMatchObject({ ok: false, status: 429 });
    expect(await db.select().from(reports).where(eq(reports.listingId, id))).toHaveLength(5);
    // Otra IP sigue pudiendo.
    expect((await report(ref, "10.0.0.2", "no_responde")).ok).toBe(true);
  });

  it("la misma IP tres veces no suma tres denuncias independientes", async () => {
    const { id, ref } = await publishedListing();
    for (let i = 0; i < 3; i += 1) expect(await report(ref, "10.0.1.1")).toMatchObject({ ok: true, autoPause: "not_needed" });
    const [l] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, id));
    expect(l.status).toBe("published");
  });

  it("3 IP distintas con estafa/robada → intenta pausar por transition() con actor sistema", async () => {
    const { id, ref } = await publishedListing();
    expect(await report(ref, "10.0.2.1", "estafa")).toMatchObject({ ok: true, autoPause: "not_needed" });
    expect(await report(ref, "10.0.2.2", "vendida")).toMatchObject({ ok: true, autoPause: "not_needed" });
    expect(await report(ref, "10.0.2.3", "robada")).toMatchObject({ ok: true, autoPause: "not_needed" });
    const third = await report(ref, "10.0.2.4", "estafa");
    // Hoy la matriz de DATABASE_SCHEMA §3 no le da `pause` al sistema: la
    // transición se rechaza (403) y la publicación sigue publicada hasta que
    // el propietario decida (docs/decisions-needed.md, B3). Si aprueba la
    // opción A, esto pasa a `paused` y este test cambia con esa línea.
    expect(third).toMatchObject({ ok: true, autoPause: "blocked", paused: false });
    const [l] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, id));
    expect(l.status).toBe("published");
  });

  it("validación: motivo, «otro» sin detalle, teléfono, honeypot, publicación no pública", async () => {
    const { ref } = await publishedListing();
    expect(await report(ref, "10.0.3.1", "spam")).toMatchObject({ ok: false, status: 400, field: "motivo" });
    expect(await report(ref, "10.0.3.1", "otro")).toMatchObject({ ok: false, field: "detalle" });
    expect(await report(ref, "10.0.3.1", "vendida", { phone: "123" })).toMatchObject({ ok: false, field: "telefono" });
    expect(await report(ref, "10.0.3.1", "vendida", { phone: "0981 123 456" })).toMatchObject({ ok: true });
    const before = await db.select().from(reports);
    expect(await report(ref, "10.0.3.1", "estafa", { honeypot: "http://spam" })).toMatchObject({ ok: true });
    expect(await db.select().from(reports)).toHaveLength(before.length);
    const hidden = await fx.listing({ status: "paused" });
    const [h] = await db.select({ ref: listings.publicRef }).from(listings).where(eq(listings.id, hidden));
    expect(await report(h.ref, "10.0.3.9", "estafa")).toMatchObject({ ok: false, status: 404 });
    // Nada de esto escribió activity_log por su cuenta (la pausa, cuando exista, lo escribe transition()).
    expect(await db.select().from(activityLog).where(inArray(activityLog.entityId, fx.ids.listings))).toHaveLength(0);
  });
});
