import { adminSection } from "@/lib/auth/admin-sections";
import { requirePageRole } from "@/lib/auth/session";
import { configSnapshot } from "@/components/admin/ops/config";
import { ConfigView } from "@/components/admin/ops/config-view";

// Configuración (ADMIN_SPEC.md §11, ADR-22): sólo lectura. Las variables de
// entorno del slot son la única fuente de verdad.
const section = adminSection("config");

export default async function Page() {
  const user = await requirePageRole("/admin/config", ...section.roles);
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <ConfigView c={await configSnapshot(user)} />
    </main>
  );
}
