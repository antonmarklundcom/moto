// Comercios en el admin (ADMIN_SPEC.md §5). Admin edita; moderador sólo ve.
// Verificar y auto-aprobación: sólo admin (§2). Nuevos comercios: TTL 30 (G-6).
import "server-only";

import { and, asc, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { cities, dealers, dealerStatusEnum, listings } from "@/db/schema";
import { diffFields, logActivity } from "@/lib/activity";
import { assertRole, type SessionUser } from "@/lib/auth/roles";
import { transition, TransitionError } from "@/lib/listings/state";
import { normalizePhone } from "@/lib/phone";
import { isReservedSlug, slugify } from "@/lib/slug";

export const NEW_DEALER_TTL_DAYS = 30;
/** Alerta cuando `free_until` vence en 60 días o menos (§5). */
export const FREE_UNTIL_ALERT_DAYS = 60;
const DAY = 86_400_000;

export type DealerInput = {
  name: string;
  slug: string;
  cityId: number;
  address: string | null;
  phone: string;
  email: string | null;
  websiteUrl: string | null;
  description: string | null;
  status: (typeof dealerStatusEnum)[number];
  isVerified: boolean;
  autoApprove: boolean;
  authorizationNote: string | null;
  authorizationDate: string | null;
  authorizationChannel: string | null;
  freeUntil: string | null;
  listingTtlDays: number | null;
};

export function freeUntilAlert(freeUntil: string | null, now: Date = new Date()): "vencido" | "pronto" | null {
  if (!freeUntil) return null;
  const end = new Date(`${freeUntil}T03:00:00Z`).getTime();
  if (end < now.getTime()) return "vencido";
  return end - now.getTime() <= FREE_UNTIL_ALERT_DAYS * DAY ? "pronto" : null;
}

export async function listDealersAdmin(user: SessionUser | null) {
  assertRole(user, ["admin", "moderator"]);
  const rows = await db
    .select({ id: dealers.id, name: dealers.name, slug: dealers.slug, status: dealers.status, isVerified: dealers.isVerified, autoApprove: dealers.autoApprove, freeUntil: dealers.freeUntil, authorizationDate: dealers.authorizationDate, city: cities.name })
    .from(dealers)
    .innerJoin(cities, eq(cities.id, dealers.cityId))
    .where(isNull(dealers.deletedAt))
    .orderBy(asc(dealers.name));
  const counts = await db
    .select({ dealerId: listings.dealerId, n: count() })
    .from(listings)
    .where(and(eq(listings.status, "published"), isNull(listings.deletedAt)))
    .groupBy(listings.dealerId);
  const byDealer = new Map(counts.map((c) => [c.dealerId, Number(c.n)]));
  return rows.map((r) => ({ ...r, published: byDealer.get(r.id) ?? 0, alert: freeUntilAlert(r.freeUntil) }));
}

export async function getDealerAdmin(user: SessionUser | null, id: number) {
  assertRole(user, ["admin", "moderator"]);
  const [row] = await db.select().from(dealers).where(and(eq(dealers.id, id), isNull(dealers.deletedAt)));
  return row ?? null;
}

/** El slug de un comercio se bloquea cuando tuvo alguna publicación publicada (su página ya pudo indexarse). */
export async function dealerSlugLocked(id: number): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(listings).where(and(eq(listings.dealerId, id), ne(listings.status, "draft"), ne(listings.status, "pending_review")));
  return Number(row?.n ?? 0) > 0;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveDealer(
  user: SessionUser | null,
  id: number | null,
  input: DealerInput,
): Promise<{ ok: true; id: number } | { ok: false; errors: Record<string, string> }> {
  const actor = assertRole(user, ["admin"]);
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (name.length < 2 || name.length > 200) errors.name = "Nombre de 2 a 200 caracteres.";
  let slug = input.slug.trim().toLowerCase();
  if (!slug && name) {
    try {
      slug = slugify(name);
    } catch {
      slug = "";
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = "Slug con minúsculas, números y guiones.";
  else if (isReservedSlug(slug)) errors.slug = `«${slug}» está reservado para rutas del sitio (G-15).`;
  let phoneE164 = "";
  try {
    phoneE164 = normalizePhone(input.phone, { allowLandline: true });
  } catch {
    errors.phone = "Teléfono válido: 0981 123 456 o 021 123 456.";
  }
  for (const key of ["authorizationDate", "freeUntil"] as const) {
    if (input[key] && !DATE.test(input[key]!)) errors[key] = "Fecha AAAA-MM-DD.";
  }
  if ((input.authorizationNote?.trim() ? 1 : 0) + (input.authorizationDate ? 1 : 0) === 1) {
    errors.authorizationNote = "El bloque de autorización lleva texto y fecha juntos (DATA_SEEDING §5).";
  }
  if (input.listingTtlDays !== null && (input.listingTtlDays < 1 || input.listingTtlDays > 365)) errors.listingTtlDays = "Entre 1 y 365 días.";
  if (input.status === "active" && !(input.authorizationNote?.trim() && input.authorizationDate)) {
    errors.status = "Para activar el comercio hace falta el bloque de autorización (ADR-12).";
  }
  const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, input.cityId));
  if (!city) errors.cityId = "Elegí una ciudad.";
  const [clash] = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.slug, slug));
  if (clash && clash.id !== id) errors.slug = "Ya hay un comercio con ese slug.";
  if (id !== null) {
    const [current] = await db.select({ slug: dealers.slug }).from(dealers).where(eq(dealers.id, id));
    if (!current) return { ok: false, errors: { _: "El comercio no existe." } };
    if (current.slug !== slug && (await dealerSlugLocked(id))) errors.slug = "El slug no se cambia: el comercio ya tuvo publicaciones publicadas (SEO §1).";
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const values = {
    name,
    slug,
    cityId: input.cityId,
    address: input.address?.trim() || null,
    phoneE164,
    phoneRaw: input.phone.trim().slice(0, 30),
    email: input.email?.trim() || null,
    websiteUrl: input.websiteUrl?.trim() || null,
    description: input.description?.trim() || null,
    status: input.status,
    isVerified: input.isVerified,
    autoApprove: input.autoApprove,
    authorizationNote: input.authorizationNote?.trim() || null,
    authorizationDate: input.authorizationDate || null,
    authorizationChannel: input.authorizationChannel?.trim().slice(0, 50) || null,
    freeUntil: input.freeUntil || null,
    listingTtlDays: input.listingTtlDays,
  };
  return db.transaction(async (tx) => {
    if (id === null) {
      const [res] = await tx.insert(dealers).values(values);
      await logActivity(tx, { userId: actor.id, entityType: "dealer", entityId: res.insertId, action: "dealer_created", diff: { name, slug } });
      return { ok: true as const, id: res.insertId };
    }
    const [before] = await tx.select().from(dealers).where(eq(dealers.id, id)).for("update");
    const diff = diffFields(before as Record<string, unknown>, values as Record<string, unknown>);
    if (Object.keys(diff).length) {
      await tx.update(dealers).set(values).where(eq(dealers.id, id));
      await logActivity(tx, { userId: actor.id, entityType: "dealer", entityId: id, action: "dealer_updated", diff });
    }
    return { ok: true as const, id };
  });
}

