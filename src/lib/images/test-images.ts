// Imágenes sintéticas para las pruebas del pipeline (nunca en producción).
import sharp from "sharp";

/** JPEG con ruido (para que el WebP no sea trivial), EXIF con GPS y orientación opcional. */
export async function jpegWithGps(width: number, height: number, orientation?: number): Promise<Buffer> {
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919 + (i >> 5) * 31) % 251;
  let img = sharp(noise, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 85 })
    .withExif({
      IFD0: { Make: "TestCam", Model: "Moto-GPS-Test" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "25/1 17/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "57/1 38/1 0/1" },
    });
  if (orientation) img = img.withMetadata({ orientation });
  return img.toBuffer();
}

export async function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer();
}
