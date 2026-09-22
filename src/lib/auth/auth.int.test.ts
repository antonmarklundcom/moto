import { eq, inArray, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { authAttempts, listings, users } from "@/db/schema";
import { transition, type TransitionAction } from "@/lib/listings/state";
import { activityFor, createFixtures, sessionCookieFor, TEST_PASSWORD } from "./int-fixtures";
import { attemptKeys, LOCKOUT_WINDOW_MS } from "./lockout";
import { authenticate } from "./login";
import { withRole } from "./session";
import { createPanelUser, loadSessionUser } from "./users";

// TEST_PLAN.md §9: fuerza bruta → bloqueo tras 5 intentos; sin sesión → 401;
// mutación con rol insuficiente → 403 aunque se llame directo al endpoint.
const TAG = `a1auth${Date.now()}`;
const SALT = process.env.IP_HASH_SALT ?? "sal-de-prueba";
let fx: Awaited<ReturnType<typeof createFixtures>>;
const hashes: string[] = [];
let n = 0;
const ip = () => `ip-${TAG}-${++n}`;

function track(email: string, addr: string | null) {
  const k = attemptKeys(email, addr, SALT);
  if (k.emailHash) hashes.push(k.emailHash);
  if (k.ipHash) hashes.push(k.ipHash);
}

async function login(email: string, password: string, addr: string | null, now?: Date) {
  track(email, addr);
  return authenticate({ email, password, ip: addr, salt: SALT, now });
}

beforeAll(async () => {
  fx = await createFixtures(TAG);
});

afterAll(async () => {
  if (hashes.length) {
    await db.delete(authAttempts).where(or(inArray(authAttempts.emailHash, hashes), inArray(authAttempts.ipHash, hashes)));
  }
  await fx.cleanup();
  await db.delete(users).where(eq(users.email, `${TAG}-script@example.com`));
  await closeDb();
});

describe("login y bloqueo (ADMIN_SPEC.md §1)", () => {
  it("credenciales correctas → ok y last_login_at; email en otra caja también", async () => {
    const admin = await fx.user("admin");
    const res = await login(admin.email.toUpperCase(), TEST_PASSWORD, ip());
    expect(res).toEqual({ ok: true, userId: admin.id });
    const [row] = await db.select({ at: users.lastLoginAt }).from(users).where(eq(users.id, admin.id));
    expect(row.at).not.toBeNull();
  });

  it("contraseña mala, email inexistente, usuario inactivo o seller → invalid", async () => {
    const admin = await fx.user("admin");
    const inactive = await fx.user("moderator", { isActive: false });
    const seller = await fx.user("seller");
    expect(await login(admin.email, "incorrecta-larga", ip())).toEqual({ ok: false, reason: "invalid" });
    expect(await login(`nadie-${TAG}@example.com`, TEST_PASSWORD, ip())).toEqual({ ok: false, reason: "invalid" });
    expect(await login(inactive.email, TEST_PASSWORD, ip())).toEqual({ ok: false, reason: "invalid" });
    expect(await login(seller.email, TEST_PASSWORD, ip())).toEqual({ ok: false, reason: "invalid" });
  });

  it("5 fallos por cuenta → bloqueada, aun con la contraseña correcta y desde otra IP; se libera al pasar la ventana", async () => {
    const admin = await fx.user("admin");
    const t0 = new Date(Date.now() - 1000);
    for (let i = 0; i < 5; i++) {
      expect(await login(admin.email, `mala-${i}-larga`, ip(), t0)).toMatchObject({ reason: "invalid" });
    }
    expect(await login(admin.email, TEST_PASSWORD, ip())).toEqual({ ok: false, reason: "locked" });
    const later = new Date(t0.getTime() + LOCKOUT_WINDOW_MS + 60_000);
    expect(await login(admin.email, TEST_PASSWORD, ip(), later)).toEqual({ ok: true, userId: admin.id });
  });

  it("5 fallos desde una IP → esa IP bloqueada para cualquier cuenta", async () => {
    const admin = await fx.user("admin");
    const addr = ip();
    for (let i = 0; i < 5; i++) {
      await login(`otro-${i}-${TAG}@example.com`, "mala-clave-larga", addr);
    }
    expect(await login(admin.email, TEST_PASSWORD, addr)).toEqual({ ok: false, reason: "locked" });
    expect(await login(admin.email, TEST_PASSWORD, ip())).toEqual({ ok: true, userId: admin.id });
  });

  it("un login correcto reinicia el contador de la cuenta", async () => {
    const admin = await fx.user("admin");
    for (let i = 0; i < 4; i++) await login(admin.email, "mala-clave-larga", ip());
    expect(await login(admin.email, TEST_PASSWORD, ip())).toMatchObject({ ok: true });
    for (let i = 0; i < 4; i++) await login(admin.email, "mala-clave-larga", ip());
    expect(await login(admin.email, TEST_PASSWORD, ip())).toMatchObject({ ok: true });
  });

  it("auth_attempts no guarda email ni IP en claro", async () => {
    const addr = ip();
    await login(`claro-${TAG}@example.com`, "mala-clave-larga", addr);
    const k = attemptKeys(`claro-${TAG}@example.com`, addr, SALT);
    const [row] = await db.select().from(authAttempts).where(eq(authAttempts.ipHash, k.ipHash!));
    expect(row.emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(addr);
    expect(JSON.stringify(row)).not.toContain("claro-");
  });
});

describe("loadSessionUser y createPanelUser", () => {
  it("usuario desactivado o borrado → sin sesión", async () => {
    const mod = await fx.user("moderator");
    expect(await loadSessionUser(mod.id)).toMatchObject({ id: mod.id, role: "moderator" });
    await db.update(users).set({ isActive: false }).where(eq(users.id, mod.id));
    expect(await loadSessionUser(mod.id)).toBeNull();
    const other = await fx.user("admin");
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, other.id));
    expect(await loadSessionUser(other.id)).toBeNull();
  });

  it("alta por script: bcrypt 12, no duplica, --reset cambia la contraseña", async () => {
    const email = `${TAG}-script@example.com`;
    const first = await createPanelUser({ email, name: "Script", password: "primera-clave-larga", role: "admin" });
    expect(first.created).toBe(true);
    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, first.id));
    expect(row.hash).toMatch(/^\$2[aby]\$12\$/);
    await expect(createPanelUser({ email, name: "Script", password: "segunda-clave-larga", role: "admin" })).rejects.toThrow(
      /Ya existe/,
    );
    const again = await createPanelUser({
      email,
      name: "Script",
      password: "segunda-clave-larga",
      role: "moderator",
      resetIfExists: true,
    });
    expect(again).toEqual({ id: first.id, created: false });
    expect(await login(email, "segunda-clave-larga", ip())).toEqual({ ok: true, userId: first.id });
  });
});

