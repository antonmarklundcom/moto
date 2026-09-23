import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/roles";
import {
  type Actor,
  allowedActions,
  decide,
  editRequiresReview,
  type ListingForTransition,
  type ListingStatus,
  publishProblems,
  TRANSITIONS,
  type TransitionAction,
} from "./state";

// Unitarias: la parte pura de la máquina. transition() (con base) va en state.int.test.ts.
vi.mock("@/db", () => ({ db: {} }));

// La matriz de DATABASE_SCHEMA.md §3 copiada a mano, independiente de
// TRANSITIONS: si alguien cambia la tabla del código sin cambiar el documento,
// estas pruebas fallan.
//   Y = sí · O = sólo propia · A = propia y auto_approve · S = sistema con auto_approve · - = no
const DOC: Record<TransitionAction, { from: ListingStatus[] | "any"; to: ListingStatus | null; who: string }> = {
  //                                                                  admin mod dealer seller system
  submit: { from: ["draft"], to: "pending_review", who:                "Y - O O -" },
  approve: { from: ["pending_review"], to: "published", who:           "Y Y A - S" },
  reject: { from: ["pending_review"], to: "rejected", who:             "Y Y - - -" },
  pause: { from: ["published"], to: "paused", who:                     "Y Y O O Y" },
  resume: { from: ["paused"], to: "published", who:                    "Y Y O O -" },
  mark_sold: { from: ["published"], to: "sold", who:                   "Y Y O O -" },
  expire: { from: ["published"], to: "expired", who:                   "- - - - Y" },
  renew: { from: ["expired", "sold"], to: "published", who:            "Y Y O O -" },
  // Regla dura: fotos/descripción de particular publicada → vuelve a moderación.
  resubmit: { from: ["published"], to: "pending_review", who:          "- - - O -" },
  delete: { from: "any", to: null, who:                                "Y Y O O -" },
};

const ROLES = ["admin", "moderator", "dealer", "seller", "system"] as const;
type R = (typeof ROLES)[number];
const STATES: ListingStatus[] = ["draft", "pending_review", "published", "paused", "sold", "expired", "rejected"];
const ACTIONS = Object.keys(DOC) as TransitionAction[];

const DEALER_ID = 7;
const OTHER_DEALER_ID = 8;
const SELLER_ID = 50;

function user(role: SessionUser["role"], id = 1, dealerId: number | null = null): SessionUser {
  return { id, email: `${role}@example.com`, name: role, role, dealerId };
}

/** Un actor del rol, y la publicación que le es propia (o ajena). */
function scenario(role: R, own: boolean, status: ListingStatus, dealerListing: boolean) {
  const listing: ListingForTransition = {
    id: 100,
    status,
    dealerId: dealerListing ? (role === "dealer" && !own ? OTHER_DEALER_ID : DEALER_ID) : null,
    ownerUserId: dealerListing ? null : own ? SELLER_ID : SELLER_ID + 1,
    deletedAt: null,
  };
  let actor: Actor;
  switch (role) {
    case "admin":
      actor = { kind: "user", user: user("admin") };
      break;
    case "moderator":
      actor = { kind: "user", user: user("moderator", 2) };
      break;
    case "dealer":
      actor = { kind: "user", user: user("dealer", 3, DEALER_ID) };
      break;
    case "seller":
      actor = { kind: "user", user: user("seller", SELLER_ID) };
      break;
    case "system":
      actor = { kind: "system", job: "test" };
      break;
  }
  return { actor, listing };
}

/** Qué debería pasar según el documento. dealer usa publicaciones de comercio; seller, de particular. */
function expected(action: TransitionAction, role: R, own: boolean, autoApprove: boolean): boolean {
  const code = DOC[action].who.split(/\s+/)[ROLES.indexOf(role)];
  switch (code) {
    case "Y":
      return true;
    case "O":
      return own;
    case "A":
      return own && autoApprove;
    case "S":
      return autoApprove;
    default:
      return false;
  }
}

