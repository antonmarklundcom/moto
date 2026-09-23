// Denuncias contra MySQL: tope de 5 por IP por día y regla de pausa automática.
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { activityLog, listings, reports } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { REPORTS_AUTO_PAUSE_JOB, TransitionForbiddenError, transition } from "@/lib/listings/state";
import { MUTED_REPORT_NOTE, submitReport } from "./reports";

const TAG = `b3rep${Date.now()}`;
const SALT = "sal-de-prueba";
let fx: Awaited<ReturnType<typeof createFixtures>>;

beforeAll(async () => {
  fx = await createFixtures(TAG);
});
afterAll(async () => {
  if (fx.ids.listings.length) await db.delete(activityLog).where(and(eq(activityLog.entityType, "listing"), inArray(activityLog.entityId, fx.ids.listings)));
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

  it("3 IP distintas con estafa/robada → pausa con actor sistema; el dueño no la reanuda, un moderador sí", async () => {
    const seller = await fx.user("seller");
    const { id, ref } = await publishedListing();
    await db.update(listings).set({ ownerUserId: seller.id }).where(eq(listings.id, id));
    expect(await report(ref, "10.0.2.1", "estafa")).toMatchObject({ ok: true, autoPause: "not_needed" });
    expect(await report(ref, "10.0.2.2", "vendida")).toMatchObject({ ok: true, autoPause: "not_needed" });
    expect(await report(ref, "10.0.2.3", "robada")).toMatchObject({ ok: true, autoPause: "not_needed" });
    expect(await report(ref, "10.0.2.4", "estafa")).toMatchObject({ ok: true, autoPause: "paused", paused: true });
    const status = async () => (await db.select({ s: listings.status }).from(listings).where(eq(listings.id, id)))[0].s;
    expect(await status()).toBe("paused");
    const log = await db.select().from(activityLog).where(and(eq(activityLog.entityId, id), eq(activityLog.action, "paused")));
    expect(log).toHaveLength(1);
    expect((log[0].diffJson as { job?: string }).job).toBe(REPORTS_AUTO_PAUSE_JOB);

    // El dueño no puede sacarse la pausa de encima.
    await expect(transition({ listingId: id, action: "resume", actor: { kind: "user", user: seller } })).rejects.toBeInstanceOf(TransitionForbiddenError);
    expect(await status()).toBe("paused");

    // Un moderador la reanuda: las denuncias viejas no cuentan y hay 30 días sin pausa automática.
    const mod = await fx.user("moderator");
    await transition({ listingId: id, action: "resume", actor: { kind: "user", user: mod } });
    expect(await status()).toBe("published");
    const later = { now: new Date(Date.now() + 5000) };
    for (const ip of ["10.0.2.5", "10.0.2.6"]) expect(await report(ref, ip, "estafa", later)).toMatchObject({ autoPause: "not_needed" });
    expect(await report(ref, "10.0.2.7", "estafa", later)).toMatchObject({ ok: true, autoPause: "cooldown", paused: false });
    expect(await status()).toBe("published");
  });

  it("una IP con 2 denuncias descartadas por un moderador queda silenciada, sin enterarse", async () => {
    const mod = await fx.user("moderator");
    const bad = "10.0.4.1";
    const first = await publishedListing();
    for (let i = 0; i < 2; i += 1) {
      expect((await report(first.ref, bad, "estafa")).ok).toBe(true);
    }
    await db
      .update(reports)
      .set({ status: "dismissed", resolvedBy: mod.id, resolvedAt: new Date(), resolutionNote: "infundada" })
      .where(eq(reports.listingId, first.id));

    const target = await publishedListing();
    const res = await report(target.ref, bad, "estafa");
    expect(res).toEqual({ ok: true, paused: false, autoPause: "not_needed" });
    const [row] = await db.select().from(reports).where(eq(reports.listingId, target.id));
    expect(row.status).toBe("dismissed");
    expect(row.resolutionNote).toBe(MUTED_REPORT_NOTE);
    // Con dos IP honestas más no llega a 3 independientes: la silenciada no cuenta.
    expect(await report(target.ref, "10.0.4.2", "estafa")).toMatchObject({ autoPause: "not_needed" });
    expect(await report(target.ref, "10.0.4.3", "estafa")).toMatchObject({ autoPause: "not_needed" });
    const [l] = await db.select({ s: listings.status }).from(listings).where(eq(listings.id, target.id));
    expect(l.s).toBe("published");
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
    // Validar no escribe activity_log (la pausa la escribe transition()).
    expect(await db.select().from(activityLog).where(eq(activityLog.entityId, hidden))).toHaveLength(0);
  });
});
