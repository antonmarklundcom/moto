import { describe, expect, it } from "vitest";
import { sniffImageType } from "./sniff";

const b = (...parts: (number[] | string | Buffer)[]) =>
  Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.isBuffer(p) ? p : Buffer.from(p))));
const pad = Buffer.alloc(16);

describe("sniffImageType", () => {
  it("reconoce JPEG, PNG, WebP y HEIC por los bytes", () => {
    expect(sniffImageType(b([0xff, 0xd8, 0xff, 0xe0], pad))).toBe("jpeg");
    expect(sniffImageType(b([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], pad))).toBe("png");
    expect(sniffImageType(b("RIFF", [1, 2, 3, 4], "WEBP", pad))).toBe("webp");
    expect(sniffImageType(b([0, 0, 0, 24], "ftypheic", pad))).toBe("heic");
  });

  it("rechaza SVG, AVIF, texto, ejecutables y archivos cortos", () => {
    expect(sniffImageType(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)></svg>          "))).toBeNull();
    expect(sniffImageType(b([0, 0, 0, 24], "ftypavif", pad))).toBeNull();
    expect(sniffImageType(b([0x4d, 0x5a, 0x90, 0], pad))).toBeNull(); // MZ (.exe)
    expect(sniffImageType(b([0x7f], "ELF", pad))).toBeNull();
    expect(sniffImageType(b([0xff, 0xd8, 0xff]))).toBeNull();
  });
});
