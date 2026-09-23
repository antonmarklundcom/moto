// ADR-12 / DATA_SEEDING.md §5: sin el bloque de autorización (texto + fecha)
// no se publica el stock de un comercio. La máquina de estados de A1 no lo
// mira; esta guarda la llaman todos los caminos a `published` que no son de
// A1: moderación (B6), auto-publicación de la importación (B8) y el admin (B7).
import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dealers, listings } from "@/db/schema";
import { DEV_DEALER_SLUG_PREFIX } from "../../../../scripts/lib/dev-fixtures-core";

export type DealerAuth = { slug: string; status: string; authorizationNote: string | null; authorizationDate: string | null; deletedAt: Date | null };

/** `null` si el comercio puede publicar; si no, el motivo en español. */
export function dealerPublishProblem(d: DealerAuth, demoAllowed: boolean): string | null {
  if (d.deletedAt || d.status === "archived") return "El comercio está archivado.";
  if (d.status === "paused") return "El comercio está pausado (se dio de baja su stock).";
  // Los comercios `dev-` de npm run fixtures no tienen fecha de autorización (son ficticios, sólo en local).
  if (demoAllowed && d.slug.startsWith(DEV_DEALER_SLUG_PREFIX) && d.authorizationNote?.trim()) return null;
  if (!d.authorizationNote?.trim() || !d.authorizationDate) {
    return "El comercio no tiene cargado el bloque de autorización (texto y fecha). Sin eso no se publica su stock (ADR-12).";
  }
  return null;
}

export class DealerNotAuthorizedError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "DealerNotAuthorizedError";
  }
}

/** Para una publicación: sin comercio (particular) siempre pasa. */
export async function listingPublishProblem(listingId: number): Promise<string | null> {
  const [row] = await db
    .select({
      slug: dealers.slug,
      status: dealers.status,
      authorizationNote: dealers.authorizationNote,
      authorizationDate: dealers.authorizationDate,
      deletedAt: dealers.deletedAt,
    })
    .from(listings)
    .innerJoin(dealers, eq(dealers.id, listings.dealerId))
    .where(eq(listings.id, listingId));
  if (!row) return null;
  const { fixturesRefusalReason } = await import("../../../../scripts/lib/dev-fixtures-core");
  return dealerPublishProblem(row, fixturesRefusalReason(process.env) === null);
}

export async function assertDealerCanPublish(listingId: number): Promise<void> {
  const problem = await listingPublishProblem(listingId);
  if (problem) throw new DealerNotAuthorizedError(problem);
}
