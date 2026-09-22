import Link from "next/link";
import { ADMIN_AREA_ROLES } from "@/lib/auth/roles";
import { sectionsFor } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const user = await requirePageRole("/admin", ...ADMIN_AREA_ROLES);
  const { aviso } = await searchParams;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Panel</h1>
      {aviso === "sin-permiso" ? (
        <p role="alert" className="rounded border border-amber-700 bg-amber-50 p-3 text-amber-900">
          No tenés permiso para entrar a esa sección.
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {sectionsFor(user.role).map((s) => (
          <li key={s.slug}>
            <Link
              href={`/admin/${s.slug}`}
              className="inline-flex min-h-11 items-center underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
