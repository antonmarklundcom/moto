import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-base text-neutral-600">
        No encontramos lo que buscabas. Puede que el aviso haya vencido o que
        la dirección esté mal escrita.
      </p>
      <Link href="/" className="text-blue-700 underline underline-offset-2">
        Volver al inicio
      </Link>
    </main>
  );
}
