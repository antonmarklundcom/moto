import type { Metadata } from "next";
import { type BrowseRoute, browseRouteFrom } from "@/components/browse/route";
import { browseMetadata, BrowseRoutePage, type SearchParams } from "@/components/browse/route-page";

// Listado general con buscador (T-103). El formulario de filtros llega acá y se redirige a la URL limpia.
type Props = { searchParams: SearchParams };

function route(): BrowseRoute | null {
  return browseRouteFrom([], "motos");
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return browseMetadata(await route(), searchParams);
}

export default async function Page({ searchParams }: Props) {
  return <BrowseRoutePage route={await route()} searchParams={searchParams} />;
}
