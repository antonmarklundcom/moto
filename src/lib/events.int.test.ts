// recordListingEvent contra MySQL: inserta con hashes, marca bots, incrementa
// el contador sólo para personas sin tocar updated_at (lastmod del sitemap),
// y nunca lanza.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { listingEvents, listings } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { recordListingEvent, resetViewBurstsForTests, VIEW_BURST_LIMIT } from "./events";

const CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const fx = await createFixtures(`a2ev${Date.now().toString(36)}`);
let listingId = 0;
let dealerId = 0;
const OLD = new Date("2026-01-01T00:00:00Z");

function headers(h: Record<string, string>): Headers {
  return new Headers(h);
}

beforeAll(async () => {
  process.env.IP_HASH_SALT ||= "sal-de-prueba-integracion";
  process.env.SITE_URL = "https://moto.com.py";
  dealerId = await fx.dealer();
  listingId = await fx.listing({ status: "published", publishedAt: OLD, dealerId, updatedAt: OLD }, { image: false });
});

beforeEach(() => resetViewBurstsForTests());

afterAll(async () => {
  await db.delete(listingEvents).where(inArray(listingEvents.listingId, fx.ids.listings));
  await fx.cleanup();
  await closeDb();
});

async function events() {
  return db.select().from(listingEvents).where(eq(listingEvents.listingId, listingId)).orderBy(listingEvents.id);
}
async function listingRow() {
  const [row] = await db.select().from(listings).where(eq(listings.id, listingId));
  return row;
}

describe("recordListingEvent", () => {
  it("vista de una persona: fila con hashes, sin IP en claro; view_count +1; updated_at intacto", async () => {
    const res = await recordListingEvent({
      type: "view",
      listingId,
      dealerId,
      pagePath: "/aviso/x-a3f9k2p7?utm_source=wa",
      headers: headers({ "user-agent": CHROME, "x-forwarded-for": "181.120.1.2, 10.0.0.1", referer: "https://www.google.com/search?q=moto" }),
    });
    expect(res).toEqual({ recorded: true, isBot: false });
    const [ev] = await events();
    expect(ev).toMatchObject({ eventType: "view", dealerId, isBot: false, referrer: "https://www.google.com/search", pageUrl: "/aviso/x-a3f9k2p7" });
    expect(ev.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ev.sessionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ev.userAgentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ev)).not.toContain("181.120.1.2");
    const row = await listingRow();
    expect(row.viewCount).toBe(1);
    expect(row.updatedAt.toISOString()).toBe(OLD.toISOString());
  });

  it("bot: se guarda marcado y no suma al contador", async () => {
    const res = await recordListingEvent({ type: "view", listingId, headers: headers({ "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }) });
    expect(res).toEqual({ recorded: true, isBot: true });
    expect((await events()).at(-1)?.isBot).toBe(true);
    expect((await listingRow()).viewCount).toBe(1);
  });

  it("clic de WhatsApp sin referer propio → bot; con referer propio → persona y +1", async () => {
    expect((await recordListingEvent({ type: "whatsapp_click", listingId, dealerId, headers: headers({ "user-agent": CHROME }) })).isBot).toBe(true);
    const ok = await recordListingEvent({
      type: "whatsapp_click",
      listingId,
      dealerId,
      headers: headers({ "user-agent": CHROME, referer: "https://moto.com.py/aviso/x-a3f9k2p7" }),
    });
    expect(ok).toEqual({ recorded: true, isBot: false });
    expect((await listingRow()).whatsappClickCount).toBe(1);
  });

  it(`más de ${VIEW_BURST_LIMIT} vistas de la misma sesión en 10 minutos → bot`, async () => {
    const h = headers({ "user-agent": CHROME, "x-forwarded-for": "181.120.9.9" });
    const results = [];
    for (let i = 0; i < VIEW_BURST_LIMIT + 1; i += 1) {
      results.push(await recordListingEvent({ type: "view", listingId, headers: h }));
    }
    expect(results.slice(0, VIEW_BURST_LIMIT).every((r) => !r.isBot)).toBe(true);
    expect(results.at(-1)?.isBot).toBe(true);
  });

  it("nunca lanza: publicación inexistente (FK) → recorded false", async () => {
    const res = await recordListingEvent({ type: "view", listingId: 2_000_000_000, headers: headers({ "user-agent": CHROME }) });
    expect(res.recorded).toBe(false);
  });
});

describe("una vez por sesión y publicación cada 30 minutos", () => {
  it("dos clics de la misma persona suman 1; otra persona suma otro; pasada la ventana vuelve a sumar", async () => {
    const id = await fx.listing({ status: "published", publishedAt: OLD, dealerId }, { image: false });
    const click = (ip: string, now?: Date) =>
      recordListingEvent({ type: "whatsapp_click", listingId: id, dealerId, now, headers: headers({ "user-agent": CHROME, "x-forwarded-for": ip, referer: "https://moto.com.py/aviso/x" }) });
    const base = new Date();
    await click("181.120.5.5", base);
    await click("181.120.5.5", new Date(base.getTime() + 60_000));
    const [a] = await db.select().from(listings).where(eq(listings.id, id));
    expect(a.whatsappClickCount).toBe(1);
    await click("181.120.6.6", new Date(base.getTime() + 120_000));
    await click("181.120.5.5", new Date(base.getTime() + 35 * 60_000));
    const [b] = await db.select().from(listings).where(eq(listings.id, id));
    expect(b.whatsappClickCount).toBe(3);
    // Las filas se guardan todas (sirven para ajustar la heurística).
    expect(await db.select().from(listingEvents).where(eq(listingEvents.listingId, id))).toHaveLength(4);
  });
});
