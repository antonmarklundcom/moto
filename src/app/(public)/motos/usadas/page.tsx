import type { Metadata } from "next";
import { type BrowseRoute, browseRouteFrom } from "@/components/browse/route";
import { browseMetadata, BrowseRoutePage, type SearchParams } from "@/components/browse/route-page";

// Condición: usadas (T-106).
type Props = { searchParams: SearchParams };

function route(): BrowseRoute | null {
  return browseRouteFrom(["usadas"], "condition");
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return browseMetadata(await route(), searchParams);
}

export default async function Page({ searchParams }: Props) {
  return <BrowseRoutePage route={await route()} searchParams={searchParams} />;
}
