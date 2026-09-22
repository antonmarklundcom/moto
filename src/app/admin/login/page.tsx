import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeAdminNext } from "@/lib/auth/admin-sections";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar al panel | moto.com.py",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeAdminNext(next);
  if (await getSessionUser()) redirect(target);

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Entrar al panel</h1>
      <LoginForm next={target} />
      <p className="text-sm text-gray-700">
        El panel es sólo para el equipo de moto.com.py y los comercios. Si olvidaste la contraseña, pedísela al
        administrador.
      </p>
    </main>
  );
}
