import Link from "next/link";
import { paths } from "@/lib/seo/routes";
import { SITE_NAME } from "@/lib/seo/site";
import { PrimaryNav } from "./nav";
import { container, focusRing, primaryButton, tapTarget } from "./styles";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-300 bg-white">
      <div className={`${container} flex flex-wrap items-center justify-between gap-2 py-2`}>
        <Link href={paths.home} className={`${tapTarget} text-lg font-bold text-neutral-900 ${focusRing}`}>
          {SITE_NAME}
        </Link>
        <PrimaryNav />
        <Link href={paths.publish} className={primaryButton}>
          Publicá tu moto
        </Link>
      </div>
    </header>
  );
}
