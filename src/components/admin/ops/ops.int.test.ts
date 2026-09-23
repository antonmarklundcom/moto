// B9 contra MySQL y el VenderCRM falso.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { featuredPurchases, leadDeliveries, leads, listings } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { startMockVenderCrm, type MockVenderCrm } from "@/lib/crm/testing/mock-vendercrm";
import { expireFeatured } from "@/lib/cron/jobs/expire-featured";
import { configSnapshot } from "./config";
import { ConfigView } from "./config-view";
import { crmHealth, retryLead, searchLeads } from "./leads-admin";
import { createFeatured, incomeByMonth, setFeaturedStatus } from "./monetization";

const TAG = `b9${Date.now()}`;
let fx: Awaited<ReturnType<typeof createFixtures>>;
let crm: MockVenderCrm;
const leadIds: number[] = [];

beforeAll(async () => {
  fx = await createFixtures(TAG);
  crm = await startMockVenderCrm("clave-b9");
});
afterAll(async () => {
  if (leadIds.length) {
    await db.delete(leadDeliveries).where(inArray(leadDeliveries.leadId, leadIds));
    await db.delete(leads).where(inArray(leads.id, leadIds));
  }
  if (fx.ids.listings.length) await db.delete(featuredPurchases).where(inArray(featuredPurchases.listingId, fx.ids.listings));
  await fx.cleanup();
  await crm.close();
  await closeDb();
});

async function lead(extra: Partial<typeof leads.$inferInsert> = {}) {
  const n = leadIds.length + 1;
  const [res] = await db.insert(leads).values({
    type: "financing",
    phoneE164: `+59598${String(Date.now()).slice(-7)}`,
    phoneRaw: "0981",
    idempotencyKey: `${TAG}-${n}-${"x".repeat(20)}`,
    payloadJson: { consent_text_version: "financiacion-2026-09-22", source: "moto.com.py", fields: { tipo_lead: "financiacion" } },
    ...extra,
  });
  leadIds.push(res.insertId);
  return res.insertId;
}

const config = () => ({ url: crm.url, apiKey: crm.apiKey });

describe("bandeja de leads", () => {
  it("lead agotado (5 fallidos): alarma y reintento manual con la MISMA idempotency_key", async () => {
    const admin = await fx.user("admin");
    const id = await lead({ crmStatus: "failed", crmAttempts: 5, crmLastError: "HTTP 500" });
    await db.insert(leadDeliveries).values([1, 2, 3, 4, 5].map((attemptNo) => ({ leadId: id, attemptNo, httpStatus: 500 })));
    const health = await crmHealth(admin);
    expect(health.exhausted).toBeGreaterThanOrEqual(1);
    expect((await searchLeads(admin, { exhausted: true })).rows.map((r) => r.id)).toContain(id);

    crm.reset();
    const r = await retryLead(admin, id, { config: config() });
    expect(r).toEqual({ ok: true, status: "sent" });
    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    expect(crm.requests).toHaveLength(1);
    expect(crm.requests[0].body?.idempotency_key).toBe(row.idempotencyKey);
    expect(row).toMatchObject({ crmStatus: "sent", crmAttempts: 6 });
    // Otra vez: ya llegó.
    expect(await retryLead(admin, id, { config: config() })).toMatchObject({ ok: false });
  });

  it("lead pendiente: el reintento pasa por deliverLead de A4 (mismo payload y key)", async () => {
    const admin = await fx.user("admin");
    const id = await lead();
    crm.reset();
    expect(await retryLead(admin, id, { config: config() })).toEqual({ ok: true, status: "sent" });
    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    expect(crm.requests[0].body?.idempotency_key).toBe(row.idempotencyKey);
  });

  it("moderador y dealer no reintentan (403); el dealer ve sólo los leads de sus motos", async () => {
    const mod = await fx.user("moderator");
    const dealerA = await fx.dealer();
    const dealerB = await fx.dealer();
    const userA = await fx.user("dealer", { dealerId: dealerA });
    const mine = await lead({ dealerId: dealerA });
    const other = await lead({ dealerId: dealerB });
    await expect(retryLead(mod, mine, { config: config() })).rejects.toMatchObject({ status: 403 });
    await expect(retryLead(userA, mine, { config: config() })).rejects.toMatchObject({ status: 403 });
    const seen = (await searchLeads(userA, {})).rows.map((r) => r.id);
    expect(seen).toContain(mine);
    expect(seen).not.toContain(other);
  });
});

