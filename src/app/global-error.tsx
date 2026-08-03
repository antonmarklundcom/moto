"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-PY">
      <body className="antialiased">
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Algo salió mal</h1>
          <p className="text-base text-neutral-600">
            Tuvimos un problema técnico. Probá de nuevo en unos minutos.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
