// A4 contra MySQL real y un VenderCRM falso (src/lib/crm/testing):
// - TEST_PLAN.md §5 punto 6: CRM caído → gracias igual, lead `failed`, el
//   reintento lo recupera. Punto 7: utm de la cookie vc_attr llegan al CRM
//   aunque la conversión sea en otra página.
// - §2.9 punto 5 contra el falso: el mismo formulario dos veces → un contacto.
// - §3: el job de reintento respeta el backoff, se detiene a los 5, no duplica;
//   el índice único de idempotency_key rechaza el segundo insert limpio.
// - Cada código de §2.6, timeout y cuerpo mal formado.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { leadDeliveries, leads, listingEvents, listings } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import { startMockVenderCrm, type MockVenderCrm } from "@/lib/crm/testing/mock-vendercrm";
import { retryLeads } from "@/lib/cron/jobs/retry-leads";
import { leadIdempotencyKey } from "@/lib/hash";
import { deliverLead, dueLeads } from "./deliver";
import { handleLeadPost, resetLeadRateLimitForTests } from "./handler";

const CHROME =
  "Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const SITE = "https://moto.com.py";
const run = Date.now().toString(36);
const fx = await createFixtures(`a4ld${run}`);
// Celulares de prueba únicos por corrida: 0983 + 6 dígitos.
const phoneBase = 983_000_000 + (Date.now() % 1_000_000);
let phoneSeq = 0;
const nextPhone = () => {
  phoneSeq += 1;
  return `0${phoneBase + phoneSeq * 7}`;
};
const usedE164: string[] = [];

let crm: MockVenderCrm;
let listingId = 0;
let listingRef = "";
let dealerId = 0;
let tasks: Array<() => Promise<unknown>> = [];
const schedule = (t: () => Promise<unknown>) => void tasks.push(t);
async function flush() {
  const pending = tasks;
  tasks = [];
  for (const t of pending) await t();
}

function useCrm(on = true) {
  process.env.VENDERCRM_URL = on ? crm.url : "";
  process.env.VENDERCRM_API_KEY = on ? crm.apiKey : "";
}

function post(fields: Record<string, string>, opts: { json?: boolean; cookie?: string; origin?: string; referer?: string; ip?: string } = {}) {
  const json = opts.json ?? true;
  const headers: Record<string, string> = {
    "user-agent": CHROME,
    referer: opts.referer ?? `${SITE}/financiacion`,
    "x-forwarded-for": opts.ip ?? "181.120.0.1",
    origin: opts.origin ?? SITE,
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (json) {
    headers["content-type"] = "application/json";
    return handleLeadPost(new Request(`${SITE}/api/leads`, { method: "POST", headers, body: JSON.stringify(fields) }), schedule);
  }
  headers["content-type"] = "application/x-www-form-urlencoded";
  return handleLeadPost(
    new Request(`${SITE}/api/leads`, { method: "POST", headers, body: new URLSearchParams(fields).toString() }),
    schedule,
  );
}

function financing(phone: string, extra: Record<string, string> = {}) {
  usedE164.push(`+595${phone.slice(1)}`);
  return { tipo: "financing", telefono: phone, nombre: "[DEV] Juan Pérez", email: "", plazo_meses: "24", ...extra };
}

async function leadByPhone(phone: string) {
  const [row] = await db.select().from(leads).where(eq(leads.phoneE164, `+595${phone.slice(1)}`));
  return row;
}
async function deliveries(leadId: number) {
  return db.select().from(leadDeliveries).where(eq(leadDeliveries.leadId, leadId)).orderBy(leadDeliveries.attemptNo);
}
/** Corre el reloj del lead hacia atrás, como si hubiera pasado `ms`. */
async function age(leadId: number, ms: number) {
  const s = Math.round(ms / 1000);
  await db.update(leads).set({ createdAt: sql`${leads.createdAt} - INTERVAL ${s} SECOND` }).where(eq(leads.id, leadId));
  await db
    .update(leadDeliveries)
    .set({ createdAt: sql`${leadDeliveries.createdAt} - INTERVAL ${s} SECOND` })
    .where(eq(leadDeliveries.leadId, leadId));
}

async function cleanupLeads() {
  const rows = await db.select({ id: leads.id }).from(leads).where(like(leads.name, "[DEV]%"));
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await db.delete(leadDeliveries).where(inArray(leadDeliveries.leadId, ids));
    await db.delete(leads).where(inArray(leads.id, ids));
  }
}

