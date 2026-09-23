// Importador de stock (B8) contra MySQL: idempotencia, rechazos, sugerencias
// de modelo, auto_approve, fotos, reporte y reconfirmación.
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import {
  activityLog,
  cities,
  dealers,
  leads,
  listingEvents,
  listingImages,
  listings,
  modelSuggestions,
  users,
} from "@/db/schema";
import { jpegWithGps, png } from "@/lib/images/test-images";
import { addDays } from "@/lib/listings/state";
import { applyImport, previewImport } from "./apply";
import { dealerReport, reconfirmStock } from "./dealer-ops";
import { attachPhoto, photoCandidates } from "./photos";

const TAG = `b8${Date.now()}`;
const dealerIds: number[] = [];
let adminId: number;
let dealerA: { id: number; slug: string }; // sin auto_approve
let dealerB: { id: number; slug: string }; // con auto_approve, TTL 30
let dealerNoAuth: { id: number; slug: string };

async function makeDealer(n: number, extra: Partial<typeof dealers.$inferInsert> = {}) {
  const [city] = await db.select({ id: cities.id }).from(cities).limit(1);
  const slug = `${TAG}-c${n}`;
  const [res] = await db.insert(dealers).values({
    name: `Comercio prueba ${TAG} ${n}`,
    slug,
    cityId: city.id,
    phoneE164: "+595981000111",
    phoneRaw: "0981 000 111",
    status: "active",
    authorizationNote: "Autorizo publicar mi stock (texto de prueba).",
    authorizationDate: "2026-09-01",
    authorizationChannel: "whatsapp",
    ...extra,
  });
  dealerIds.push(res.insertId);
  return { id: res.insertId, slug };
}

const HEADER =
  "comercio,referencia,marca,modelo,condicion,anio,kilometraje,ciudad,categoria,precio_contado_gs,entrega_gs,cuota_gs,cantidad_cuotas,solo_financiado,negociable,acepta_permuta,estado_documentacion,telefono,whatsapp,titulo,descripcion";

function csv(dealerSlug: string, rows: string[][]): string {
  return [HEADER, ...rows.map((r) => [dealerSlug, ...r].join(","))].join("\n");
}

// referencia, marca, modelo, condicion, anio, km, ciudad, categoria, precio, entrega, cuota, cuotas, solo_fin, neg, permuta, doc, tel, wa, titulo, desc
const GOOD = (ref: string, price = "15500000"): string[] => [
  ref, "Yamaha", "XTZ 150", "usada", "2021", "18500", "", "Enduro / Cross", price, "", "", "", "no", "si", "no", "al_dia", "0981 123 456", "si", "", "Service al día",
];
const NEW_WAVE = (ref: string): string[] => [
  ref, "Honda", "Wave 110S", "0km", "", "", "", "Cub", "9500000", "1000000", "480000", "24", "no", "no", "no", "", "", "", "", "",
];

async function dealerListings(dealerId: number) {
  return db.select().from(listings).where(eq(listings.dealerId, dealerId));
}

beforeAll(async () => {
  dealerA = await makeDealer(1);
  dealerB = await makeDealer(2, { autoApprove: true, listingTtlDays: 30 });
  dealerNoAuth = await makeDealer(3, { authorizationNote: null, authorizationDate: null });
  const [u] = await db.insert(users).values({ email: `${TAG}@example.com`, name: "Admin prueba", passwordHash: "x", role: "admin" });
  adminId = u.insertId;
});

afterAll(async () => {
  const ids = (await db.select({ id: listings.id }).from(listings).where(inArray(listings.dealerId, dealerIds))).map((r) => r.id);
  if (ids.length) {
    await db.delete(activityLog).where(and(eq(activityLog.entityType, "listing"), inArray(activityLog.entityId, ids)));
    await db.delete(modelSuggestions).where(inArray(modelSuggestions.listingId, ids));
    await db.delete(listingEvents).where(inArray(listingEvents.listingId, ids));
    await db.delete(leads).where(inArray(leads.listingId, ids));
    await db.delete(listingImages).where(inArray(listingImages.listingId, ids));
    await db.delete(listings).where(inArray(listings.id, ids));
  }
  await db.delete(activityLog).where(or(eq(activityLog.userId, adminId), and(eq(activityLog.entityType, "dealer"), inArray(activityLog.entityId, dealerIds))));
  await db.delete(users).where(eq(users.id, adminId));
  await db.delete(dealers).where(inArray(dealers.id, dealerIds));
  await closeDb();
});

