import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";

// Stub de A1. La sección la construye su fase de lane 2 (BUILD_PLAN.md §5.2).
const section = adminSection("catalogo");

export default async function Page() {
  await requirePageRole("/admin/catalogo", ...section.roles);
  return (
    <main className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <p>En construcción.</p>
    </main>
  );
}
