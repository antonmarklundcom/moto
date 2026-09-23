// Lectura de FormData para las acciones del admin. Puro.

export function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}

export const str = (v: Record<string, string>, k: string): string => (v[k] ?? "").trim();
export const optStr = (v: Record<string, string>, k: string): string | null => str(v, k) || null;
export const bool = (v: Record<string, string>, k: string): boolean => v[k] === "1" || v[k] === "on";

/** Entero ("9.500.000" → 9500000); vacío → null; inválido → NaN (la validación lo marca). */
export function int(v: Record<string, string>, k: string): number | null {
  const t = str(v, k).replace(/^gs\.?\s*/i, "").replace(/[.\s]/g, "");
  if (t === "") return null;
  return /^\d{1,15}$/.test(t) ? Number(t) : Number.NaN;
}
