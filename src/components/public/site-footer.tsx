import Link from "next/link";
import { paths } from "@/lib/seo/routes";
import { SITE_NAME } from "@/lib/seo/site";
import { container, focusRing, tapTarget } from "./styles";

const FOOTER_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: paths.howItWorks, label: "Cómo funciona" },
  { href: paths.guides, label: "Guías" },
  { href: paths.dealers, label: "Comercios" },
  { href: paths.contact, label: "Contacto" },
  { href: paths.terms, label: "Términos" },
  { href: paths.privacy, label: "Privacidad" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-slate-900 text-slate-200">
      <div className={`${container} flex flex-col gap-4 py-8`}>
        <nav aria-label="Pie de página">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`${tapTarget} text-slate-100 underline-offset-2 hover:underline ${focusRing}`}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* Sin textos de alcance legal acá (LEGAL_AND_COMPLIANCE.md §10): los pone B10/el propietario. */}
        <p className="text-sm text-slate-300">
          <span className="font-bold text-white">{SITE_NAME}</span> · Motos nuevas y usadas en Paraguay.
        </p>
      </div>
    </footer>
  );
}
