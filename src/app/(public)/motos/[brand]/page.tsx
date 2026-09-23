import type { Metadata } from "next";
import { type BrowseRoute, browseRouteFrom } from "@/components/browse/route";
import { browseMetadata, BrowseRoutePage, type SearchParams } from "@/components/browse/route-page";

// Marca (T-106). Exemplar de la plantilla única de src/components/browse.
type Props = { params: Promise<{ brand: string }>; searchParams: SearchParams };

async function route(params: Props["params"]): Promise<BrowseRoute | null> {
  const p = await params;
  return browseRouteFrom([p.brand], "brand");
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return browseMetadata(await route(params), searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  return <BrowseRoutePage route={await route(params)} searchParams={searchParams} />;
}
