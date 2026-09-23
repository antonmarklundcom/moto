import { formatGuaranies } from "@/lib/format";
import { hasFinancingData, type FinancingData } from "./financing-line";

export type PriceData = FinancingData & {
  priceGs: number | null;
  hasFinancingOnly: boolean;
};

/**
 * Precio de una publicación (PRODUCT_SPEC.md §3.2): "Gs. 12.500.000", o si el
 * precio de contado no fue informado, "Desde Gs. X/mes". Nunca un precio
 * calculado ni estimado.
 */
export function Price({ data, className = "" }: { data: PriceData; className?: string }) {
  const cash = data.hasFinancingOnly ? null : formatGuaranies(data.priceGs);
  if (cash) {
    return <p className={`text-xl font-bold text-neutral-900 ${className}`}>{cash}</p>;
  }
  // Con cuota y cantidad alcanza para "Desde X/mes" (stock importado sin entrega, B3): sigue siendo lo informado.
  if (hasFinancingData(data) || (data.installmentGs !== null && data.installmentCount !== null && data.installmentCount > 0)) {
    return (
      <p className={`text-xl font-bold text-neutral-900 ${className}`}>
        Desde {formatGuaranies(data.installmentGs)}/mes
        <span className="block text-sm font-normal text-neutral-700">Precio de contado no informado</span>
      </p>
    );
  }
  return <p className={`text-base text-neutral-700 ${className}`}>Precio no informado</p>;
}
