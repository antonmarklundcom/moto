// Puro: IP del visitante → bytes de `listings.submitted_ip`.
import { isIP } from "node:net";

/** IP → bytes para `listings.submitted_ip` (VARBINARY(16)): 4 bytes IPv4, 16 IPv6. */
export function packIp(ip: string | null): Buffer | null {
  if (!ip) return null;
  const v = isIP(ip);
  if (v === 4) return Buffer.from(ip.split(".").map(Number));
  if (v === 6) {
    const [head, tail = ""] = ip.split("::");
    const parse = (s: string) => (s ? s.split(":") : []);
    let parts = [...parse(head)];
    const tailParts = parse(tail);
    // IPv4 embebida al final (::ffff:1.2.3.4).
    const last = tailParts.length ? tailParts[tailParts.length - 1] : parts[parts.length - 1];
    if (last?.includes(".")) {
      const b = last.split(".").map(Number);
      const hex = [((b[0] << 8) | b[1]).toString(16), ((b[2] << 8) | b[3]).toString(16)];
      if (tailParts.length) tailParts.splice(-1, 1, ...hex);
      else parts.splice(-1, 1, ...hex);
    }
    const fill = ip.includes("::") ? Array(8 - parts.length - tailParts.length).fill("0") : [];
    parts = [...parts, ...fill, ...tailParts];
    const buf = Buffer.alloc(16);
    parts.forEach((p, i) => buf.writeUInt16BE(parseInt(p || "0", 16), i * 2));
    return buf;
  }
  return null;
}