describe("importación de stock", () => {
  it("vista previa no escribe; aplicar crea; re-importar el mismo CSV crea 0 duplicados", async () => {
    const text = csv(dealerA.slug, [GOOD("A-1"), GOOD("A-2"), NEW_WAVE("A-3")]);
    const plan = await previewImport({ csvText: text, defaultDealerId: null });
    expect(plan.counts).toEqual({ create: 3, update: 0, unchanged: 0, reject: 0 });
    expect(await dealerListings(dealerA.id)).toHaveLength(0);

    const first = await applyImport({ csvText: text, defaultDealerId: null, expectedHash: plan.hash, source: { kind: "admin", userId: adminId } });
    expect(first.ok).toBe(true);
    const rows = await dealerListings(dealerA.id);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      // Sin auto_approve (y sin fotos): quedan en moderación, nunca publicadas solas.
      expect(r.status).toBe("pending_review");
      expect(r.lastVerifiedAt).not.toBeNull();
      expect(r.updatedBy).toBe(adminId);
    }
    const log = await db
      .select({ action: activityLog.action, userId: activityLog.userId })
      .from(activityLog)
      .where(and(eq(activityLog.entityType, "listing"), inArray(activityLog.entityId, rows.map((r) => r.id))));
    expect(log).toHaveLength(3);
    expect(log.every((l) => l.action === "imported" && l.userId === adminId)).toBe(true);

    const again = await applyImport({ csvText: text, defaultDealerId: null, source: { kind: "cli" } });
    if (!again.ok) throw new Error("esperaba ok");
    expect(again.outcomes.map((o) => o.action)).toEqual(["unchanged", "unchanged", "unchanged"]);
    expect(await dealerListings(dealerA.id)).toHaveLength(3);
  });

  it("cambio de precio → actualiza, con import_updated y price_changed en activity_log", async () => {
    const res = await applyImport({
      csvText: csv(dealerA.slug, [GOOD("A-1", "14900000")]),
      defaultDealerId: null,
      source: { kind: "admin", userId: adminId },
    });
    if (!res.ok) throw new Error("esperaba ok");
    expect(res.outcomes[0].action).toBe("updated");
    const [row] = await db.select().from(listings).where(and(eq(listings.dealerId, dealerA.id), eq(listings.externalRef, "A-1")));
    expect(row.priceGs).toBe(14_900_000);
    const actions = (
      await db.select({ action: activityLog.action, diff: activityLog.diffJson }).from(activityLog).where(and(eq(activityLog.entityType, "listing"), eq(activityLog.entityId, row.id)))
    ).map((a) => a.action);
    expect(actions).toEqual(["imported", "import_updated", "price_changed"]);
  });

  it("fila mala → rechazada con motivo y sin escribir; las buenas del mismo archivo sí entran", async () => {
    const bad = [...GOOD("A-9")];
    bad[8] = ""; // sin precio
    const res = await applyImport({
      csvText: csv(dealerA.slug, [bad, GOOD("A-10")]),
      defaultDealerId: null,
      source: { kind: "cli" },
    });
    if (!res.ok) throw new Error("esperaba ok");
    expect(res.outcomes[0]).toMatchObject({ action: "rejected", externalRef: "A-9" });
    expect(res.outcomes[0].message).toContain("Sin precio");
    expect(res.outcomes[1].action).toBe("created");
    const [{ n }] = await db.select({ n: count() }).from(listings).where(and(eq(listings.dealerId, dealerA.id), eq(listings.externalRef, "A-9")));
    expect(n).toBe(0);
  });

  it("modelo desconocido → publicación en moderación sin model_id y una sugerencia pendiente (una sola al re-importar)", async () => {
    const row = [...GOOD("A-20")];
    row[2] = "XTZ 300 Rally";
    const text = csv(dealerA.slug, [row]);
    await applyImport({ csvText: text, defaultDealerId: null, source: { kind: "cli" } });
    await applyImport({ csvText: text, defaultDealerId: null, source: { kind: "cli" } });
    const [l] = await db.select().from(listings).where(and(eq(listings.dealerId, dealerA.id), eq(listings.externalRef, "A-20")));
    expect(l).toMatchObject({ modelId: null, modelRaw: "XTZ 300 Rally", status: "pending_review" });
    const s = await db.select().from(modelSuggestions).where(eq(modelSuggestions.listingId, l.id));
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ rawText: "XTZ 300 Rally", status: "pending", brandId: l.brandId });
  });

  it("comercio sin bloque de autorización → todo rechazado (ADR-12)", async () => {
    const res = await applyImport({ csvText: csv(dealerNoAuth.slug, [GOOD("N-1")]), defaultDealerId: null, source: { kind: "cli" } });
    if (!res.ok) throw new Error("esperaba ok");
    expect(res.outcomes[0].action).toBe("rejected");
    expect(res.outcomes[0].message).toContain("autorización");
    expect(await dealerListings(dealerNoAuth.id)).toHaveLength(0);
  });

  it("si la base cambió después de la vista previa, no aplica nada", async () => {
    const text = csv(dealerA.slug, [GOOD("A-30")]);
    const plan = await previewImport({ csvText: text, defaultDealerId: null });
    await applyImport({ csvText: text, defaultDealerId: null, source: { kind: "cli" } }); // otra sesión la crea
    const stale = await applyImport({ csvText: text, defaultDealerId: null, expectedHash: plan.hash, source: { kind: "cli" } });
    expect(stale).toMatchObject({ ok: false, reason: "stale" });
    expect(stale.plan.counts.unchanged).toBe(1);
  });

  it("auto_approve: sin foto queda en moderación; con la foto pasa a publicada por la máquina de estados", async () => {
    const res = await applyImport({ csvText: csv(dealerB.slug, [NEW_WAVE("B-1"), GOOD("B-2")]), defaultDealerId: null, source: { kind: "cli" } });
    if (!res.ok) throw new Error("esperaba ok");
    expect(res.outcomes.map((o) => o.status)).toEqual(["pending_review", "pending_review"]);
    expect(res.outcomes[0].message).toContain("foto");

    const candidates = await photoCandidates(dealerB.id);
    // Usada con sólo foto de catálogo: no se publica sola (checklist §3).
    const catalogOnly = await attachPhoto({ fileName: "B-2-catalogo.png", data: await png(800, 600), candidates, source: { kind: "cli" } });
    expect(catalogOnly).toMatchObject({ ok: true, externalRef: "B-2", status: "pending_review" });

    const photo = await jpegWithGps(1200, 900);
    const out = await attachPhoto({ fileName: "fotos/b-1-2.jpg", data: photo, candidates, source: { kind: "admin", userId: adminId } });
    expect(out).toMatchObject({ ok: true, externalRef: "B-1", status: "published", duplicate: false });
    const dup = await attachPhoto({ fileName: "B-1-3.jpg", data: photo, candidates, source: { kind: "cli" } });
    expect(dup).toMatchObject({ ok: true, duplicate: true });

    const [l] = await db.select().from(listings).where(and(eq(listings.dealerId, dealerB.id), eq(listings.externalRef, "B-1")));
    expect(l.status).toBe("published");
    const imgs = await db.select().from(listingImages).where(eq(listingImages.listingId, l.id));
    expect(imgs).toHaveLength(1);
    expect(imgs[0].storagePath).toMatch(/^listings\/[0-9a-f]{2}\/[0-9a-f]{32}-\d+\.webp$/);
    const actions = (
      await db.select({ action: activityLog.action, userId: activityLog.userId }).from(activityLog).where(and(eq(activityLog.entityType, "listing"), eq(activityLog.entityId, l.id)))
    ).map((a) => a.action);
    expect(actions).toEqual(["imported", "photo_imported", "approved"]);

    const unmatched = await attachPhoto({ fileName: "ZZ-9.jpg", data: photo, candidates, source: { kind: "cli" } });
    expect(unmatched.ok).toBe(false);
    const notImage = await attachPhoto({ fileName: "B-1.jpg", data: Buffer.from("MZ ejecutable"), candidates, source: { kind: "cli" } });
    expect(notImage.ok).toBe(false);
  });
});

