"use client";

// Error de una ruta (F-13). A diferencia de global-error.tsx, conserva el
// layout raíz. Nunca muestra el mensaje técnico al visitante; el digest sirve
// para buscar el error en los logs del servidor.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-base text-neutral-700">
        Tuvimos un problema técnico al cargar esta página. Probá de nuevo en unos minutos.
      </p>
      {error.digest ? (
        <p className="text-sm text-neutral-700">Código del error: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="min-h-11 rounded-md border border-neutral-400 px-4 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Reintentar
      </button>
    </main>
  );
}
