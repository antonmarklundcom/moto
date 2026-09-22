// Máquina de estados de `listings` (DATABASE_SCHEMA.md §3), como datos.
//
// `TRANSITIONS` es la matriz "quién puede ejecutar cada transición" tal cual
// está en el documento; `decide()` la aplica sin tocar la base (unitarias:
// una prueba negativa por cada transición prohibida × rol); `transition()` la
// aplica de verdad: bloquea la fila, revalida, chequea las reglas duras y
// escribe `activity_log` en la misma transacción.
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { dealers, listingImages, listings, type listingStatusEnum } from "@/db/schema";
import { diffFields, logActivity } from "@/lib/activity";
import { normalizePhone } from "@/lib/phone";
import { ForbiddenError, inScope, type Role, type SessionUser } from "@/lib/auth/roles";

export type ListingStatus = (typeof listingStatusEnum)[number];

export type TransitionAction =
  | "submit"
  | "approve"
  | "reject"
  | "pause"
  | "resume"
  | "mark_sold"
  | "expire"
  | "renew"
  | "resubmit"
  | "delete";

export type ActorRole = Role | "system";

/**
 * - `yes`: siempre.
 * - `own`: sólo si la publicación es propia (dealer: su comercio; seller: su
 *   usuario o su enlace privado).
 * - `own_auto_approve`: propia y el comercio tiene `auto_approve`.
 * - `auto_approve`: el sistema, sólo si el comercio tiene `auto_approve`.
 * - `no`: nunca.
 */
export type Permission = "yes" | "own" | "own_auto_approve" | "auto_approve" | "no";

export type TransitionDef = {
  /** Estados de origen válidos. `"any"` = cualquiera (borrado lógico). */
  from: readonly ListingStatus[] | "any";
  /** Estado destino. `null` = no cambia el estado (borrado lógico: `deleted_at`). */
  to: ListingStatus | null;
  who: Readonly<Record<ActorRole, Permission>>;
  /** Valor de `activity_log.action`. */
  logAction: string;
};

export const DEFAULT_LISTING_TTL_DAYS = 60;

const OWNERS_AND_STAFF = { admin: "yes", moderator: "yes", dealer: "own", seller: "own", system: "no" } as const;

export const TRANSITIONS: Readonly<Record<TransitionAction, TransitionDef>> = {
  submit: {
    from: ["draft"],
    to: "pending_review",
    who: { admin: "yes", moderator: "no", dealer: "own", seller: "own", system: "no" },
    logAction: "submitted",
  },
  approve: {
    from: ["pending_review"],
    to: "published",
    who: { admin: "yes", moderator: "yes", dealer: "own_auto_approve", seller: "no", system: "auto_approve" },
    logAction: "approved",
  },
  reject: {
    from: ["pending_review"],
    to: "rejected",
    who: { admin: "yes", moderator: "yes", dealer: "no", seller: "no", system: "no" },
    logAction: "rejected",
  },
  pause: { from: ["published"], to: "paused", who: OWNERS_AND_STAFF, logAction: "paused" },
  resume: { from: ["paused"], to: "published", who: OWNERS_AND_STAFF, logAction: "resumed" },
  mark_sold: { from: ["published"], to: "sold", who: OWNERS_AND_STAFF, logAction: "sold" },
  expire: {
    from: ["published"],
    to: "expired",
    who: { admin: "no", moderator: "no", dealer: "no", seller: "no", system: "yes" },
    logAction: "expired",
  },
  renew: { from: ["expired", "sold"], to: "published", who: OWNERS_AND_STAFF, logAction: "renewed" },
  // Regla dura de §3: un cambio de fotos o descripción en una publicación de
  // particular vuelve a moderación. Lo dispara la edición del propio vendedor;
  // sólo aplica a publicaciones sin comercio (ver decide()).
  resubmit: {
    from: ["published"],
    to: "pending_review",
    who: { admin: "no", moderator: "no", dealer: "no", seller: "own", system: "no" },
    logAction: "resubmitted",
  },
  delete: { from: "any", to: null, who: OWNERS_AND_STAFF, logAction: "deleted" },
};

/** Quién actúa. El titular del enlace privado /mi-aviso (G-1) cuenta como `seller` dueño de esa publicación. */
export type Actor =
  | { kind: "user"; user: SessionUser; ipHash?: string | null }
  | { kind: "system"; job: string }
  | { kind: "manage_token"; listingId: number; ipHash?: string | null };

export function actorRole(actor: Actor): ActorRole {
  if (actor.kind === "user") return actor.user.role;
  if (actor.kind === "system") return "system";
  return "seller";
}

