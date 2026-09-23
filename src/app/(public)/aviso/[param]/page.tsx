import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import { loadListing } from "@/components/listing/data";
import { DetailPage } from "@/components/listing/detail-page";
import { listingDescription, listingTitle } from "@/components/listing/rules";
import { hasFinancingData } from "@/components/public/financing-line";
import { recordListingEvent } from "@/lib/events";
import { formatFinancing, formatGuaranies, groupThousands } from "@/lib/format";
import { isListingIndexable } from "@/lib/seo/indexability";
import { pageMetadata, robots } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";

// Ficha `/aviso/<slug>-<ref>` (T-104, SEO_ARCHITECTURE.md §4).
type Props = {
  params: Promise<{ param: string }>;
  searchParams: Promise<{ denuncia?: string }>;
};

function redirectFor(d: Awaited<ReturnType<typeof loadListing>>): string | null {
  if (d.status === "wrong_slug") return paths.listing(d.listing);
  if (d.status === "redirect") {
    return d.location.modelSlug ? paths.model(d.location.brandSlug, d.location.modelSlug) : paths.brand(d.location.brandSlug);
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await loadListing((await params).param);
  if (d.status !== "ok") return {};
  const l = d.listing;
  const cash = l.hasFinancingOnly ? null : formatGuaranies(l.priceGs);
  const monthly = !cash && l.installmentGs ? `${formatGuaranies(l.installmentGs)}/mes` : null;
  const financing = hasFinancingData(l) ? formatFinancing(l) : null;
  const firstImage = l.images[0];
  return pageMetadata({
    title: listingTitle({
      brandName: l.brand.name,
      modelName: l.model?.name ?? null,
      modelRaw: l.modelRaw,
      year: l.year,
      priceText: cash ?? monthly,
      cityName: l.city.name,
    }),
    description: listingDescription({
      condition: l.condition,
      mileageKm: l.mileageKm,
      kmText: l.mileageKm !== null ? `${groupThousands(l.mileageKm)} km` : null,
      cityName: l.city.name,
      financingText: financing,
      whatsapp: l.contactWhatsapp,
    }),
    canonical: paths.listing(l),
    robots: robots(isListingIndexable({ status: l.status, soldAt: l.soldAt })),
    image: firstImage ? { url: firstImage.url, width: firstImage.width ?? undefined, height: firstImage.height ?? undefined, alt: l.title } : null,
  });
}

export default async function Page({ params, searchParams }: Props) {
  const { param } = await params;
  const d = await loadListing(param);
  const location = redirectFor(d);
  if (location) permanentRedirect(location);
  // Borrada: Next no deja responder 410 desde una página; sale 404 (ver docs/log/B3.md).
  if (d.status !== "ok") notFound();

  // Evento `view` después de responder; nunca en un prefetch del router.
  const h = await headers();
  const prefetch = h.get("next-router-prefetch") || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch");
  if (!prefetch) {
    const snapshot = new Headers(h);
    const listingId = d.listing.id;
    const dealerId = d.listing.dealer?.id ?? null;
    const pagePath = paths.listing(d.listing);
    after(() => recordListingEvent({ type: "view", listingId, dealerId, headers: snapshot, pagePath }));
  }

  const { denuncia } = await searchParams;
  return <DetailPage data={d} reportResult={denuncia === "ok" ? "ok" : denuncia === "error" ? "error" : null} />;
}
