// /ir/wa/* (T-105, ADR-07) y POST /api/telefono/<ref> contra MySQL real.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { dealers, listingEvents, listings } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { resetViewBurstsForTests } from "@/lib/events";
import { PHONE_REVEAL_LIMIT, handlePhoneReveal, resetPhoneRevealLimitForTests } from "./phone-reveal";
import { WA_REDIRECT_LIMIT, handleWhatsAppRedirect, resetWaRedirectLimiterForTests } from "./redirect";

const CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const SITE = "https://moto.com.py";
const fx = await createFixtures(`a4wa${Date.now().toString(36)}`);
const ids = { live: 0, callsOnly: 0, paused: 0, landline: 0, financing: 0, dealer: 0, prospect: 0 };
const refs: Record<string, string> = {};

function get(path: string, h: Record<string, string> = {}) {
  const url = `${SITE}${path}`;
  const segments = new URL(url).pathname.split("/").slice(3);
  return handleWhatsAppRedirect(segments, new Request(url, { headers: { "user-agent": CHROME, referer: `${SITE}/aviso/algo?x=1`, ...h } }));
}
function reveal(ref: string, h: Record<string, string> = {}) {
  return handlePhoneReveal(
    ref,
    new Request(`${SITE}/api/telefono/${ref}`, {
      method: "POST",
      headers: { "user-agent": CHROME, referer: `${SITE}/aviso/algo`, origin: SITE, "x-forwarded-for": "181.1.1.1", ...h },
    }),
  );
}
async function eventsFor(listingId: number, type: "whatsapp_click" | "phone_reveal") {
  return db
    .select()
    .from(listingEvents)
    .where(and(eq(listingEvents.listingId, listingId), eq(listingEvents.eventType, type)));
}

beforeAll(async () => {
  process.env.IP_HASH_SALT ||= "sal-de-prueba-integracion";
  process.env.SITE_URL = SITE;
  process.env.WHATSAPP_SITE_NUMBER = "+595991000111";
  ids.dealer = await fx.dealer();
  await db.update(dealers).set({ status: "active", phoneE164: "+595982555666" }).where(eq(dealers.id, ids.dealer));
  ids.prospect = await fx.dealer();
  const now = new Date();
  ids.live = await fx.listing({ status: "published", publishedAt: now, dealerId: ids.dealer, title: "[DEV] Honda CG 150 Titan 2022" }, { image: false });
  ids.callsOnly = await fx.listing({ status: "published", publishedAt: now, contactWhatsapp: false }, { image: false });
  ids.paused = await fx.listing({ status: "paused", publishedAt: now }, { image: false });
  ids.landline = await fx.listing(
    { status: "published", publishedAt: now, contactPhoneE164: "+59521123456", contactPhoneRaw: "021 123 456", contactWhatsapp: true },
    { image: false },
  );
  ids.financing = await fx.listing(
    { status: "published", publishedAt: now, priceGs: null, hasFinancingOnly: true, downPaymentGs: 2_000_000, installmentGs: 650_000, installmentCount: 24 },
    { image: false },
  );
  const rows = await db.select({ id: listings.id, ref: listings.publicRef }).from(listings).where(inArray(listings.id, fx.ids.listings));
  for (const r of rows) refs[r.id] = r.ref;
});

beforeEach(() => {
  resetViewBurstsForTests();
  resetPhoneRevealLimitForTests();
});

afterAll(async () => {
  await db.delete(listingEvents).where(inArray(listingEvents.listingId, fx.ids.listings));
  await db.delete(listingEvents).where(inArray(listingEvents.dealerId, fx.ids.dealers));
  await fx.cleanup();
  await closeDb();
});

