import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { container, linkClass } from "@/components/public/styles";
import { contentPageMetadata } from "@/lib/seo/meta";
import { paths } from "@/lib/seo/routes";
import { longDatePy, publishedGuides } from "./data";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return contentPageMetadata({
    title: "Guías para comprar y vender motos en Paraguay",
    description: "Guías prácticas para comprar, vender, transferir y financiar motos en Paraguay: papeles, cuotas, seguros y qué revisar antes de pagar.",
    canonical: paths.guides,
  });
}

export default async function Page() {
  const guides = await publishedGuides();
  return (
    <div className={container}>
      <Breadcrumbs items={[{ name: "Guías", href: paths.guides }]} />
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Guías para comprar y vender motos</h1>
      {guides.length === 0 ? (
        <div className="mt-4 max-w-prose">
          <p>Todavía no publicamos guías: las estamos revisando para que no tengan datos viejos ni inventados.</p>
          <p className="mt-2">
            Mientras tanto, mirá las{" "}
            <Link href={paths.motos} className={linkClass}>
              motos publicadas
            </Link>{" "}
            o{" "}
            <Link href={paths.publish} className={linkClass}>
              publicá la tuya gratis
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex max-w-prose flex-col gap-5">
          {guides.map((g) => (
            <li key={g.slug}>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                <Link href={paths.guide(g.slug)} className={linkClass}>
                  {g.title}
                </Link>
              </h2>
              {g.excerpt ? <p className="mt-1">{g.excerpt}</p> : null}
              <p className="mt-1 text-sm text-neutral-700">Actualizada el {longDatePy(g.updatedAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