describe("reporte del comercio (G-14)", () => {
  it("cuenta lo mismo que una consulta directa: sin bots, sin spam, sólo sus motos y en el rango", async () => {
    const [mine] = await db.select({ id: listings.id }).from(listings).where(and(eq(listings.dealerId, dealerB.id), eq(listings.externalRef, "B-1")));
    const [other] = await db.select({ id: listings.id }).from(listings).where(eq(listings.dealerId, dealerA.id)).limit(1);
    const now = new Date();
    const inRange = new Date(now.getTime() - 2 * 86_400_000);
    const old = new Date(now.getTime() - 40 * 86_400_000);
    const ev = (listingId: number, eventType: "view" | "whatsapp_click" | "phone_reveal", isBot: boolean, createdAt: Date) => ({
      listingId,
      eventType,
      isBot,
      createdAt,
      dealerId: null,
    });
    await db.insert(listingEvents).values([
      ev(mine.id, "view", false, inRange),
      ev(mine.id, "view", false, inRange),
      ev(mine.id, "view", false, inRange),
      ev(mine.id, "view", true, inRange),
      ev(mine.id, "view", false, old),
      ev(mine.id, "whatsapp_click", false, inRange),
      ev(mine.id, "whatsapp_click", true, inRange),
      ev(mine.id, "phone_reveal", false, inRange),
      ev(other.id, "view", false, inRange),
    ]);
    const lead = (listingId: number, type: "financing" | "insurance", isSpam: boolean, createdAt: Date, n: number) => ({
      type,
      listingId,
      phoneE164: "+595981000999",
      phoneRaw: "0981 000 999",
      idempotencyKey: `${TAG}-${n}`,
      isSpam,
      createdAt,
    });
    await db.insert(leads).values([
      lead(mine.id, "financing", false, inRange, 1),
      lead(mine.id, "financing", false, inRange, 2),
      lead(mine.id, "financing", true, inRange, 3),
      lead(mine.id, "insurance", false, inRange, 4),
      lead(mine.id, "financing", false, old, 5),
      lead(other.id, "financing", false, inRange, 6),
    ]);

    const range = { from: addDays(now, -30), to: addDays(now, 1) };
    const report = await dealerReport(dealerB.id, range);
    expect(report).toMatchObject({ views: 3, whatsappClicks: 1, financingLeads: 2, publishedNow: 1 });

    // La misma cuenta, escrita a mano en SQL.
    const [[raw]] = (await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM listing_events e JOIN listings l ON l.id = e.listing_id
          WHERE l.dealer_id = ${dealerB.id} AND e.event_type = 'view' AND e.is_bot = 0 AND e.created_at >= ${range.from} AND e.created_at < ${range.to}) AS views,
        (SELECT COUNT(*) FROM listing_events e JOIN listings l ON l.id = e.listing_id
          WHERE l.dealer_id = ${dealerB.id} AND e.event_type = 'whatsapp_click' AND e.is_bot = 0 AND e.created_at >= ${range.from} AND e.created_at < ${range.to}) AS clicks,
        (SELECT COUNT(*) FROM leads d JOIN listings l ON l.id = d.listing_id
          WHERE l.dealer_id = ${dealerB.id} AND d.type = 'financing' AND d.is_spam = 0 AND d.created_at >= ${range.from} AND d.created_at < ${range.to}) AS fin
    `)) as unknown as [[{ views: number; clicks: number; fin: number }]];
    expect([report.views, report.whatsappClicks, report.financingLeads]).toEqual([Number(raw.views), Number(raw.clicks), Number(raw.fin)]);
  });
});

describe("reconfirmar stock (G-6)", () => {
  it("renueva last_verified_at y expires_at = ahora + TTL del comercio; ignora ajenas y no publicadas", async () => {
    const [pub] = await db.select().from(listings).where(and(eq(listings.dealerId, dealerB.id), eq(listings.status, "published")));
    const [pending] = await db.select().from(listings).where(and(eq(listings.dealerId, dealerB.id), eq(listings.status, "pending_review")));
    const [foreign] = await db.select().from(listings).where(eq(listings.dealerId, dealerA.id)).limit(1);
    const now = new Date(Date.now() + 5 * 86_400_000);
    now.setMilliseconds(0);
    const res = await reconfirmStock({ dealerId: dealerB.id, listingIds: [pub.id, pending.id, foreign.id], userId: adminId, now });
    expect(res).toEqual({ updated: 1, ignored: 2 });
    const [after] = await db.select().from(listings).where(eq(listings.id, pub.id));
    expect(after.lastVerifiedAt?.toISOString()).toBe(now.toISOString());
    expect(after.expiresAt?.toISOString()).toBe(addDays(now, 30).toISOString());
    const [untouched] = await db.select().from(listings).where(eq(listings.id, foreign.id));
    expect(untouched.lastVerifiedAt?.toISOString()).toBe(foreign.lastVerifiedAt?.toISOString());
    const [log] = await db
      .select()
      .from(activityLog)
      .where(and(eq(activityLog.entityType, "listing"), eq(activityLog.entityId, pub.id), eq(activityLog.action, "stock_reconfirmed")));
    expect(log.userId).toBe(adminId);
  });
});
