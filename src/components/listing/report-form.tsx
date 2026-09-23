import { focusRing, secondaryButton } from "@/components/public/styles";
import { REPORT_REASONS } from "./rules";

// Denuncia (PRODUCT_SPEC.md §2.4): discreta, sin registro, teléfono opcional.
// Formulario común (POST /api/reportes → 303 de vuelta): funciona sin JS.
const field = `min-h-11 w-full rounded border border-neutral-500 bg-white px-3 ${focusRing}`;

export function ReportForm({ publicRef, path, result }: { publicRef: string; path: string; result: "ok" | "error" | null }) {
  return (
    <section id="denunciar" aria-labelledby="denunciar-titulo" className="mt-8 border-t border-neutral-300 pt-4">
      {result === "ok" ? (
        <p role="status" className="mb-3 rounded border border-green-800 bg-green-50 p-3 text-green-900">
          Recibimos tu denuncia y la vamos a revisar.
        </p>
      ) : null}
      <details open={result === "error"}>
        <summary id="denunciar-titulo" className={`inline-flex min-h-11 cursor-pointer items-center text-sm text-neutral-800 underline ${focusRing}`}>
          Denunciar esta publicación
        </summary>
        <form method="post" action="/api/reportes" className="mt-3 flex max-w-prose flex-col gap-3">
          <input type="hidden" name="ref" value={publicRef.toLowerCase()} />
          <input type="hidden" name="volver" value={path} />
          <div aria-hidden="true" className="absolute -left-[9999px]">
            <label htmlFor="denuncia-website">No completar</label>
            <input id="denuncia-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          {result === "error" ? (
            <p role="alert" className="text-red-800">
              No pudimos registrar la denuncia. Revisá el motivo y probá de nuevo.
            </p>
          ) : null}
          <fieldset className="flex flex-col gap-1">
            <legend className="font-medium">¿Qué pasa con esta publicación?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.code} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="motivo" value={r.code} required className={`h-5 w-5 ${focusRing}`} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Contanos más (opcional; obligatorio si elegís «Otro motivo»)</span>
            <textarea name="detalle" rows={3} maxLength={2000} className={`${field} py-2`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Tu teléfono (opcional, por si necesitamos consultarte)</span>
            <input name="telefono" type="tel" inputMode="tel" autoComplete="tel" placeholder="0981 123 456" className={field} />
          </label>
          <p className="text-sm text-neutral-700">No le decimos al vendedor quién lo denunció.</p>
          <button type="submit" className={`${secondaryButton} self-start`}>
            Enviar denuncia
          </button>
        </form>
      </details>
    </section>
  );
}
