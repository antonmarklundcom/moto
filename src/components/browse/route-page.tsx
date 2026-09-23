import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageMetadata, withPageSuffix } from "@/lib/seo/meta";
import { BrowsePage } from "./browse-page";
import { type BrowseRoute, loadBrowse, queryKeyOf } from "./data";

// Cableado común de las rutas de B1: cada page.tsx sólo arma su BrowseRoute.
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function data(route: BrowseRoute, searchParams: SearchParams) {
  return loadBrowse(JSON.stringify(route), queryKeyOf(await searchParams));
}

export async function browseMetadata(route: BrowseRoute | null, searchParams: SearchParams): Promise<Metadata> {
  if (!route) return {};
  const d = await data(route, searchParams);
  if (d.status !== "ok") return {};
  return pageMetadata({
    title: withPageSuffix(d.copy.title, d.seo.page),
    description: d.copy.description,
    canonical: d.seo.canonical,
    robots: d.seo.robots,
    image: d.search.items[0]?.image
      ? { url: d.search.items[0].image.url, alt: d.search.items[0].image.alt ?? d.search.items[0].title }
      : null,
  });
}

export async function BrowseRoutePage({ route, searchParams }: { route: BrowseRoute | null; searchParams: SearchParams }) {
  if (!route) notFound();
  const d = await data(route, searchParams);
  if (d.status === "not_found") notFound();
  if (d.status === "redirect") redirect(d.location);
  return <BrowsePage data={d} />;
}
