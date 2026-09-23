// `?error=campo` de la redirección sin JS de A4 → mensaje junto al campo.
import { LEAD_MESSAGES } from "@/lib/leads/handler";
import { LEAD_ERRORS } from "@/lib/leads/validate";

const BY_FIELD: Record<string, string> = {
  telefono: `${LEAD_ERRORS.telefonoVacio} ${LEAD_ERRORS.telefonoInvalido}`,
  email: LEAD_ERRORS.email,
  entrega_gs: LEAD_ERRORS.entrega,
  plazo_meses: LEAD_ERRORS.plazo,
  situacion_laboral: LEAD_ERRORS.situacion,
  anio: LEAD_ERRORS.anio,
  cantidad_motos: LEAD_ERRORS.cantidad,
};

export function errorsFromQuery(error: string | undefined): Record<string, string> {
  if (!error) return {};
  if (error === "limite") return { _general: LEAD_MESSAGES.limite };
  if (error === "servidor") return { _general: LEAD_MESSAGES.servidor };
  const message = BY_FIELD[error];
  return message ? { [error]: message, _general: "Revisá el campo marcado." } : { _general: "Revisá los datos y probá de nuevo." };
}