describe("/ir/wa/<listingId>", () => {
  it("302 a wa.me con el mensaje de §1.2, no-store, evento whatsapp_click y +1", async () => {
    const res = await get(`/ir/wa/${ids.live}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://wa.me/595981123456");
    const [slugRow] = await db.select({ slug: listings.slug }).from(listings).where(eq(listings.id, ids.live));
    expect(location.searchParams.get("text")).toBe(
      `Hola, vi esta moto en moto.com.py:\n[DEV] Honda CG 150 Titan 2022 — Gs. 12.500.000\n${SITE}/aviso/${slugRow.slug}-${refs[ids.live].toLowerCase()}\n¿Sigue disponible?`,
    );
    const [ev] = await eventsFor(ids.live, "whatsapp_click");
    expect(ev).toMatchObject({ dealerId: ids.dealer, isBot: false, pageUrl: "/aviso/algo" });
    const [row] = await db.select({ n: listings.whatsappClickCount }).from(listings).where(eq(listings.id, ids.live));
    expect(row.n).toBe(1); // una sola vez (events.ts ya suma; /ir/wa no vuelve a sumar)
  });

  it("sin Referer propio → se redirige igual, evento marcado bot, sin sumar", async () => {
    const res = await get(`/ir/wa/${ids.live}`, { referer: "" });
    expect(res.status).toBe(302);
    const evs = await eventsFor(ids.live, "whatsapp_click");
    expect(evs.at(-1)?.isBot).toBe(true);
    const [row] = await db.select({ n: listings.whatsappClickCount }).from(listings).where(eq(listings.id, ids.live));
    expect(row.n).toBe(1);
  });

  it("sólo financiación → mensaje con entrega + cuotas", async () => {
    const res = await get(`/ir/wa/${ids.financing}`);
    const text = new URL(res.headers.get("location")!).searchParams.get("text")!;
    expect(text).toContain(" — Entrega Gs. 2.000.000 + 24 cuotas de Gs. 650.000\n");
  });

  it("contact_whatsapp=false, pausada, fijo, inexistente o ruta rara → 404 y ningún evento", async () => {
    for (const path of [
      `/ir/wa/${ids.callsOnly}`,
      `/ir/wa/${ids.paused}`,
      `/ir/wa/${ids.landline}`,
      "/ir/wa/999999999999",
      "/ir/wa/0",
      "/ir/wa/abc",
      "/ir/wa/1/2",
      "/ir/wa/comercio/x",
    ]) {
      const res = await get(path);
      expect(res.status, path).toBe(404);
      expect(res.headers.get("location")).toBeNull();
    }
    for (const id of [ids.callsOnly, ids.paused, ids.landline]) expect(await eventsFor(id, "whatsapp_click")).toHaveLength(0);
  });
});

describe("/ir/wa/comercio y /ir/wa/general", () => {
  it("comercio activo → 302 con su número y evento con dealer_id; comercio no activo → 404", async () => {
    const res = await get(`/ir/wa/comercio/${ids.dealer}`);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/595982555666");
    expect(location.searchParams.get("text")).toContain(`${SITE}/comercios/`);
    const [ev] = await db
      .select()
      .from(listingEvents)
      .where(and(eq(listingEvents.dealerId, ids.dealer), eq(listingEvents.eventType, "whatsapp_click"), isNull(listingEvents.listingId)));
    expect(ev).toBeDefined();
    expect((await get(`/ir/wa/comercio/${ids.prospect}`)).status).toBe(404);
  });

  it("general → WHATSAPP_SITE_NUMBER con la búsqueda precargada; sin número → 404", async () => {
    const res = await get("/ir/wa/general?texto=Honda%20Biz%20en%20Luque");
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/595991000111");
    expect(location.searchParams.get("text")).toBe("Hola, les escribo desde moto.com.py.\nBusco: Honda Biz en Luque");
    const saved = process.env.WHATSAPP_SITE_NUMBER;
    process.env.WHATSAPP_SITE_NUMBER = "";
    const origError = console.error;
    console.error = () => {};
    try {
      expect((await get("/ir/wa/general")).status).toBe(404);
    } finally {
      console.error = origError;
      process.env.WHATSAPP_SITE_NUMBER = saved;
    }
  });
});

describe("POST /api/telefono/<ref>", () => {
  it("devuelve el número en formato visible y registra phone_reveal", async () => {
    const res = await reveal(refs[ids.callsOnly].toLowerCase());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ telefono: "0981 123 456", href: "tel:+595981123456" });
    const [ev] = await eventsFor(ids.callsOnly, "phone_reveal");
    expect(ev).toMatchObject({ isBot: false, pageUrl: "/aviso/algo" });
  });

  it("pausada, ref inválido o inexistente → 404; Origin ajeno → 403", async () => {
    expect((await reveal(refs[ids.paused])).status).toBe(404);
    expect((await reveal("no-es-ref")).status).toBe(404);
    expect((await reveal("ZZZZZZZZ")).status).toBe(404);
    expect((await reveal(refs[ids.live], { origin: "https://evil.example" })).status).toBe(403);
  });

  it(`límite por IP: más de ${PHONE_REVEAL_LIMIT} en 10 min → 429 con Retry-After`, async () => {
    for (let i = 0; i < PHONE_REVEAL_LIMIT; i += 1) expect((await reveal(refs[ids.live], { "x-forwarded-for": "181.7.7.7" })).status).toBe(200);
    const res = await reveal(refs[ids.live], { "x-forwarded-for": "181.7.7.7" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await reveal(refs[ids.live], { "x-forwarded-for": "181.7.7.8" })).status).toBe(200);
  });
});

describe("/ir/wa: tope por IP contra la cosecha de teléfonos", () => {
  it(`${WA_REDIRECT_LIMIT} por IP en 10 min; después 429 sin número; otra IP sigue`, async () => {
    resetWaRedirectLimiterForTests();
    const h = { "x-forwarded-for": "181.9.9.9" };
    for (let i = 0; i < WA_REDIRECT_LIMIT; i += 1) expect((await get(`/ir/wa/${ids.live}`, h)).status).toBe(302);
    const blocked = await get(`/ir/wa/${ids.live}`, h);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("location")).toBeNull();
    expect((await get(`/ir/wa/${ids.live}`, { "x-forwarded-for": "181.9.9.8" })).status).toBe(302);
    resetWaRedirectLimiterForTests();
  });
});
