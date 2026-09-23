// Log estructurado de leads y CRM: una línea JSON por evento, como el resto
// del proyecto (cron, eventos). El handler traga los errores del CRM por
// diseño (INTEGRATIONS.md §2.7 regla 5): el fallo queda acá y en la base.
// Nunca se loguean el teléfono, el email ni la API key.

export function leadLog(level: "info" | "warn" | "error", msg: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, msg, ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
