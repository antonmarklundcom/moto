// Hashes de identificadores que nunca se guardan en claro (IPs, sesiones;
// LEGAL_AND_COMPLIANCE.md; listing_events.ip_hash, reports.reporter_ip_hash)
// y la clave de idempotencia de leads (ADR-25). Salida hexadecimal de 64
// caracteres: cabe en los CHAR(64) del esquema.

import { createHash, createHmac } from "node:crypto";

/**
 * HMAC-SHA256 de `value` con `salt` como clave (F-6). Es el primitivo
 * correcto para seudonimizar IPs: sin la sal no se puede recorrer el espacio
 * de IPv4 para revertir el hash.
 */
export function hashWithSalt(value: string, salt: string): string {
  if (!salt) {
    throw new Error("hashWithSalt: falta la sal");
  }
  return createHmac("sha256", salt).update(value).digest("hex");
}

/** SHA-256 en hexadecimal, sin clave. Para contenido (fotos) y claves derivadas. */
export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** "YYYY-MM-DD-HH" en UTC. La franja horaria de la clave de idempotencia. */
export function utcHourBucket(date: Date): string {
  const iso = date.toISOString(); // 2026-09-22T21:45:00.000Z
  return `${iso.slice(0, 10)}-${iso.slice(11, 13)}`;
}

/**
 * Clave de idempotencia de un lead (ADR-25, reemplaza la fórmula de
 * INTEGRATIONS.md §2.4 anterior):
 * `sha256(phone_e164 + "|" + type + "|" + YYYY-MM-DD-HH)`.
 *
 * Colapsa el doble clic y el reintento tras timeout, pero una consulta de
 * financiación y otra de seguro de la misma persona en la misma hora son dos
 * leads distintos (antes el segundo se perdía por el UNIQUE de `leads`).
 * La hora es UTC para que la clave no dependa de la zona del servidor.
 */
export function leadIdempotencyKey(phoneE164: string, type: string, at: Date = new Date()): string {
  if (!/^\+\d{8,15}$/.test(phoneE164)) {
    throw new Error(`leadIdempotencyKey: teléfono no está en E.164: ${phoneE164}`);
  }
  if (!type) {
    throw new Error("leadIdempotencyKey: falta el tipo de lead");
  }
  return sha256Hex(`${phoneE164}|${type}|${utcHourBucket(at)}`);
}
