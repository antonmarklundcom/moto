// Tipo real de un archivo por sus primeros bytes (TEST_PLAN.md §9,
// TRUST_AND_SAFETY.md). Nunca se confía en la extensión ni en el Content-Type
// que manda el navegador. SVG y cualquier otra cosa quedan fuera.

export type SniffedType = "jpeg" | "png" | "webp" | "heic";

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

function ascii(buf: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...buf.subarray(start, end));
}

export function sniffImageType(buf: Uint8Array): SniffedType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf[0] === 0x89 && ascii(buf, 1, 4) === "PNG" &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "png";
  }
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "webp";
  // ISO BMFF: [tamaño 4 bytes]["ftyp"][marca mayor]. AVIF ("avif") no se acepta.
  if (ascii(buf, 4, 8) === "ftyp" && HEIC_BRANDS.has(ascii(buf, 8, 12))) return "heic";
  return null;
}
