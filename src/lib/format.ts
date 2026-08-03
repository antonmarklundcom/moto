// Formato de guaraníes y de financiación (ADR-06: dinero como entero, nunca
// FLOAT ni DECIMAL con centavos). Ver CONTENT_STRATEGY.md §1 para el estilo
// exacto de los textos ("Gs. 12.500.000", "Entrega Gs. 2.000.000 + 24 cuotas
// de Gs. 650.000").

/**
 * Formatea un monto en guaraníes como "Gs. 12.500.000".
 * `null`/`undefined` (precio no informado) devuelven `null` en vez de una
 * cadena vacía, para que quien llama decida el texto del estado vacío.
 */
export function formatGuaranies(amountGs: number | null | undefined): string | null {
  if (amountGs === null || amountGs === undefined) {
    return null;
  }
  if (!Number.isInteger(amountGs) || amountGs < 0) {
    throw new Error(`formatGuaranies: monto inválido: ${amountGs}`);
  }
  return `Gs. ${amountGs.toLocaleString("es-PY")}`;
}

export type FinancingTerms = {
  downPaymentGs: number;
  installmentCount: number;
  installmentGs: number;
};

/**
 * Formatea un plan de cuotas como "Entrega Gs. 2.000.000 + 24 cuotas de
 * Gs. 650.000" (CONTENT_STRATEGY.md §1.5).
 */
export function formatFinancing(terms: FinancingTerms): string {
  const { downPaymentGs, installmentCount, installmentGs } = terms;
  if (!Number.isInteger(installmentCount) || installmentCount <= 0) {
    throw new Error(`formatFinancing: cantidad de cuotas inválida: ${installmentCount}`);
  }
  const downPayment = formatGuaranies(downPaymentGs);
  const installment = formatGuaranies(installmentGs);
  if (downPayment === null || installment === null) {
    throw new Error("formatFinancing: entrega y cuota son obligatorias");
  }
  return `Entrega ${downPayment} + ${installmentCount} cuotas de ${installment}`;
}
