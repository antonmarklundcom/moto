// Resolución de a quién se contacta (INTEGRATIONS.md §1.1): publicación,
// comercio o el número general del sitio. Sólo lo publicado y activo; una
// publicación con `contact_whatsapp = false` ("solo llamadas", G-3) nunca
// tiene enlace de WhatsApp.
import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dealers, listings } from "@/db/schema";
import { env } from "@/lib/env";
import { isWhatsAppCapable } from "@/lib/phone";
import { absoluteUrl, paths } from "@/lib/seo/routes";
import { dealerWhatsAppMessage, generalWhatsAppMessage, listingWhatsAppMessage, waMeUrl } from "./whatsapp";

export type WhatsAppTarget = {
  kind: "listing" | "dealer" | "general";
  listingId: number | null;
  dealerId: number | null;
  /** https://wa.me/... listo para el 302. */
  location: string;
};

export async function listingWhatsAppTarget(listingId: number): Promise<WhatsAppTarget | null> {
  const [row] = await db
    .select({
      id: listings.id,
      dealerId: listings.dealerId,
      slug: listings.slug,
      publicRef: listings.publicRef,
      title: listings.title,
      priceGs: listings.priceGs,
      hasFinancingOnly: listings.hasFinancingOnly,
      downPaymentGs: listings.downPaymentGs,
      installmentGs: listings.installmentGs,
      installmentCount: listings.installmentCount,
      phone: listings.contactPhoneE164,
      contactWhatsapp: listings.contactWhatsapp,
    })
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.status, "published"), isNull(listings.deletedAt)))
    .limit(1);
  if (!row || !row.contactWhatsapp || !isWhatsAppCapable(row.phone)) return null;
  const message = listingWhatsAppMessage({
    title: row.title,
    priceGs: row.priceGs,
    hasFinancingOnly: row.hasFinancingOnly,
    downPaymentGs: row.downPaymentGs,
    installmentGs: row.installmentGs,
    installmentCount: row.installmentCount,
    url: absoluteUrl(paths.listing({ slug: row.slug, publicRef: row.publicRef }), env.siteUrl()),
  });
  return { kind: "listing", listingId: row.id, dealerId: row.dealerId, location: waMeUrl(row.phone, message) };
}

export async function dealerWhatsAppTarget(dealerId: number): Promise<WhatsAppTarget | null> {
  const [row] = await db
    .select({ id: dealers.id, name: dealers.name, slug: dealers.slug, phone: dealers.phoneE164 })
    .from(dealers)
    .where(and(eq(dealers.id, dealerId), eq(dealers.status, "active"), isNull(dealers.deletedAt)))
    .limit(1);
  if (!row || !isWhatsAppCapable(row.phone)) return null;
  const message = dealerWhatsAppMessage({ name: row.name, url: absoluteUrl(paths.dealer(row.slug), env.siteUrl()) });
  return { kind: "dealer", listingId: null, dealerId: row.id, location: waMeUrl(row.phone, message) };
}

/** Número general (ADR-21). Sin WHATSAPP_SITE_NUMBER válido → null (404 + log). */
export function generalWhatsAppTarget(texto: string | null): WhatsAppTarget | null {
  const phone = env.whatsappSiteNumber();
  if (!phone || !isWhatsAppCapable(phone)) return null;
  return { kind: "general", listingId: null, dealerId: null, location: waMeUrl(phone, generalWhatsAppMessage(texto)) };
}

/** Teléfono de una publicación publicada, por `public_ref`, para "Ver teléfono" / "Llamar". */
export async function listingPhone(publicRef: string) {
  const [row] = await db
    .select({ id: listings.id, dealerId: listings.dealerId, phone: listings.contactPhoneE164 })
    .from(listings)
    .where(and(eq(listings.publicRef, publicRef), eq(listings.status, "published"), isNull(listings.deletedAt)))
    .limit(1);
  return row ?? null;
}