describe("configuración", () => {
  it("nunca muestra un secreto: sólo si está cargado", async () => {
    const admin = await fx.user("admin");
    const saved = { ...process.env };
    const secrets = {
      VENDERCRM_API_KEY: "SECRETO-CRM-b9-123456",
      VENDERCRM_URL: "https://crm.example.test/ruta-privada-b9",
      CRON_SECRET: "SECRETO-CRON-b9-123456",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "x".repeat(40),
      IP_HASH_SALT: "SECRETO-SAL-b9-123456",
    };
    Object.assign(process.env, secrets);
    try {
      const html = renderToStaticMarkup(createElement(ConfigView, { c: await configSnapshot(admin) }));
      for (const value of Object.values(secrets)) expect(html).not.toContain(value);
      expect(html).toContain("Cargada");
    } finally {
      for (const k of Object.keys(secrets)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
    const mod = await fx.user("moderator");
    await expect(configSnapshot(mod)).rejects.toMatchObject({ status: 403 });
  });
});

describe("monetización", () => {
  it("destacado cobrado enciende is_featured; el job lo apaga al vencer; reintegrado lo apaga; ingresos = lo cobrado", async () => {
    const admin = await fx.user("admin");
    const id = await fx.listing({ status: "published", publishedAt: new Date() });
    const [l] = await db.select({ ref: listings.publicRef }).from(listings).where(eq(listings.id, id));
    const past = new Date(Date.now() - 10 * 86_400_000);
    const created = await createFeatured(admin, { ref: l.ref, days: 3, amountGs: 50_000, method: "transferencia", reference: "OP-1", paid: true, now: past });
    if (!created.ok) throw new Error(created.error);
    expect((await db.select({ f: listings.isFeatured }).from(listings).where(eq(listings.id, id)))[0].f).toBe(true);
    const run = await expireFeatured({ now: new Date(), runId: 0 });
    expect(run.listingsUnfeatured).toBeGreaterThanOrEqual(1);
    expect((await db.select({ f: listings.isFeatured }).from(listings).where(eq(listings.id, id)))[0].f).toBe(false);
    const [p] = await db.select().from(featuredPurchases).where(eq(featuredPurchases.id, created.id));
    expect(p.status).toBe("expired");

    const pending = await createFeatured(admin, { ref: l.ref, days: 7, amountGs: 70_000, method: "tigo_money", reference: null, paid: false });
    if (!pending.ok) throw new Error(pending.error);
    const income = await incomeByMonth(admin);
    const total = income.reduce((s, m) => s + m.featured, 0);
    // El pendiente de pago no suma.
    const [{ sum }] = await db
      .select({ sum: sql<string>`COALESCE(SUM(${featuredPurchases.amountGs}), 0)` })
      .from(featuredPurchases)
      .where(and(inArray(featuredPurchases.status, ["active", "expired"]), gte(featuredPurchases.startsAt, new Date(Date.now() - 372 * 86_400_000))));
    expect(total).toBe(Number(sum));
    expect((await setFeaturedStatus(admin, pending.id, "active")).ok).toBe(true);
    expect((await setFeaturedStatus(admin, pending.id, "refunded")).ok).toBe(true);
    expect((await db.select({ f: listings.isFeatured }).from(listings).where(eq(listings.id, id)))[0].f).toBe(false);

    const mod = await fx.user("moderator");
    await expect(createFeatured(mod, { ref: l.ref, days: 1, amountGs: 1, method: "efectivo", reference: null, paid: true })).rejects.toMatchObject({ status: 403 });
    expect(await createFeatured(admin, { ref: l.ref, days: 1, amountGs: 5, method: "cortesia", reference: null, paid: true })).toMatchObject({ ok: false });
  });
});
