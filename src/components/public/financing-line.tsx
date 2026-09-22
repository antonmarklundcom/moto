import { formatFinancing } from "@/lib/format";

export type FinancingData = {
  downPaymentGs: number | null;
  installmentCount: number | null;
  installmentGs: number | null;
};

/** ¿Hay plan de cuotas completo? Sin los tres datos no se muestra nada (nada inventado). */
export function hasFinancingData(f: FinancingData): f is { downPaymentGs: number; installmentCount: number; installmentGs: number } {
  return f.downPaymentGs !== null && f.installmentCount !== null && f.installmentCount > 0 && f.installmentGs !== null;
}

/**
 * "Entrega Gs. 2.000.000 + 24 cuotas de Gs. 650.000", siempre con quién lo
 * informa: el sitio no calcula ni aprueba cuotas (ADR-03, CONTENT_STRATEGY.md).
 */
export function FinancingLine({
  financing,
  informedBy = "comercio",
  className = "",
}: {
  financing: FinancingData;
  informedBy?: "comercio" | "vendedor";
  className?: string;
}) {
  if (!hasFinancingData(financing)) return null;
  return (
    <p className={className}>
      <span className="font-semibold">{formatFinancing(financing)}</span>{" "}
      <span className="text-sm text-neutral-700">(informado por el {informedBy})</span>
    </p>
  );
}
