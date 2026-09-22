import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processUpload, UploadError } from "./process";
import { jpegWithGps, png } from "./test-images";

async function rejects(buf: Buffer): Promise<UploadError> {
  try {
    await processUpload(buf);
  } catch (error) {
    expect(error).toBeInstanceOf(UploadError);
    return error as UploadError;
  }
  throw new Error("se esperaba un rechazo");
}

describe("processUpload (TEST_PLAN.md §9)", () => {
  it("borra el EXIF (GPS incluido) y re-encodea a WebP", async () => {
    const input = await jpegWithGps(2000, 1500);
    const inMeta = await sharp(input).metadata();
    expect(inMeta.exif?.includes(Buffer.from("TestCam"))).toBe(true);

    const out = await processUpload(input);
    expect(out.sourceType).toBe("jpeg");
    for (const v of out.variants) {
      const meta = await sharp(v.data).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(v.data.includes(Buffer.from("Exif"))).toBe(false);
      expect(v.data.includes(Buffer.from("TestCam"))).toBe(false);
    }
  });

  it("genera 320/640/1024/1600 con nombres por hash y guarda las medidas", async () => {
    const out = await processUpload(await jpegWithGps(2000, 1500));
    expect(out.variants.map((v) => v.width)).toEqual([320, 640, 1024, 1600]);
    expect(out.variants.map((v) => v.height)).toEqual([240, 480, 768, 1200]);
    expect(out.width).toBe(1600);
    expect(out.height).toBe(1200);
    expect(out.storagePath).toMatch(/^listings\/[0-9a-f]{2}\/[0-9a-f]{32}-1600\.webp$/);
    expect(out.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const prefix = out.storagePath.replace(/-1600\.webp$/, "");
    expect(out.variants.map((v) => v.path)).toEqual([320, 640, 1024, 1600].map((w) => `${prefix}-${w}.webp`));
  });

  it("no agranda una foto chica: la mayor lleva su ancho real", async () => {
    const out = await processUpload(await png(900, 600));
    expect(out.sourceType).toBe("png");
    expect(out.variants.map((v) => v.width)).toEqual([320, 640, 900]);
    expect(out.storagePath).toMatch(/-900\.webp$/);
  });

  it("aplica la orientación EXIF antes de descartarla", async () => {
    const out = await processUpload(await jpegWithGps(800, 600, 6));
    expect([out.width, out.height]).toEqual([600, 800]);
  });

  it("el mismo archivo da los mismos nombres (inmutables)", async () => {
    const input = await png(700, 500);
    expect((await processUpload(input)).storagePath).toBe((await processUpload(input)).storagePath);
  });

  it("rechaza un ejecutable renombrado a .jpg, texto y SVG", async () => {
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(4096, 1)]);
    expect((await rejects(exe)).code).toBe("unsupported_type");
    expect((await rejects(Buffer.from("#!/bin/sh\necho hola > /tmp/x\n"))).status).toBe(415);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><script>alert(1)</script></svg>');
    expect((await rejects(svg)).code).toBe("unsupported_type");
  });

  it("rechaza un JPEG truncado, un HEIC ilegible, una foto chica y una tira", async () => {
    const jpeg = await jpegWithGps(600, 400);
    expect((await rejects(jpeg.subarray(0, 200))).status).toBe(415);
    const fakeHeic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(200)]);
    expect((await rejects(fakeHeic)).code).toBe("unsupported_type");
    expect((await rejects(await png(150, 150))).code).toBe("too_small");
    expect((await rejects(await png(2000, 300))).code).toBe("bad_shape");
  });

  it("rechaza archivos de más de 12 MB sin decodificarlos", async () => {
    const big = Buffer.concat([await png(300, 300), Buffer.alloc(12 * 1024 * 1024)]);
    expect((await rejects(big)).code).toBe("too_large");
  });
});
