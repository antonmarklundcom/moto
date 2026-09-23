import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLog, brands, posts } from "@/db/schema";
import { createFixtures, sessionCookieFor } from "@/lib/auth/int-fixtures";
import type { SessionUser } from "@/lib/auth/roles";
import { POST as guardarPOST } from "../guardar/route";
import { POST as introPOST } from "../intro/route";
import { readdirSync } from "node:fs";
import { GUIDES_DIR, listIntroRows, loadGuideDrafts, savePost } from "./content-admin";

const fx = await createFixtures("b10");
const TAG = `b10-${Date.now().toString(36)}`;
let admin: SessionUser;
let mod: SessionUser;
let dealerUser: SessionUser;
let brandId: number;
let brandIntro: string | null;

const BODY = `<p>${"Texto revisado de una guía de prueba sobre motos en Paraguay. ".repeat(20)}</p>`;

function form(fields: Record<string, string>, cookie?: string) {
  const body = new URLSearchParams(fields);
  return guardarPOST(
    new Request("http://localhost:3000/admin/contenido/guardar", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost:3000", host: "localhost:3000", ...(cookie ? { cookie } : {}) },
      body,
    }),
    undefined as never,
  );
}

beforeAll(async () => {
  admin = await fx.user("admin");
  mod = await fx.user("moderator");
  const dealerId = await fx.dealer();
  dealerUser = await fx.user("dealer", { dealerId });
  const [b] = await db.select({ id: brands.id, introHtml: brands.introHtml }).from(brands).limit(1);
  brandId = b.id;
  brandIntro = b.introHtml;
});

afterAll(async () => {
  const ids = (await db.select({ id: posts.id }).from(posts).where(like(posts.slug, `${TAG}%`))).map((r) => r.id);
  const guideIds = (await db.select({ id: posts.id }).from(posts).where(inArray(posts.authorUserId, [admin.id]))).map((r) => r.id);
  const all = [...new Set([...ids, ...guideIds])];
  if (all.length) {
    await db.delete(activityLog).where(inArray(activityLog.entityId, all));
    await db.delete(posts).where(inArray(posts.id, all));
  }
  await db.update(brands).set({ introHtml: brandIntro }).where(eq(brands.id, brandId));
  await fx.cleanup();
});

describe("reviewed_by (ADMIN_SPEC §9)", () => {
  it("un POST directo que publica sin revisor → 400 y no guarda nada", async () => {
    const res = await form({ title: "Guía sin revisor", slug: `${TAG}-a`, bodyHtml: BODY, status: "published" }, await sessionCookieFor(mod.id));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "reviewer_required" });
    expect(await db.select().from(posts).where(eq(posts.slug, `${TAG}-a`))).toHaveLength(0);
  });

  it("revisor que no es admin/moderador → 400; con revisor válido publica y fija la fecha", async () => {
    const cookie = await sessionCookieFor(mod.id);
    const bad = await form({ title: "Guía", slug: `${TAG}-b`, bodyHtml: BODY, status: "published", reviewedBy: String(dealerUser.id) }, cookie);
    expect(bad.status).toBe(400);
    const ok = await form({ title: "Guía", slug: `${TAG}-b`, bodyHtml: `${BODY}<script>alert(1)</script>`, status: "published", reviewedBy: String(admin.id) }, cookie);
    expect(ok.status).toBe(200);
    const [row] = await db.select().from(posts).where(eq(posts.slug, `${TAG}-b`));
    expect(row).toMatchObject({ status: "published", reviewedBy: admin.id, authorUserId: mod.id });
    expect(row.publishedAt).toBeInstanceOf(Date);
    expect(row.bodyHtml).not.toContain("<script");
    // La URL de una guía publicada no cambia.
    const slugChange = await form({ id: String(row.id), title: "Guía", slug: `${TAG}-otro`, bodyHtml: BODY, status: "published", reviewedBy: String(admin.id) }, cookie);
    expect(slugChange.status).toBe(422);
  });

  it("[VERIFICAR] sin resolver no se publica (422), pero se puede guardar como borrador", async () => {
    const cookie = await sessionCookieFor(admin.id);
    const withMarker = `${BODY}<p>Arancel [VERIFICAR: monto — fuente: Registro]</p>`;
    const pub = await form({ title: "Guía marcada", slug: `${TAG}-c`, bodyHtml: withMarker, status: "published", reviewedBy: String(admin.id) }, cookie);
    expect(pub.status).toBe(422);
    const draft = await form({ title: "Guía marcada", slug: `${TAG}-c`, bodyHtml: withMarker, status: "draft" }, cookie);
    expect(draft.status).toBe(200);
  });

  it("sin sesión 401, dealer 403, otro origen 403", async () => {
    expect((await form({ title: "x", status: "draft" })).status).toBe(401);
    expect((await form({ title: "x", status: "draft" }, await sessionCookieFor(dealerUser.id))).status).toBe(403);
    const foreign = await guardarPOST(
      new Request("http://localhost:3000/admin/contenido/guardar", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://evil.example", host: "localhost:3000", cookie: await sessionCookieFor(admin.id) },
        body: new URLSearchParams({ title: "x", status: "draft" }),
      }),
      undefined as never,
    );
    expect(foreign.status).toBe(403);
  });
});