export type ListingForTransition = {
  id: number;
  status: ListingStatus;
  dealerId: number | null;
  ownerUserId: number | null;
  deletedAt: Date | null;
};

export function actorOwns(actor: Actor, listing: ListingForTransition): boolean {
  if (actor.kind === "system") return false;
  if (actor.kind === "manage_token") return actor.listingId === listing.id && listing.dealerId === null;
  const { user } = actor;
  if (user.role === "dealer" || user.role === "seller") return inScope(user, listing);
  return false;
}

export type Decision =
  | { ok: true; def: TransitionDef }
  | { ok: false; code: "forbidden" | "invalid_state" | "deleted"; message: string };

/**
 * ¿Puede `actor` ejecutar `action` sobre `listing`? Primero el permiso (un rol
 * sin permiso recibe `forbidden` sea cual sea el estado), después el estado.
 */
export function decide(
  action: TransitionAction,
  actor: Actor,
  listing: ListingForTransition,
  ctx: { dealerAutoApprove: boolean },
): Decision {
  const def = TRANSITIONS[action];
  const role = actorRole(actor);
  const permission = def.who[role];
  const own = actorOwns(actor, listing);

  let allowed: boolean;
  switch (permission) {
    case "yes":
      allowed = true;
      break;
    case "own":
      allowed = own;
      break;
    case "own_auto_approve":
      allowed = own && listing.dealerId !== null && ctx.dealerAutoApprove;
      break;
    case "auto_approve":
      allowed = listing.dealerId !== null && ctx.dealerAutoApprove;
      break;
    case "no":
      allowed = false;
      break;
  }
  if (allowed && action === "resubmit" && listing.dealerId !== null) allowed = false;
  if (!allowed) {
    return { ok: false, code: "forbidden", message: `${role} no puede ${action} la publicación ${listing.id}` };
  }

  if (listing.deletedAt !== null) {
    return { ok: false, code: "deleted", message: `La publicación ${listing.id} está borrada` };
  }
  if (def.from !== "any" && !def.from.includes(listing.status)) {
    return { ok: false, code: "invalid_state", message: `${action} no aplica a una publicación en ${listing.status}` };
  }
  return { ok: true, def };
}

/** Acciones disponibles para mostrar botones. Mostrar no autoriza: transition() revalida. */
export function allowedActions(
  actor: Actor,
  listing: ListingForTransition,
  ctx: { dealerAutoApprove: boolean },
): TransitionAction[] {
  return (Object.keys(TRANSITIONS) as TransitionAction[]).filter((a) => decide(a, actor, listing, ctx).ok);
}

export type PublishFields = {
  priceGs: number | null;
  installmentGs: number | null;
  cityId: number | null;
  brandId: number | null;
  modelId: number | null;
  contactPhoneE164: string | null;
};

export type PublishProblem = "image" | "price_or_installment" | "city" | "brand" | "model" | "phone";

/** Regla dura de §3: `published` exige ≥ 1 imagen, precio o cuota, ciudad, marca, `model_id` y teléfono válido. */
export function publishProblems(listing: PublishFields, imageCount: number): PublishProblem[] {
  const problems: PublishProblem[] = [];
  if (imageCount < 1) problems.push("image");
  if (!((listing.priceGs ?? 0) > 0 || (listing.installmentGs ?? 0) > 0)) problems.push("price_or_installment");
  if (!listing.cityId) problems.push("city");
  if (!listing.brandId) problems.push("brand");
  if (!listing.modelId) problems.push("model");
  if (!isValidStoredPhone(listing.contactPhoneE164)) problems.push("phone");
  return problems;
}

function isValidStoredPhone(phone: string | null): boolean {
  if (!phone) return false;
  try {
    return normalizePhone(phone, { allowLandline: true }) === phone;
  } catch {
    return false;
  }
}

/**
 * Regla dura de §3: en una publicación de particular publicada, cambiar fotos
 * o descripción la devuelve a moderación (acción `resubmit`). Un cambio de
 * precio no: se registra en activity_log (`price_changed`) y sigue publicada.
 */
