import type { Metadata } from "next";
import Link from "next/link";
import { sectionsFor } from "@/lib/auth/admin-sections";
import { getSessionUser } from "@/lib/auth/session";
import { logoutAction } from "./login/actions";

// El panel nunca se indexa (ADMIN_SPEC.md §1). El Disallow de robots.txt es de A2/C1.
export const metadata: Metadata = {
  title: "Panel | moto.com.py",
  robots: { index: false, follow: false },
};

// Sesión y rol se leen en cada request: nada del panel se prerenderiza.
export const dynamic = "force-dynamic";

const ROLE_LABEL = { admin: "Administración", moderator: "Moderación", dealer: "Comercio", seller: "Vendedor" } as const;

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // El layout también envuelve al login: sin sesión se muestra sólo el contenido.
  // No es una puerta: cada página llama a requirePageRole().
  const user = await getSessionUser();
  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <a href="#contenido" className={`sr-only focus:not-sr-only focus:absolute focus:p-2 ${focus}`}>
        Saltar al contenido
      </a>
      <header className="border-b border-gray-300 bg-gray-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link href="/admin" className={`inline-flex min-h-11 items-center font-bold ${focus}`}>
            Panel moto.com.py
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span>
              {user.name} · {ROLE_LABEL[user.role]}
            </span>
            <form action={logoutAction}>
              <button type="submit" className={`min-h-11 rounded border border-gray-500 px-3 ${focus}`}>
                Salir
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Secciones del panel" className="mx-auto max-w-6xl px-4 pb-2">
          <ul className="flex flex-wrap gap-x-1 gap-y-1">
            {sectionsFor(user.role).map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/admin/${s.slug}`}
                  className={`inline-flex min-h-11 items-center rounded px-3 hover:bg-gray-200 ${focus}`}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <div id="contenido" className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </div>
    </div>
  );
}