describe("POST directo a una mutación (CLAUDE.md §3.3, TEST_PLAN.md §9)", () => {
  // Un route handler de mutación como los que escriben las fases de lane 2:
  // withRole + transition(). La interfaz no participa: se postea a mano.
  const POST = withRole(["admin", "moderator", "dealer"], async (user, request: Request) => {
    const body = (await request.json()) as { listingId: number; action: TransitionAction };
    const result = await transition({ listingId: body.listingId, action: body.action, actor: { kind: "user", user } });
    return Response.json(result);
  });

  async function post(cookie: string | null, listingId: number, action: TransitionAction) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (cookie) headers.cookie = cookie;
    return POST(
      new Request("http://localhost/api/admin/listings/transition", {
        method: "POST",
        headers,
        body: JSON.stringify({ listingId, action }),
      }),
      undefined,
    );
  }

  async function status(id: number) {
    const [row] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, id));
    return row.status;
  }

  it("sin sesión o con cookie adulterada → 401 y nada cambia", async () => {
    const id = await fx.listing({ status: "pending_review" });
    expect((await post(null, id, "approve")).status).toBe(401);
    expect((await post("moto_admin=basura", id, "approve")).status).toBe(401);
    expect(await status(id)).toBe("pending_review");
  });

  it("rol fuera de la lista (seller) → 401: no tiene sesión de panel", async () => {
    const seller = await fx.user("seller");
    const id = await fx.listing({ status: "published", ownerUserId: seller.id });
    expect((await post(await sessionCookieFor(seller.id), id, "pause")).status).toBe(401);
    expect(await status(id)).toBe("published");
  });

  it("dealer aprobando su propia publicación sin auto_approve → 403", async () => {
    const dealerId = await fx.dealer({ autoApprove: false });
    const dealer = await fx.user("dealer", { dealerId });
    const id = await fx.listing({ status: "pending_review", dealerId });
    expect((await post(await sessionCookieFor(dealer.id), id, "approve")).status).toBe(403);
    expect(await status(id)).toBe("pending_review");
    expect(await activityFor(id)).toHaveLength(0);
  });

  it("dealer pausando una publicación de otro comercio → 403", async () => {
    const mine = await fx.dealer();
    const theirs = await fx.dealer();
    const dealer = await fx.user("dealer", { dealerId: mine });
    const id = await fx.listing({ status: "published", dealerId: theirs });
    expect((await post(await sessionCookieFor(dealer.id), id, "pause")).status).toBe(403);
    expect(await status(id)).toBe("published");
  });

  it("dealer pausando una de particular → 403", async () => {
    const dealer = await fx.user("dealer", { dealerId: await fx.dealer() });
    const id = await fx.listing({ status: "published" });
    expect((await post(await sessionCookieFor(dealer.id), id, "pause")).status).toBe(403);
  });

  it("moderador enviando un borrador (no está en la matriz) → 403", async () => {
    const mod = await fx.user("moderator");
    const id = await fx.listing({ status: "draft" });
    expect((await post(await sessionCookieFor(mod.id), id, "submit")).status).toBe(403);
    expect(await status(id)).toBe("draft");
  });

  it("moderador intentando vencer (sólo el sistema) → 403", async () => {
    const mod = await fx.user("moderator");
    const id = await fx.listing({ status: "published" });
    expect((await post(await sessionCookieFor(mod.id), id, "expire")).status).toBe(403);
  });

  it("usuario desactivado con cookie todavía válida → 401", async () => {
    const admin = await fx.user("admin", { isActive: false });
    const id = await fx.listing({ status: "pending_review" });
    expect((await post(await sessionCookieFor(admin.id), id, "approve")).status).toBe(401);
  });

  it("dealer con su propia publicación publicada → 200 (la rama dealer funciona)", async () => {
    const dealerId = await fx.dealer();
    const dealer = await fx.user("dealer", { dealerId });
    const id = await fx.listing({ status: "published", dealerId });
    const res = await post(await sessionCookieFor(dealer.id), id, "pause");
    expect(res.status).toBe(200);
    expect(await status(id)).toBe("paused");
  });

  it("admin aprobando → 200 y activity_log", async () => {
    const admin = await fx.user("admin");
    const id = await fx.listing({ status: "pending_review" });
    const res = await post(await sessionCookieFor(admin.id), id, "approve");
    expect(res.status).toBe(200);
    expect(await status(id)).toBe("published");
    const log = await activityFor(id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "approved", userId: admin.id });
  });
});