function dealerListingFor(role: R, action: TransitionAction): boolean {
  if (role === "seller") return false;
  if (role === "dealer") return true;
  if (action === "resubmit") return false;
  return action === "approve"; // el sistema sólo aprueba publicaciones de comercio
}

describe("TRANSITIONS coincide con DATABASE_SCHEMA.md §3", () => {
  it.each(ACTIONS)("%s: origen y destino", (action) => {
    expect(TRANSITIONS[action].from).toEqual(DOC[action].from);
    expect(TRANSITIONS[action].to).toBe(DOC[action].to);
  });

  it("no hay transiciones fuera del documento", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...ACTIONS].sort());
  });
});

// Casos de permiso: acción × rol × (propia | ajena) × auto_approve, desde un
// estado de origen válido.
const permissionCases = ACTIONS.flatMap((action) =>
  ROLES.flatMap((role) =>
    [true, false].flatMap((own) =>
      [false, true].map((autoApprove) => {
        const from = DOC[action].from === "any" ? "published" : (DOC[action].from as ListingStatus[])[0];
        return { action, role, own, autoApprove, from, allowed: expected(action, role, own, autoApprove) };
      }),
    ),
  ),
);

describe("transiciones permitidas por rol", () => {
  it.each(permissionCases.filter((c) => c.allowed))(
    "$role puede $action (propia=$own, auto_approve=$autoApprove)",
    ({ action, role, own, autoApprove, from }) => {
      const { actor, listing } = scenario(role, own, from, dealerListingFor(role, action));
      expect(decide(action, actor, listing, { dealerAutoApprove: autoApprove })).toMatchObject({ ok: true });
    },
  );
});

describe("pruebas negativas: cada transición prohibida × rol → forbidden", () => {
  it.each(permissionCases.filter((c) => !c.allowed))(
    "$role NO puede $action (propia=$own, auto_approve=$autoApprove)",
    ({ action, role, own, autoApprove, from }) => {
      const { actor, listing } = scenario(role, own, from, dealerListingFor(role, action));
      expect(decide(action, actor, listing, { dealerAutoApprove: autoApprove })).toMatchObject({
        ok: false,
        code: "forbidden",
      });
    },
  );
});

describe("pruebas negativas: estado de origen inválido → invalid_state", () => {
  const cases = ACTIONS.filter((a) => DOC[a].from !== "any").flatMap((action) =>
    STATES.filter((s) => !(DOC[action].from as ListingStatus[]).includes(s)).map((from) => ({ action, from })),
  );
  it.each(cases)("$action desde $from", ({ action, from }) => {
    // Un actor que sí tiene permiso: admin, o el sistema para expire, o el vendedor para resubmit.
    const role: R = action === "expire" ? "system" : action === "resubmit" ? "seller" : "admin";
    const { actor, listing } = scenario(role, true, from, false);
    expect(decide(action, actor, listing, { dealerAutoApprove: false })).toMatchObject({
      ok: false,
      code: "invalid_state",
    });
  });
});

