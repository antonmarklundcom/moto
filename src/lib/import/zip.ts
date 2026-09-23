// Lector mínimo de .zip para las fotos del stock (G-18), sin dependencias:
// directorio central + entradas "stored" (0) o "deflate" (8) con zlib.
// Sin zip64, sin cifrado. Rechaza rutas raras; sólo devuelve archivos.
import { inflateRawSync } from "node:zlib";

export type ZipEntry = { name: string; data: Buffer };

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export function isZip(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

/**
 * Entradas del zip (sólo archivos; carpetas y `__MACOSX/` se saltan).
 * `maxEntryBytes` corta un archivo inflado demasiado grande (zip bomb).
 */
export function readZip(buf: Buffer, { maxEntries = 2_000, maxEntryBytes = 25 * 1024 * 1024 } = {}): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("El archivo no es un .zip válido.");
  const total = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || offset === 0xffffffff) throw new ZipError("Zip de más de 4 GB o 65.000 archivos: no soportado.");
  if (total > maxEntries) throw new ZipError(`El zip tiene ${total} archivos; el máximo es ${maxEntries}.`);

  const out: ZipEntry[] = [];
  for (let n = 0; n < total; n += 1) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CEN_SIG) throw new ZipError("El zip está dañado.");
    const flags = buf.readUInt16LE(offset + 8);
    const method = buf.readUInt16LE(offset + 10);
    const compressed = buf.readUInt32LE(offset + 20);
    const size = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const local = buf.readUInt32LE(offset + 42);
    const name = buf.toString(flags & 0x800 ? "utf8" : "latin1", offset + 46, offset + 46 + nameLen);
    offset += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/") || name.startsWith("__MACOSX/") || name.split("/").some((p) => p.startsWith("."))) continue;
    if (flags & 0x1) throw new ZipError(`«${name}» está cifrado.`);
    if (size > maxEntryBytes) throw new ZipError(`«${name}» es demasiado grande.`);
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== LOC_SIG) throw new ZipError("El zip está dañado.");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + compressed);
    if (raw.length !== compressed) throw new ZipError("El zip está incompleto.");
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) {
      try {
        data = inflateRawSync(raw, { maxOutputLength: maxEntryBytes });
      } catch {
        throw new ZipError(`No se pudo descomprimir «${name}».`);
      }
    } else throw new ZipError(`«${name}» usa una compresión no soportada.`);
    out.push({ name, data });
  }
  return out;
}
