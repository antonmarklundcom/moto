// Autorización de POST /api/cron/[job]: `Authorization: Bearer <CRON_SECRET>`,
// comparado en tiempo constante. Sin CRON_SECRET → 503 (ADR-19).
import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuth = "ok" | "unconfigured" | "unauthorized";

export function checkCronAuth(authorization: string | null, secret: string | null): CronAuth {
  if (!secret) return "unconfigured";
  const match = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  if (!match) return "unauthorized";
  // Se comparan hashes para que el largo no importe ni se filtre.
  const a = createHash("sha256").update(match[1]).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b) ? "ok" : "unauthorized";
}