describe("casos puntuales", () => {
  const admin: Actor = { kind: "user", user: user("admin") };

  it("una publicación borrada no admite ninguna transición", () => {
    const listing: ListingForTransition = { id: 1, status: "published", dealerId: null, ownerUserId: null, deletedAt: new Date() };
    for (const action of ACTIONS) {
      const d = decide(action, action === "expire" ? { kind: "system", job: "t" } : admin, listing, { dealerAutoApprove: false });
      expect(d.ok).toBe(false);
    }
  });

  it("dealer sin comercio asignado no es dueño de nada", () => {
    const actor: Actor = { kind: "user", user: user("dealer", 3, null) };
    const listing: ListingForTransition = { id: 1, status: "published", dealerId: null, ownerUserId: null, deletedAt: null };
    expect(() => decide("pause", actor, listing, { dealerAutoApprove: false })).toThrow();
  });

  it("el enlace privado actúa como seller sólo sobre su publicación de particular", () => {
    const listing: ListingForTransition = { id: 9, status: "published", dealerId: null, ownerUserId: null, deletedAt: null };
    const holder: Actor = { kind: "manage_token", listingId: 9 };
    const other: Actor = { kind: "manage_token", listingId: 10 };
    expect(decide("mark_sold", holder, listing, { dealerAutoApprove: false }).ok).toBe(true);
    expect(decide("resubmit", holder, listing, { dealerAutoApprove: false }).ok).toBe(true);
    expect(decide("mark_sold", other, listing, { dealerAutoApprove: false })).toMatchObject({ code: "forbidden" });
    expect(decide("approve", holder, { ...listing, status: "pending_review" }, { dealerAutoApprove: true })).toMatchObject({
      code: "forbidden",
    });
    expect(decide("pause", holder, { ...listing, dealerId: 7 }, { dealerAutoApprove: false })).toMatchObject({
      code: "forbidden",
    });
  });

  it("resubmit nunca aplica a una publicación de comercio", () => {
    const actor: Actor = { kind: "user", user: user("seller", SELLER_ID) };
    const listing: ListingForTransition = { id: 1, status: "published", dealerId: 7, ownerUserId: SELLER_ID, deletedAt: null };
    expect(decide("resubmit", actor, listing, { dealerAutoApprove: false })).toMatchObject({ code: "forbidden" });
  });

  it("el sistema no auto-aprueba publicaciones de particular", () => {
    const listing: ListingForTransition = { id: 1, status: "pending_review", dealerId: null, ownerUserId: null, deletedAt: null };
    expect(decide("approve", { kind: "system", job: "t" }, listing, { dealerAutoApprove: true })).toMatchObject({
      code: "forbidden",
    });
  });

  it("allowedActions de un moderador sobre una pendiente", () => {
    const listing: ListingForTransition = { id: 1, status: "pending_review", dealerId: null, ownerUserId: null, deletedAt: null };
    expect(allowedActions({ kind: "user", user: user("moderator") }, listing, { dealerAutoApprove: false }).sort()).toEqual(
      ["approve", "delete", "reject"].sort(),
    );
  });
});

describe("publishProblems (regla dura de published)", () => {
  const ok = {
    priceGs: 12_500_000,
    installmentGs: null,
    cityId: 1,
    brandId: 1,
    modelId: 1,
    contactPhoneE164: "+595981123456",
  };

  it("completa → sin problemas", () => {
    expect(publishProblems(ok, 1)).toEqual([]);
  });

  it("sólo cuota alcanza", () => {
    expect(publishProblems({ ...ok, priceGs: null, installmentGs: 450_000 }, 1)).toEqual([]);
  });

  it("detecta cada faltante", () => {
    expect(
      publishProblems({ priceGs: 0, installmentGs: null, cityId: null, brandId: null, modelId: null, contactPhoneE164: "0981" }, 0),
    ).toEqual(["image", "price_or_installment", "city", "brand", "model", "phone"]);
  });

  it("teléfono no normalizado → problema", () => {
    expect(publishProblems({ ...ok, contactPhoneE164: "0981 123 456" }, 1)).toEqual(["phone"]);
  });
});

describe("editRequiresReview", () => {
  it("particular publicada + fotos o descripción → vuelve a moderación", () => {
    expect(editRequiresReview({ status: "published", dealerId: null }, { images: true })).toBe(true);
    expect(editRequiresReview({ status: "published", dealerId: null }, { description: true })).toBe(true);
  });
  it("precio solo, comercio, o no publicada → no", () => {
    expect(editRequiresReview({ status: "published", dealerId: null }, {})).toBe(false);
    expect(editRequiresReview({ status: "published", dealerId: 3 }, { images: true })).toBe(false);
    expect(editRequiresReview({ status: "paused", dealerId: null }, { images: true })).toBe(false);
  });
});
