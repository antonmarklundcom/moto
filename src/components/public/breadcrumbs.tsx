import Link from "next/link";
import { env } from "@/lib/env";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl, paths } from "@/lib/seo/routes";
import { JsonLd } from "./json-ld";
import { focusRing } from "./styles";

export type Crumb = { name: string; href: string };

/**
 * Migas de pan visibles + `BreadcrumbList` con los mismos datos (§6: todo
 * dato del JSON-LD está visible). "Inicio" se agrega solo; el último ítem es
 * la página actual y no es enlace.
 */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  const all: Crumb[] = [{ name: "Inicio", href: paths.home }, ...items];
  const siteUrl = env.siteUrl();
  return (
    <>
      <nav aria-label="Migas de pan" className="py-2 text-sm text-neutral-700">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((item, index) => {
            const last = index === all.length - 1;
            return (
              <li key={item.href} className="inline-flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className="text-neutral-900">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.href} className={`inline-flex min-h-11 items-center underline underline-offset-2 ${focusRing}`}>
                      {item.name}
                    </Link>
                    <span aria-hidden="true">›</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(all.map((c) => ({ name: c.name, url: absoluteUrl(c.href, siteUrl) })))} />
    </>
  );
}
