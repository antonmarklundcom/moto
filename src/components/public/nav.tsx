import Link from "next/link";
import { paths } from "@/lib/seo/routes";
import { focusRing, tapTarget } from "./styles";

// Navegación principal. C1 (link pass) la completa según SEO_ARCHITECTURE.md
// §8: nunca enlazar desde acá a una página noindex por umbral.
export const PRIMARY_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: paths.motos, label: "Motos" },
  { href: paths.financing, label: "Financiación" },
  { href: paths.howItWorks, label: "Cómo funciona" },
];

export function PrimaryNav() {
  return (
    <nav aria-label="Principal">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {PRIMARY_NAV.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={`${tapTarget} px-1 text-neutral-900 hover:underline ${focusRing}`}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