describe("borradores de content/guias", () => {
  it("carga todos como draft y no pisa los existentes", async () => {
    const total = readdirSync(GUIDES_DIR).filter((f) => f.endsWith(".md")).length;
    const before = (await db.select({ slug: posts.slug }).from(posts)).map((r) => r.slug);
    const first = await loadGuideDrafts(admin);
    expect(first.failed).toEqual([]);
    expect(first.created.length + first.skipped.length).toBe(total);
    const created = await db.select().from(posts).where(inArray(posts.slug, first.created.length ? first.created : ["-"]));
    for (const p of created) {
      expect(p.status).toBe("draft");
      expect(p.reviewedBy).toBeNull();
    }
    const second = await loadGuideDrafts(admin);
    expect(second.created).toEqual([]);
    expect(second.skipped.length).toBe(total);
    expect(before.every((s) => !first.created.includes(s))).toBe(true);
    // Un borrador con [VERIFICAR] no se puede publicar aunque tenga revisor.
    const marked = created.find((p) => p.bodyHtml?.includes("[VERIFICAR"));
    if (marked) {
      const r = await savePost(admin, { id: marked.id, title: marked.title, slug: marked.slug, excerpt: "", bodyHtml: marked.bodyHtml ?? "", metaTitle: "", metaDescription: "", status: "published", reviewedBy: admin.id });
      expect(r).toMatchObject({ ok: false, status: 422 });
    }
  });
});

describe("intro_html", () => {
  it("guarda limpio, rechaza [VERIFICAR] y devuelve el mismo indicador que el listado", async () => {
    const cookie = await sessionCookieFor(mod.id);
    const post = (body: unknown) =>
      introPOST(
        new Request("http://localhost:3000/admin/contenido/intro", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000", cookie },
          body: JSON.stringify(body),
        }),
        undefined as never,
      );
    const marked = await post({ kind: "brand", id: brandId, html: "<p>[VERIFICAR: dato]</p>" });
    expect(marked.status).toBe(422);
    const html = `<p onclick="x()">${"palabra ".repeat(300)}</p><script>alert(1)</script>`;
    const res = await post({ kind: "brand", id: brandId, html });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { words: number; indicator: { minWords: number } };
    expect(data.words).toBe(300);
    const [b] = await db.select({ introHtml: brands.introHtml }).from(brands).where(eq(brands.id, brandId));
    expect(b.introHtml).not.toMatch(/onclick|script/);
    const row = (await listIntroRows("brand")).find((r) => r.id === brandId)!;
    expect(row.words).toBe(300);
    expect(row.indicator).toEqual(data.indicator);
    expect((await post({ kind: "otra", id: brandId, html: "x" })).status).toBe(400);
  });
});
