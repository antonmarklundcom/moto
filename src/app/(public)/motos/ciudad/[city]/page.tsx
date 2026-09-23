import type { Metadata } from "next";
import { type BrowseRoute, browseRouteFrom } from "@/components/browse/route";
import { browseMetadata, BrowseRoutePage, type SearchParams } from "@/components/browse/route-page";

// Ciudad (T-106).
type Props = { params: Promise<{ city: string }>; searchParams: SearchParams };

async function route(params: Props["params"]): Promise<BrowseRoute | null> {
  const p = await params;
  return browseRouteFrom(["ciudad", p.city], "city");
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return browseMetadata(await route(params), searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  return <BrowseRoutePage route={await route(params)} searchParams={searchParams} />;
}
