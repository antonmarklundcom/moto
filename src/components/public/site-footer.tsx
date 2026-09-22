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
    <footer className="mt-12 border-t border-neutral-300 bg-neutral-100 text-neutral-800">
      <div className={`${container} flex flex-col gap-3 py-6`}>
        <nav aria-label="Pie de página">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`${tapTarget} underline-offset-2 hover:underline ${focusRing}`}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* Sin textos de alcance legal acá (LEGAL_AND_COMPLIANCE.md §10): los pone B10/el propietario. */}
        <p className="text-sm">{SITE_NAME} · Motos nuevas y usadas en Paraguay.</p>
      </div>
    </footer>
  );
}
