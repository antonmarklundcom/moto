// Hash con sal, para IPs y otros identificadores que nunca se guardan en
// claro (LEGAL_AND_COMPLIANCE.md; listing_events.ip_hash, reports.reporter_ip_hash).
// SHA-256, salida hexadecimal de 64 caracteres — cabe en los CHAR(64) del
// esquema.

import { createHash } from "node:crypto";

/**
 * Hashea `value` concatenado con `salt` usando SHA-256, en hexadecimal.
 * Nunca guarda el valor original, sólo el hash.
 */
export function hashWithSalt(value: string, salt: string): string {
  if (!salt) {
    throw new Error("hashWithSalt: falta la sal");
  }
  return createHash("sha256").update(`${value}|${salt}`).digest("hex");
}