/**
 * "Baja de todo el stock" (§5, DATA_SEEDING §5): el comercio retiró la
 * autorización. Pausa todas sus publicadas (por `transition()`), pasa el
 * comercio a `paused` y deja constancia en la nota de autorización (se
 * conserva el historial; sin fecha vigente no vuelve a publicar).
 */
export async function withdrawDealerStock(user: SessionUser | null, id: number, note: string): Promise<{ ok: true; paused: number } | { ok: false; error: string }> {
  const actor = assertRole(user, ["admin"]);
  const reason = note.trim();
  if (reason.length < 3) return { ok: false, error: "Anotá por qué y por qué medio lo pidió." };
  const [dealer] = await db.select().from(dealers).where(and(eq(dealers.id, id), isNull(dealers.deletedAt)));
  if (!dealer) return { ok: false, error: "El comercio no existe." };
  const live = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.dealerId, id), inArray(listings.status, ["published"]), isNull(listings.deletedAt)));
  let paused = 0;
  for (const l of live) {
    try {
      await transition({ listingId: l.id, action: "pause", actor: { kind: "user", user: actor } });
      paused += 1;
    } catch (error) {
      if (!(error instanceof TransitionError)) throw error;
    }
  }
  const today = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  await db.transaction(async (tx) => {
    const noteText = `${dealer.authorizationNote ?? ""}\n[Autorización retirada el ${today}: ${reason}]`.trim();
    await tx.update(dealers).set({ status: "paused", autoApprove: false, authorizationDate: null, authorizationNote: noteText }).where(eq(dealers.id, id));
    await logActivity(tx, { userId: actor.id, entityType: "dealer", entityId: id, action: "dealer_stock_withdrawn", diff: { paused, reason, status: { from: dealer.status, to: "paused" } } });
  });
  return { ok: true, paused };
}
