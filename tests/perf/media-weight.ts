// Peso de una ficha con 5 fotos (SEO_ARCHITECTURE.md §10: < 500 KB; foto de
// listado ≤ 40 KB). Uso: npx tsx --conditions react-server tests/perf/media-weight.ts
//
// No hay fotos reales en el repo: genera 5 imágenes 3000×2000 "tipo foto"
// (estructura suave + grano de sensor), más difíciles de comprimir que una
// foto real de una moto sobre fondo liso. C2 re-mide con fotos reales.
import sharp from "sharp";
import { processUpload } from "../../src/lib/images/process";
import { pickVariantWidth } from "../../src/lib/images/variants";

async function photoLike(seed: number): Promise<Buffer> {
  const W = 3000, H = 2000;
  const small = Buffer.alloc(60 * 40 * 3);
  for (let i = 0; i < small.length; i++) small[i] = (Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453 % 1 + 1) % 1 * 255;
  const smooth = await sharp(small, { raw: { width: 60, height: 40, channels: 3 } }).resize(W, H, { kernel: "cubic" }).raw().toBuffer();
  for (let i = 0; i < smooth.length; i++) {
    const grain = ((i * 2654435761 + seed * 97) >>> 0) % 25 - 12;
    smooth[i] = Math.max(0, Math.min(255, smooth[i] + grain));
  }
  return sharp(smooth, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
}

// Android de gama media: 412 CSS px de ancho, DPR 2,625.
const VIEWPORT = 412, DPR = 2.625;
const pageHtmlJsBytes = Number(process.argv[2] ?? 0);

async function main(): Promise<void> {
let total = 0;
const rows: string[] = [];
for (let i = 0; i < 5; i++) {
  const img = await processUpload(await photoLike(i + 1));
  const widths = img.variants.map((v) => v.width);
  // Foto principal a 100vw, las otras 4 a 50vw (galería de 2 columnas).
  const cssWidth = i === 0 ? VIEWPORT : VIEWPORT / 2;
  const w = pickVariantWidth(widths, Math.ceil(cssWidth * DPR));
  const bytes = img.variants.find((v) => v.width === w)!.data.length;
  total += bytes;
  const sizes = img.variants.map((v) => `${v.width}:${(v.data.length / 1024).toFixed(1)}KB`).join(" ");
  rows.push(`foto ${i + 1}: sirve ${w}w = ${(bytes / 1024).toFixed(1)} KB  (variantes ${sizes})`);
}
console.log(rows.join("\n"));
console.log(`imágenes: ${(total / 1024).toFixed(1)} KB; HTML+JS de la página: ${(pageHtmlJsBytes / 1024).toFixed(1)} KB`);
console.log(`total ficha: ${((total + pageHtmlJsBytes) / 1024).toFixed(1)} KB (presupuesto 500 KB)`);
}

void main();
