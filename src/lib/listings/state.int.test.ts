import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { listings } from "@/db/schema";
import { activityFor, createFixtures } from "@/lib/auth/int-fixtures";
import { addDays, transition, TransitionError, TransitionForbiddenError } from "./state";

const TAG = `a1state${Date.now()}`;
let fx: Awaited<ReturnType<typeof createFixtures>>;

beforeAll(async () => {
  fx = await createFixtures(TAG);
});
afterAll(async () => {
  await fx.cleanup();
  await closeDb();
});

async function row(id: number) {
  const [r] = await db.select().from(listings).where(eq(listings.id, id));
  return r;
}

describe("transition() contra MySQL", () => {
  it("aprobar: published_at, expires_at con el TTL del comercio y activity_log en la misma transacción", async () => {
    const dealerId = await fx.dealer({ ttlDays: 30 });
    const admin = await fx.user("admin");
    const id = await fx.listing({ status: "pending_review", dealerId, rejectionReasonCode: "viejo" });
    const now = new Date("2026-09-22T12:00:00Z");
    const res = await transition({ listingId: id, action: "approve", actor: { kind: "user", user: admin, ipHash: "a".repeat(64) }, now });
    expect(res).toEqual({ listingId: id, from: "pending_review", to: "published", action: "approve" });
    const r = await row(id);
    expect(r.status).toBe("published");
    expect(r.publishedAt?.toISOString()).toBe(now.toISOString());
    expect(r.expiresAt?.toISOString()).toBe(addDays(now, 30).toISOString());
    expect(r.rejectionReasonCode).toBeNull();
    expect(r.updatedBy).toBe(admin.id);
    const log = await activityFor(id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "approved", userId: admin.id, ipHash: "a".repeat(64) });
    expect(log[0].diffJson).toMatchObject({ status: { from: "pending_review", to: "published" } });
  });

  it("particular sin TTL → 60 días", async () => {
    const admin = await fx.user("admin");
    const id = await fx.listing({ status: "pending_review" });
    const now = new Date("2026-09-22T12:00:00Z");
    await transition({ listingId: id, action: "approve", actor: { kind: "user", user: admin }, now });
    expect((await row(id)).expiresAt?.toISOString()).toBe(addDays(now, 60).toISOString());
  });

  it("publicar sin imagen, sin precio ni cuota o sin modelo → requirements, y nada cambia", async () => {
    const admin = await fx.user("admin");
    const noImage = await fx.listing({ status: "pending_review" }, { image: false });
    const noPrice = await fx.listing({ status: "pending_review", priceGs: null });
    const noModel = await fx.listing({ status: "pending_review", modelId: null, modelRaw: "algo" });
    for (const [id, problem] of [
      [noImage, "image"],
      [noPrice, "price_or_installment"],
      [noModel, "model"],
    ] as const) {
      const error = await transition({ listingId: id, action: "approve", actor: { kind: "user", user: admin } }).catch((e) => e);
      expect(error).toBeInstanceOf(TransitionError);
      expect(error.code).toBe("requirements");
      expect(error.problems).toContain(problem);
      expect((await row(id)).status).toBe("pending_review");
      expect(await activityFor(id)).toHaveLength(0);
    }
  });

  it("rechazar exige motivo; con motivo lo guarda", async () => {
    const mod = await fx.user("moderator");
    const id = await fx.listing({ status: "pending_review" });
    await expect(transition({ listingId: id, action: "reject", actor: { kind: "user", user: mod } })).rejects.toMatchObject({
      code: "missing_reason",
    });
    expect(await activityFor(id)).toHaveLength(0);
    await transition({ listingId: id, action: "reject", actor: { kind: "user", user: mod }, reason: { code: "fotos", note: "borrosas" } });
    const r = await row(id);
    expect(r).toMatchObject({ status: "rejected", rejectionReasonCode: "fotos", rejectionNote: "borrosas" });
  });

  it("dealer con auto_approve aprueba la propia; el sistema también; sin auto_approve no", async () => {
    const auto = await fx.dealer({ autoApprove: true });
    const manual = await fx.dealer({ autoApprove: false });
    const dealer = await fx.user("dealer", { dealerId: auto });
    const a = await fx.listing({ status: "pending_review", dealerId: auto });
    const b = await fx.listing({ status: "pending_review", dealerId: auto });
    const c = await fx.listing({ status: "pending_review", dealerId: manual });
    await transition({ listingId: a, action: "approve", actor: { kind: "user", user: dealer } });
    await transition({ listingId: b, action: "approve", actor: { kind: "system", job: "auto-approve" } });
    await expect(transition({ listingId: c, action: "approve", actor: { kind: "system", job: "auto-approve" } })).rejects.toBeInstanceOf(
      TransitionForbiddenError,
    );
    expect((await row(a)).status).toBe("published");
    expect((await row(b)).status).toBe("published");
    expect((await row(c)).status).toBe("pending_review");
    expect((await activityFor(b))[0]).toMatchObject({ userId: null, action: "approved" });
  });

  it("vendida → renovar: sold_at se limpia y expires_at se renueva", async () => {
    const seller = await fx.user("seller");
    const id = await fx.listing({ status: "published", ownerUserId: seller.id, publishedAt: new Date("2026-08-01T00:00:00Z") });
    const actor = { kind: "user" as const, user: seller };
    await transition({ listingId: id, action: "mark_sold", actor });
    expect((await row(id)).soldAt).not.toBeNull();
    const now = new Date("2026-09-22T00:00:00Z");
    await transition({ listingId: id, action: "renew", actor, now });
    const r = await row(id);
    expect(r).toMatchObject({ status: "published", soldAt: null });
    expect(r.expiresAt?.toISOString()).toBe(addDays(now, 60).toISOString());
    expect(r.publishedAt?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect((await activityFor(id)).map((l) => l.action)).toEqual(["sold", "renewed"]);
  });

  it("enlace privado: vende su publicación; borrar deja deleted_at y bloquea todo después", async () => {
    const id = await fx.listing({ status: "published" });
    await transition({ listingId: id, action: "mark_sold", actor: { kind: "manage_token", listingId: id } });
    await transition({ listingId: id, action: "delete", actor: { kind: "manage_token", listingId: id } });
    const r = await row(id);
    expect(r.status).toBe("sold");
    expect(r.deletedAt).not.toBeNull();
    const log = await activityFor(id);
    expect(log.map((l) => l.action)).toEqual(["sold", "deleted"]);
    expect(log[0].diffJson).toMatchObject({ via: "manage_token" });
    await expect(transition({ listingId: id, action: "renew", actor: { kind: "manage_token", listingId: id } })).rejects.toMatchObject({
      code: "deleted",
    });
  });

  it("publicación inexistente → not_found", async () => {
    const admin = await fx.user("admin");
    await expect(transition({ listingId: 999_999_999, action: "approve", actor: { kind: "user", user: admin } })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("dos transiciones simultáneas: una gana, la otra ve el estado nuevo", async () => {
    const admin = await fx.user("admin");
    const id = await fx.listing({ status: "pending_review" });
    const actor = { kind: "user" as const, user: admin };
    const results = await Promise.allSettled([
      transition({ listingId: id, action: "approve", actor }),
      transition({ listingId: id, action: "reject", actor, reason: { code: "otro" } }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")[0]).toMatchObject({ reason: { code: "invalid_state" } });
    expect(await activityFor(id)).toHaveLength(1);
  });
});