export function editRequiresReview(
  listing: { status: ListingStatus; dealerId: number | null },
  changed: { images?: boolean; description?: boolean },
): boolean {
  return listing.status === "published" && listing.dealerId === null && Boolean(changed.images || changed.description);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export class TransitionError extends Error {
  constructor(
    readonly code: "not_found" | "invalid_state" | "deleted" | "requirements" | "missing_reason",
    message: string,
    readonly problems: PublishProblem[] = [],
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

/** Transición prohibida para el actor: es un 403 (ForbiddenError). */
export class TransitionForbiddenError extends ForbiddenError {
  constructor(message: string) {
    super(message);
    this.name = "TransitionForbiddenError";
  }
}

export type TransitionInput = {
  listingId: number;
  action: TransitionAction;
  actor: Actor;
  /** Obligatorio para `reject` (ADMIN_SPEC.md §3: motivo de la lista cerrada). */
  reason?: { code: string; note?: string | null };
  now?: Date;
};

export type TransitionResult = { listingId: number; from: ListingStatus; to: ListingStatus; action: TransitionAction };

/**
 * Ejecuta una transición. En una sola transacción: `SELECT … FOR UPDATE` de la
 * fila, decide(), reglas duras, UPDATE de la fila bloqueada y la fila
 * de `activity_log`. Lanza TransitionForbiddenError (403) o TransitionError.
 */
export async function transition(input: TransitionInput): Promise<TransitionResult> {
  const now = input.now ?? new Date();
  const { action, actor } = input;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: listings.id,
        status: listings.status,
        dealerId: listings.dealerId,
        ownerUserId: listings.ownerUserId,
        deletedAt: listings.deletedAt,
        priceGs: listings.priceGs,
        installmentGs: listings.installmentGs,
        cityId: listings.cityId,
        brandId: listings.brandId,
        modelId: listings.modelId,
        contactPhoneE164: listings.contactPhoneE164,
        publishedAt: listings.publishedAt,
        expiresAt: listings.expiresAt,
        soldAt: listings.soldAt,
        rejectionReasonCode: listings.rejectionReasonCode,
        rejectionNote: listings.rejectionNote,
      })
      .from(listings)
      .where(eq(listings.id, input.listingId))
      .for("update");
    if (!row) throw new TransitionError("not_found", `No existe la publicación ${input.listingId}`);

    let dealer: { autoApprove: boolean; listingTtlDays: number | null } | undefined;
    if (row.dealerId !== null) {
      [dealer] = await tx
        .select({ autoApprove: dealers.autoApprove, listingTtlDays: dealers.listingTtlDays })
        .from(dealers)
        .where(eq(dealers.id, row.dealerId));
    }

    const decision = decide(action, actor, row, { dealerAutoApprove: dealer?.autoApprove ?? false });
    if (!decision.ok) {
      if (decision.code === "forbidden") throw new TransitionForbiddenError(decision.message);
      throw new TransitionError(decision.code, decision.message);
    }
    const to = decision.def.to;

    if (to === "published") {
      const [images] = await tx
        .select({ n: count() })
        .from(listingImages)
        .where(eq(listingImages.listingId, row.id));
      const problems = publishProblems(row, images?.n ?? 0);
      if (problems.length) {
        throw new TransitionError("requirements", `Faltan datos para publicar: ${problems.join(", ")}`, problems);
      }
    }

    const ttl = dealer?.listingTtlDays ?? DEFAULT_LISTING_TTL_DAYS;
    const set: Partial<typeof listings.$inferInsert> = {};
    if (to !== null) set.status = to;
    switch (action) {
      case "approve":
        set.publishedAt = row.publishedAt ?? now;
        set.expiresAt = addDays(now, ttl);
        set.rejectionReasonCode = null;
        set.rejectionNote = null;
        break;
      case "reject":
        if (!input.reason?.code) throw new TransitionError("missing_reason", "Rechazar exige un motivo");
        set.rejectionReasonCode = input.reason.code.slice(0, 50);
        set.rejectionNote = input.reason.note ?? null;
        break;
      case "resume":
        // Si venció mientras estaba pausada, vuelve con un plazo nuevo.
        if (!row.expiresAt || row.expiresAt <= now) set.expiresAt = addDays(now, ttl);
        break;
      case "mark_sold":
        set.soldAt = now;
        break;
      case "renew":
        set.expiresAt = addDays(now, ttl);
        set.soldAt = null;
        break;
      case "delete":
        set.deletedAt = now;
        break;
    }

    const diff: Record<string, unknown> = diffFields(row as Record<string, unknown>, set as Record<string, unknown>);
    if (actor.kind === "user") set.updatedBy = actor.user.id;

    await tx.update(listings).set(set).where(eq(listings.id, row.id));

    if (actor.kind === "manage_token") diff.via = "manage_token";
    if (actor.kind === "system") diff.job = actor.job;
    await logActivity(tx, {
      userId: actor.kind === "user" ? actor.user.id : null,
      entityType: "listing",
      entityId: row.id,
      action: decision.def.logAction,
      diff,
      ipHash: actor.kind === "system" ? null : (actor.ipHash ?? null),
    });

    return { listingId: row.id, from: row.status, to: to ?? row.status, action };
  });
}