beforeAll(async () => {
  crm = await startMockVenderCrm();
  process.env.IP_HASH_SALT ||= "sal-de-prueba-integracion";
  process.env.SITE_URL = SITE;
  await cleanupLeads();
  dealerId = await fx.dealer();
  listingId = await fx.listing({ status: "published", publishedAt: new Date(), dealerId, year: 2022 }, { image: false });
  const [row] = await db.select({ ref: listings.publicRef }).from(listings).where(eq(listings.id, listingId));
  listingRef = row.ref;
});

beforeEach(() => {
  crm.reset();
  tasks = [];
  resetLeadRateLimitForTests();
  useCrm(true);
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await cleanupLeads();
  await db.delete(listingEvents).where(inArray(listingEvents.listingId, fx.ids.listings));
  await fx.cleanup();
  await crm.close();
  await closeDb();
});

describe("POST /api/leads → base → CRM", () => {
  it("round-trip: se guarda primero, responde, y después llega al CRM con el payload del contrato", async () => {
    const phone = nextPhone();
    const cookie = `vc_attr=${encodeURIComponent(
      JSON.stringify({ utm_source: "facebook", utm_medium: "cpc", utm_campaign: "cuotas", fbclid: "fb-1", referrer: "https://l.facebook.com/" }),
    )}`;
    const res = await post(
      financing(phone, { aviso: listingRef.toLowerCase(), entrega_gs: "2.000.000", situacion_laboral: "independiente", pagina: "/aviso/x" }),
      { cookie, referer: `${SITE}/aviso/x` },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });

    // Guardado antes de tocar el CRM: todavía pending y el CRM sin pedidos.
    const saved = await leadByPhone(phone);
    expect(saved).toMatchObject({
      type: "financing",
      crmStatus: "pending",
      crmAttempts: 0,
      listingId,
      dealerId,
      utmSource: "facebook",
      utmCampaign: "cuotas",
      fbclid: "fb-1",
      pageUrl: `${SITE}/aviso/x`,
      idempotencyKey: leadIdempotencyKey(saved.phoneE164, "financing", saved.createdAt),
    });
    expect(saved.payloadJson).toMatchObject({ consent_text_version: "financiacion-2026-09-22", listing_ref: listingRef });
    expect(crm.requests).toHaveLength(0);
    const [ev] = await db
      .select()
      .from(listingEvents)
      .where(and(eq(listingEvents.listingId, listingId), eq(listingEvents.eventType, "lead_submit")));
    expect(ev).toMatchObject({ isBot: false, pageUrl: "/aviso/x" });

    await flush();
    expect(crm.requests).toHaveLength(1);
    const sent = crm.requests[0];
    expect(sent.apiKey).toBe(crm.apiKey);
    expect(sent.contentType).toContain("application/json");
    expect(sent.body).toMatchObject({
      phone: saved.phoneE164,
      idempotency_key: saved.idempotencyKey,
      name: "[DEV] Juan Pérez",
      source: "site:moto-com-py",
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: "cuotas",
      fbclid: "fb-1",
      referrer: "https://l.facebook.com/",
      page_url: `${SITE}/aviso/x`,
      message: `Consulta de financiación desde la publicación ${listingRef}`,
      fields: {
        tipo_lead: "financiacion",
        listing_ref: listingRef,
        anio: 2022,
        precio_gs: 12_500_000,
        entrega_disponible_gs: 2_000_000,
        plazo_deseado_meses: 24,
        situacion_laboral: "independiente",
      },
    });
    for (const k of ["pipeline", "stage", "owner", "tag", "email"]) expect(sent.body).not.toHaveProperty(k);

    const after = await leadByPhone(phone);
    expect(after).toMatchObject({ crmStatus: "sent", crmAttempts: 1, crmContactId: "c_1", crmDealId: "d_1", crmLastError: null });
    const [d] = await deliveries(after.id);
    expect(d).toMatchObject({ attemptNo: 1, httpStatus: 201 });
    expect(d.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("el mismo formulario dos veces seguidas → un solo lead y un solo contacto en el CRM", async () => {
    const phone = nextPhone();
    const first = await post(financing(phone));
    const second = await post(financing(phone));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(tasks).toHaveLength(1); // el duplicado no vuelve a mandar
    await flush();
    const rows = await db.select().from(leads).where(eq(leads.phoneE164, `+595${phone.slice(1)}`));
    expect(rows).toHaveLength(1);
    expect(crm.created.size).toBe(1);
  });

  it("financiación y seguro de la misma persona en la misma hora → dos leads (ADR-25)", async () => {
    const phone = nextPhone();
    await post(financing(phone));
    await post({ tipo: "insurance", telefono: phone, nombre: "[DEV] Seguro" });
    const rows = await db.select().from(leads).where(eq(leads.phoneE164, `+595${phone.slice(1)}`));
    expect(rows.map((r) => r.type).sort()).toEqual(["financing", "insurance"]);
  });

  it("índice único: un segundo insert con la misma idempotency_key falla limpio", async () => {
    const phone = nextPhone();
    await post(financing(phone));
    const row = await leadByPhone(phone);
    await expect(
      db.insert(leads).values({ type: "financing", phoneE164: row.phoneE164, phoneRaw: "x", idempotencyKey: row.idempotencyKey, name: "[DEV] dup" }),
    ).rejects.toMatchObject({ cause: { code: "ER_DUP_ENTRY" } });
  });

  it("honeypot lleno → gracias (303), ninguna fila, nada al CRM", async () => {
    const phone = nextPhone();
    const res = await post(financing(phone, { website: "http://spam.example" }), { json: false });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${SITE}/gracias?tipo=financiacion`);
    expect(await leadByPhone(phone)).toBeUndefined();
    expect(tasks).toHaveLength(0);
  });

  it("formulario sin JS: éxito → 303 a gracias; error → 303 de vuelta con ?error=campo", async () => {
    const ok = await post(financing(nextPhone()), { json: false });
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe(`${SITE}/gracias?tipo=financiacion`);
    const bad = await post({ tipo: "financing", telefono: "12", pagina: "/aviso/y" }, { json: false });
    expect(bad.status).toBe(303);
    expect(bad.headers.get("location")).toBe(`${SITE}/aviso/y?error=telefono`);
  });

  it("JSON inválido → 422 con errores por campo; Origin ajeno → 403", async () => {
    const bad = await post({ tipo: "financing", telefono: "" });
    expect(bad.status).toBe(422);
    expect(await bad.json()).toEqual({ ok: false, errors: { telefono: "Escribí tu número de teléfono." } });
    const foreign = await post(financing(nextPhone()), { origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
  });

  it("límite por IP: la 11ª consulta en 10 min → 429", async () => {
    for (let i = 0; i < 10; i += 1) expect((await post(financing(nextPhone()), { ip: "181.9.9.9" })).status).toBe(200);
    const res = await post(financing(nextPhone()), { ip: "181.9.9.9" });
    expect(res.status).toBe(429);
  });

  it("sin VENDERCRM_URL/key: lead guardado en pending, log estructurado, el visitante ve éxito", async () => {
    useCrm(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const phone = nextPhone();
    const res = await post(financing(phone));
    expect(res.status).toBe(200);
    await flush();
    const row = await leadByPhone(phone);
    expect(row).toMatchObject({ crmStatus: "pending", crmAttempts: 0 });
    expect(await deliveries(row.id)).toHaveLength(0);
    expect(crm.requests).toHaveLength(0);
    const line = warn.mock.calls.map((c) => String(c[0])).find((l) => l.includes("pending"));
    expect(JSON.parse(line!)).toMatchObject({ level: "warn", leadId: row.id });
    expect(line).not.toContain(row.phoneE164);

    // El job tampoco hace nada sin configuración…
    await age(row.id, 2 * 60_000);
    expect(await retryLeads({ now: new Date(), runId: 0 })).toMatchObject({ skipped: "crm_not_configured" });
    // …y cuando la configuración aparece, lo manda.
    useCrm(true);
    await retryLeads({ now: new Date(), runId: 0 });
    expect(await leadByPhone(phone)).toMatchObject({ crmStatus: "sent", crmAttempts: 1 });
  });
});

describe("CRM caído y cada respuesta de §2.6", () => {
  it("URL inválida (CRM caído) → gracias igual, `failed`; el reintento lo recupera", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.VENDERCRM_URL = "http://127.0.0.1:9"; // nadie escucha
    const phone = nextPhone();
    const res = await post(financing(phone), { json: false });
    expect(res.headers.get("location")).toBe(`${SITE}/gracias?tipo=financiacion`);
    await flush();
    const failed = await leadByPhone(phone);
    expect(failed).toMatchObject({ crmStatus: "failed", crmAttempts: 1 });
    expect(failed.crmLastError).toMatch(/^red:/);
    expect((await deliveries(failed.id))[0]).toMatchObject({ attemptNo: 1, httpStatus: null });

    useCrm(true);
    // Antes del minuto de backoff no se reintenta.
    expect((await dueLeads(new Date(), 100)).map((l) => l.id)).not.toContain(failed.id);
    await age(failed.id, 2 * 60_000);
    expect((await dueLeads(new Date(), 100)).map((l) => l.id)).toContain(failed.id);
    const detail = await retryLeads({ now: new Date(), runId: 0 });
    expect(detail.sent).toBeGreaterThanOrEqual(1);
    const recovered = await leadByPhone(phone);
    expect(recovered).toMatchObject({ crmStatus: "sent", crmAttempts: 2, crmLastError: null });
    expect((await deliveries(recovered.id)).map((d) => d.httpStatus)).toEqual([null, 201]);
  });

  it.each([
    [401, "VENDERCRM_API_KEY"],
    [403, "Sitios"],
    [429, "429"],
    [500, "500"],
  ])("%i → failed con el motivo", async (status, hint) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    crm.enqueue({ status, body: { error: "x" } });
    const phone = nextPhone();
    await post(financing(phone));
    await flush();
    const row = await leadByPhone(phone);
    expect(row.crmStatus).toBe("failed");
    expect(row.crmLastError).toContain(hint);
    expect((await deliveries(row.id))[0].httpStatus).toBe(status);
  });

  it("422 → failed y se guarda el cuerpo entero", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const body = { error: "validation", field: "phone", message: "requerido" };
    crm.enqueue({ status: 422, body });
    const phone = nextPhone();
    await post(financing(phone));
    await flush();
    const row = await leadByPhone(phone);
    expect(row.crmLastError).toBe(`422: ${JSON.stringify(body)}`);
    expect((await deliveries(row.id))[0].responseBody).toBe(JSON.stringify(body));
  });

  it("200 duplicate:true → duplicate (éxito); 200 mal formado → failed y el reintento da duplicate", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    crm.enqueue({ status: 200, body: { contactId: "c_x", dealId: "d_x", duplicate: true } });
    const a = nextPhone();
    await post(financing(a));
    await flush();
    expect(await leadByPhone(a)).toMatchObject({ crmStatus: "duplicate", crmContactId: "c_x" });

    // Proxy que contesta HTML con 200: no se cree que llegó. El CRM real sí lo
    // había creado (lo simulamos creándolo antes), así que el reintento da duplicate.
    const b = nextPhone();
    crm.enqueue({ status: 200, rawBody: "<html>ok</html>" });
    await post(financing(b));
    await flush();
    const row = await leadByPhone(b);
    expect(row.crmStatus).toBe("failed");
    crm.created.set(row.idempotencyKey, { contactId: "c_prev", dealId: "d_prev", submissionId: "s_prev" });
    await age(row.id, 2 * 60_000);
    await deliverLead(row.id);
    expect(await leadByPhone(b)).toMatchObject({ crmStatus: "duplicate", crmAttempts: 2, crmContactId: "c_prev" });
  });

  it("timeout (> 10 s del cliente, acá con timeout corto) → failed, sin respuesta HTTP", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    useCrm(false); // que el envío inmediato no corra: lo llamamos a mano con timeout corto
    const phone = nextPhone();
    await post(financing(phone));
    await flush();
    const row = await leadByPhone(phone);
    crm.enqueue({ status: 201, body: { contactId: "tarde" }, delayMs: 500 });
    const res = await deliverLead(row.id, { config: { url: crm.url, apiKey: crm.apiKey }, timeoutMs: 100 });
    expect(res).toMatchObject({ status: "failed", httpStatus: null });
    const after = await leadByPhone(phone);
    expect(after.crmLastError).toMatch(/^timeout:/);
  });
});

describe("job retry-leads", () => {
  it("se detiene a los 5 intentos y no vuelve a tocar el lead", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const phone = nextPhone();
    crm.enqueue({ status: 500 });
    await post(financing(phone));
    await flush();
    const row = await leadByPhone(phone);
    for (let attempt = 2; attempt <= 5; attempt += 1) {
      crm.enqueue({ status: 500 });
      await age(row.id, 13 * 3_600_000);
      await retryLeads({ now: new Date(), runId: 0 });
    }
    expect(await leadByPhone(phone)).toMatchObject({ crmStatus: "failed", crmAttempts: 5 });
    expect(await deliveries(row.id)).toHaveLength(5);
    await age(row.id, 48 * 3_600_000);
    const before = crm.requests.length;
    await retryLeads({ now: new Date(), runId: 0 });
    expect(crm.requests.length).toBe(before);
    expect(await deliverLead(row.id)).toMatchObject({ status: "skipped", reason: "not_eligible" });
  });

  it("dos envíos simultáneos del mismo lead → un solo intento (reclamo atómico)", async () => {
    useCrm(false);
    const phone = nextPhone();
    await post(financing(phone));
    await flush();
    const row = await leadByPhone(phone);
    const config = { url: crm.url, apiKey: crm.apiKey };
    crm.enqueue({ status: 201, body: { contactId: "c_once", dealId: "d_once" }, delayMs: 100 });
    const results = await Promise.all([deliverLead(row.id, { config }), deliverLead(row.id, { config })]);
    expect(results.map((r) => r.status).sort()).toEqual(["sent", "skipped"]);
    expect(crm.requests).toHaveLength(1);
    expect(await deliveries(row.id)).toHaveLength(1);
  });

  it("reclamo huérfano (proceso muerto a mitad del POST): se retoma después de 15 min", async () => {
    useCrm(false);
    const phone = nextPhone();
    await post(financing(phone));
    await flush();
    const row = await leadByPhone(phone);
    // Intento 1 reclamado, sin fila de lead_deliveries: parece en vuelo.
    await db.update(leads).set({ crmAttempts: 1 }).where(eq(leads.id, row.id));
    const config = { url: crm.url, apiKey: crm.apiKey };
    expect(await deliverLead(row.id, { config })).toMatchObject({ status: "skipped", reason: "claimed_elsewhere" });
    await db.update(leads).set({ updatedAt: sql`${leads.updatedAt} - INTERVAL 16 MINUTE` }).where(eq(leads.id, row.id));
    expect(await deliverLead(row.id, { config })).toMatchObject({ status: "sent", attemptNo: 2 });
  });

  it("un lead ya enviado o marcado spam no se reintenta", async () => {
    const phone = nextPhone();
    await post(financing(phone));
    await flush();
    const row = await leadByPhone(phone);
    await age(row.id, 13 * 3_600_000);
    expect((await dueLeads(new Date(), 500)).map((l) => l.id)).not.toContain(row.id);
    await db.update(leads).set({ crmStatus: "failed", isSpam: true }).where(eq(leads.id, row.id));
    expect((await dueLeads(new Date(), 500)).map((l) => l.id)).not.toContain(row.id);
  });
});
