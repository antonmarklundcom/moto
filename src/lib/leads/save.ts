// Guardar el lead (INTEGRATIONS.md §2, PRODUCT_SPEC.md §2.3): **primero** en
// nuestra base, después se responde al visitante y recién entonces se postea
// al CRM (deliver.ts). El lead no se pierde aunque el CRM esté caído.
//
// Idempotencia: `leadIdempotencyKey()` (ADR-25) + UNIQUE en
// `leads.idempotency_key`. Una colisión es el mismo lead (doble clic, reenvío
// del formulario dentro de la hora): se responde éxito y no se crea nada.
import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { brands, cities, dealers, leads, listings, models } from "@/db/schema";
import { CRM_SOURCE, type CrmFieldValue } from "@/lib/crm/payload";
import { recordListingEvent } from "@/lib/events";
import { leadIdempotencyKey } from "@/lib/hash";
import type { Attribution } from "./attribution";
import { consentTextVersion } from "./consent";
import { leadLog } from "./log";
import { LEAD_TYPE_SLUG, type PublicLeadType } from "./types";
import type { LeadSubmission } from "./validate";

/** Lo que queda en `leads.payload_json`; deliver.ts arma el payload del CRM con esto. */
export type LeadPayloadJson = {
  consent_text_version: string | null;
  source: string;
  listing_ref: string | null;
  fields: Record<string, CrmFieldValue>;
};

export type SaveLeadContext = {
  headers: Pick<Headers, "get">;
  attribution: Attribution;
  /** URL absoluta de la página del formulario, o null. */
  pageUrl: string | null;
  now?: Date;
};

export type SaveLeadResult = { leadId: number; duplicate: boolean; listingId: number | null; dealerId: number | null };

const DEFAULT_MESSAGE: Record<PublicLeadType, string> = {
  financing: "Consulta de financiación",
  insurance: "Consulta de seguro",
  dealer_plan: "Consulta de plan para comercio",
  advertising: "Consulta de publicidad",
};

function isDuplicateKey(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

/** Datos reales de la publicación, para el CRM. Sólo publicadas; si no, null. */
async function listingFacts(ref: string) {
  const [row] = await db
    .select({
      id: listings.id,
      dealerId: listings.dealerId,
      publicRef: listings.publicRef,
      year: listings.year,
      priceGs: listings.priceGs,
      modelRaw: listings.modelRaw,
      brand: brands.name,
      model: models.name,
      city: cities.name,
      dealer: dealers.name,
    })
    .from(listings)
    .innerJoin(brands, eq(brands.id, listings.brandId))
    .innerJoin(cities, eq(cities.id, listings.cityId))
    .leftJoin(models, eq(models.id, listings.modelId))
    .leftJoin(dealers, eq(dealers.id, listings.dealerId))
    .where(and(eq(listings.publicRef, ref), eq(listings.status, "published"), isNull(listings.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function saveLead(sub: LeadSubmission, ctx: SaveLeadContext): Promise<SaveLeadResult> {
  const now = ctx.now ?? new Date();
  const listing = sub.listingRef ? await listingFacts(sub.listingRef) : null;

  const fields: Record<string, CrmFieldValue> = { tipo_lead: LEAD_TYPE_SLUG[sub.type], ...sub.extras };
  if (listing) {
    const modelo = listing.model ?? listing.modelRaw;
    Object.assign(fields, {
      listing_ref: listing.publicRef,
      marca: listing.brand,
      ...(modelo ? { modelo } : {}),
      ...(listing.year !== null ? { anio: listing.year } : {}),
      ...(listing.priceGs !== null ? { precio_gs: listing.priceGs } : {}),
      // `ciudad` es la del visitante (la pide el formulario); ésta, la de la moto.
      ciudad_publicacion: listing.city,
      ...(listing.dealer ? { comercio: listing.dealer } : {}),
    });
  }

  const intro = listing ? `${DEFAULT_MESSAGE[sub.type]} desde la publicación ${listing.publicRef}` : DEFAULT_MESSAGE[sub.type];
  const message = sub.message ? `${intro}\n\n${sub.message}` : intro;

  const payloadJson: LeadPayloadJson = {
    consent_text_version: consentTextVersion(sub.type),
    source: CRM_SOURCE,
    listing_ref: listing?.publicRef ?? null,
    fields,
  };
  const idempotencyKey = leadIdempotencyKey(sub.phoneE164, sub.type, now);
  const a = ctx.attribution;

  try {
    const [res] = await db.insert(leads).values({
      type: sub.type,
      listingId: listing?.id ?? null,
      dealerId: listing?.dealerId ?? null,
      name: sub.name,
      phoneE164: sub.phoneE164,
      phoneRaw: sub.phoneRaw,
      email: sub.email,
      message: message.slice(0, 5000),
      payloadJson,
      utmSource: a.utmSource,
      utmMedium: a.utmMedium,
      utmCampaign: a.utmCampaign,
      utmTerm: a.utmTerm,
      utmContent: a.utmContent,
      gclid: a.gclid,
      fbclid: a.fbclid,
      pageUrl: ctx.pageUrl,
      // Primer toque externo de la cookie; si no, nada (el Referer de un
      // formulario es nuestra propia página, ya está en page_url).
      referrer: a.referrer,
      idempotencyKey,
      crmStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    const leadId = res.insertId;
    leadLog("info", "leads: lead guardado", { leadId, type: sub.type, listingId: listing?.id ?? null });
    await recordListingEvent({
      type: "lead_submit",
      listingId: listing?.id ?? null,
      dealerId: listing?.dealerId ?? null,
      headers: ctx.headers,
      pagePath: sub.pagePath,
      now,
    });
    return { leadId, duplicate: false, listingId: listing?.id ?? null, dealerId: listing?.dealerId ?? null };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const [existing] = await db
      .select({ id: leads.id, listingId: leads.listingId, dealerId: leads.dealerId })
      .from(leads)
      .where(eq(leads.idempotencyKey, idempotencyKey))
      .limit(1);
    if (!existing) throw error;
    leadLog("info", "leads: envío repetido, mismo lead", { leadId: existing.id, type: sub.type });
    return { leadId: existing.id, duplicate: true, listingId: existing.listingId, dealerId: existing.dealerId };
  }
}
