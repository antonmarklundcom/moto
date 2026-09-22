import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { listings } from "@/db/schema";
import { activityFor, createFixtures } from "@/lib/auth/int-fixtures";
import { findListingIdByManageToken, hashManageToken, rotateManageToken } from "./manage-token";

const TAG = `a1token${Date.now()}`;
let fx: Awaited<ReturnType<typeof createFixtures>>;

beforeAll(async () => {
  fx = await createFixtures(TAG);
});
afterAll(async () => {
  await fx.cleanup();
  await closeDb();
});

describe("manage token contra MySQL (G-1)", () => {
  it("emitir, encontrar, rotar: el anterior deja de valer y sólo se guarda el hash", async () => {
    const id = await fx.listing({ status: "published" });
    const first = await rotateManageToken(id);
    expect(await findListingIdByManageToken(first)).toBe(id);

    const [r] = await db.select({ h: listings.manageTokenHash }).from(listings).where(eq(listings.id, id));
    expect(r.h).toBe(hashManageToken(first));
    expect(r.h).not.toContain(first);

    const second = await rotateManageToken(id, { userId: null });
    expect(second).not.toBe(first);
    expect(await findListingIdByManageToken(first)).toBeNull();
    expect(await findListingIdByManageToken(second)).toBe(id);
    expect((await activityFor(id)).map((l) => l.action)).toEqual(["manage_token_rotated", "manage_token_rotated"]);
  });

  it("token mal formado o de una publicación borrada → null", async () => {
    const id = await fx.listing({ status: "published" });
    const token = await rotateManageToken(id);
    expect(await findListingIdByManageToken("corto")).toBeNull();
    await db.update(listings).set({ deletedAt: new Date() }).where(eq(listings.id, id));
    expect(await findListingIdByManageToken(token)).toBeNull();
  });

  it("rotar una publicación inexistente falla sin registrar nada", async () => {
    await expect(rotateManageToken(999_999_999)).rejects.toThrow();
  });
});
