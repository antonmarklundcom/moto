// Validación y re-encodeo de una foto subida (T-108, G-22). Todo lo que se
// guarda sale de `sharp`: nunca se sirve el archivo que mandó el navegador.
// El re-encodeo a WebP descarta EXIF/XMP/ICC (GPS incluido): sharp no copia
// metadatos salvo que se le pida con withMetadata/keepExif, y acá no se pide.
import "server-only";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { sha256Hex } from "@/lib/hash";
import { sniffImageType, type SniffedType } from "./sniff";
import { MAX_VARIANT_WIDTH, variantPath, variantPrefix, variantWidthsFor } from "./variants";

// Un solo proceso Node en un slot compartido: un hilo de libvips y sin caché
// de operaciones, para acotar la memoria. `[VERIFICAR: límite de memoria del
// slot de Hostinger]`.
sharp.concurrency(1);
sharp.cache(false);

/** Tamaño máximo del archivo subido. El cliente ya comprime a 1600 px (PRODUCT_SPEC §2.2). */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Tope de píxeles de entrada (≈ 8000 × 5000): frena bombas de descompresión. */
export const MAX_INPUT_PIXELS = 40_000_000;
/** Lado mínimo aceptado: menos que esto no sirve como foto de una moto. */
export const MIN_DIMENSION = 200;
export const WEBP_QUALITY = 72;

export type UploadErrorCode = "too_large" | "unsupported_type" | "unreadable" | "too_small" | "bad_shape" | "too_many";

/** Proporción máxima (lado largo / lado corto). Una tira de 200 × 40 000 no es una foto. */
export const MAX_ASPECT = 4;

export class UploadError extends Error {
  constructor(
    readonly code: UploadErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type ProcessedVariant = { width: number; height: number; path: string; data: Buffer };

export type ProcessedImage = {
  /** Tipo detectado por bytes. */
  sourceType: SniffedType;
  /** SHA-256 del archivo original tal como llegó (`content_hash`, duplicados). */
  contentHash: string;
  /** Ruta de la variante mayor (`storage_path`). */
  storagePath: string;
  width: number;
  height: number;
  /** Bytes de la variante mayor. */
  bytes: number;
  variants: ProcessedVariant[];
};

const SHARP_FORMAT: Record<SniffedType, string[]> = {
  jpeg: ["jpeg"],
  png: ["png"],
  webp: ["webp"],
  heic: ["heif"],
};

export async function processUpload(input: Buffer): Promise<ProcessedImage> {
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new UploadError("too_large", 413, "La foto pesa demasiado. Probá con una de menos de 12 MB.");
  }
  const sourceType = sniffImageType(input);
  if (!sourceType) {
    throw new UploadError("unsupported_type", 415, "Ese archivo no es una foto. Subí una foto JPG, PNG o WebP.");
  }

  const open = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", pages: 1 });

  let meta: Metadata;
  try {
    meta = await open().metadata();
  } catch {
    // HEIC de iPhone (HEVC) no viene en el binario precompilado de sharp: cae acá.
    throw new UploadError(
      sourceType === "heic" ? "unsupported_type" : "unreadable",
      415,
      sourceType === "heic"
        ? "No podemos leer fotos HEIC. Elegí la foto desde la galería como JPG, o sacale una captura."
        : "No pudimos leer esa foto. Probá con otra.",
    );
  }
  // El formato que ve libvips tiene que coincidir con el de los bytes.
  if (!meta.format || !SHARP_FORMAT[sourceType].includes(meta.format)) {
    throw new UploadError("unsupported_type", 415, "Ese archivo no es una foto. Subí una foto JPG, PNG o WebP.");
  }

  // Orientación EXIF aplicada antes de descartarla, para que la foto no quede de costado.
  let base: { data: Buffer; info: OutputInfo };
  try {
    base = await open()
      .rotate()
      .resize({ width: MAX_VARIANT_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      throw new UploadError("too_large", 413, "La foto es demasiado grande. Probá con una de menos resolución.");
    }
    throw new UploadError("unreadable", 415, "No pudimos leer esa foto. Probá con otra.");
  }
  if (Math.min(base.info.width, base.info.height) < MIN_DIMENSION) {
    throw new UploadError("too_small", 422, "La foto es muy chica. Subí una de al menos 200 píxeles de lado.");
  }
  if (Math.max(base.info.width, base.info.height) > MAX_ASPECT * Math.min(base.info.width, base.info.height)) {
    throw new UploadError("bad_shape", 422, "La foto es demasiado angosta. Subí una foto normal, horizontal o vertical.");
  }

  const prefix = variantPrefix(sha256Hex(base.data));
  const variants: ProcessedVariant[] = [];
  for (const width of variantWidthsFor(base.info.width)) {
    if (width === base.info.width) {
      variants.push({ width, height: base.info.height, path: variantPath(prefix, width), data: base.data });
      continue;
    }
    const out = await sharp(base.data).resize({ width }).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    variants.push({ width: out.info.width, height: out.info.height, path: variantPath(prefix, width), data: out.data });
  }

  return {
    sourceType,
    contentHash: sha256Hex(input),
    storagePath: variantPath(prefix, base.info.width),
    width: base.info.width,
    height: base.info.height,
    bytes: base.data.length,
    variants,
  };
}
