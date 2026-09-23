import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { listingImages } from "@/db/schema";
import { createFixtures } from "@/lib/auth/int-fixtures";
import type { SessionUser } from "@/lib/auth/roles";
import { getStorage } from "@/lib/storage";
import { photoAction } from "./listing-photos";

const TAG = `lph${Date.now().toString(36)}`;
const fx = await createFixtures(TAG);
let base = "";
let mod: SessionUser;
let dealerUser: SessionUser;

async function addPhoto(listingId: number, name: string, sortOrder: number) {
  const path = `dev/${TAG}/${name}.webp`;
  await getStorage().put({ path, data: Buffer.from("x"), contentType: "image/webp" });
  const [r] = await db.insert(listingImages).values({ listingId, storagePath: path, contentHash: "c".repeat(64), sortOrder });
  return { id: r.insertId, path };
}
const order = async (listingId: number) =>
  (await db.select({ id: listingImages.id }).from(listingImages).where(eq(listingImages.listingId, listingId)).orderBy(asc(listingImages.sortOrder), asc(listingImages.id))).map((r) => r.id);

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "moto-lph-"));
  process.env.STORAGE_LOCAL_PATH = base; // antes del primer getStorage()
  mod = await fx.user("moderator");
  const dealerId = await fx.dealer();
  dealerUser = await fx.user("dealer", { dealerId });
});

afterAll(async () => {
  await fx.cleanup();
  await rm(base, { recursive: true, force: true });
});

describe("fotos desde el admin", () => {
  it("portada, subir/bajar y borrar (con el archivo); la última de una publicada no se borra", async () => {
    const id = await fx.listing({ status: "published" }, { image: false });
    const a = await addPhoto(id, "a", 0);
    const b = await addPhoto(id, "b", 1);
    const c = await addPhoto(id, "c", 2);
    expect(await photoAction(mod, id, c.id, "cover")).toEqual({ ok: true });
    expect(await order(id)).toEqual([c.id, a.id, b.id]);
    expect(await photoAction(mod, id, b.id, "up")).toEqual({ ok: true });
    expect(await order(id)).toEqual([c.id, b.id, a.id]);

    expect(await photoAction(mod, id, a.id, "delete")).toEqual({ ok: true });
    await expect(stat(join(base, a.path))).rejects.toThrow();
    await photoAction(mod, id, b.id, "delete");
    const last = await photoAction(mod, id, c.id, "delete");
    expect(last.ok).toBe(false);
    expect(await order(id)).toEqual([c.id]);
  });

  it("una foto de otra publicación no se toca; el comercio no puede", async () => {
    const one = await fx.listing({ status: "draft" }, { image: false });
    const other = await fx.listing({ status: "draft" }, { image: false });
    const p = await addPhoto(other, "ajena", 0);
    expect((await photoAction(mod, one, p.id, "delete")).ok).toBe(false);
    await expect(photoAction(dealerUser, other, p.id, "delete")).rejects.toThrow();
    expect(await order(other)).toEqual([p.id]);
  });
});
