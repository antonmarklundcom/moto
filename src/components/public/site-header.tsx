import Link from "next/link";
import { paths } from "@/lib/seo/routes";
import { SITE_NAME } from "@/lib/seo/site";
import { PrimaryNav } from "./nav";
import { container, focusRing, primaryButton, tapTarget } from "./styles";

/** Marca en texto (sin logo de imagen: nada que autorizar ni que cargar). */
function Wordmark() {
  const [name, ...rest] = SITE_NAME.split(".");
  return (
    <span className="text-xl font-extrabold tracking-tight text-slate-900">
      {name}
      <span className="text-orange-700">.{rest.join(".")}</span>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className={`${container} flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2`}>
        <Link href={paths.home} className={`${tapTarget} ${focusRing}`} aria-label={`${SITE_NAME}, inicio`}>
          <Wordmark />
        </Link>
        <div className="order-3 w-full sm:order-2 sm:w-auto">
          <PrimaryNav />
        </div>
        <Link href={paths.publish} className={`${primaryButton} order-2 sm:order-3`}>
          Publicá tu moto
        </Link>
      </div>
    </header>
  );
}
