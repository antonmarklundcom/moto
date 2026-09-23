import Link from "next/link";
import { paths } from "@/lib/seo/routes";
import { focusRing, tapTarget } from "./styles";

// Navegación principal (C1, SEO_ARCHITECTURE.md §8): sólo páginas que no
// dependen del umbral. `/motos/en-cuotas` y los cruces quedan fuera hasta que
// pasen el umbral: se enlazan desde la home y los filtros (contextuales).
export const PRIMARY_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: paths.motos, label: "Motos" },
  { href: paths.financing, label: "Financiación" },
  { href: paths.dealers, label: "Comercios" },
  { href: paths.howItWorks, label: "Cómo funciona" },
];

export function PrimaryNav() {
  return (
    <nav aria-label="Principal">
      <ul className="-mx-1 flex items-center gap-x-1 overflow-x-auto sm:gap-x-2">
        {PRIMARY_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`${tapTarget} whitespace-nowrap rounded-md px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 ${focusRing}`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
