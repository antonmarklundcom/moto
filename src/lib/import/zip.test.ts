import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { isZip, readZip, ZipError } from "./zip";

/** Zip mínimo (sin CRC válido: el lector no lo usa) para probar el lector. */
function makeZip(entries: Array<{ name: string; data: Buffer; deflate?: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const body = e.deflate ? deflateRawSync(e.data) : e.data;
    const name = Buffer.from(e.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(e.deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(e.deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

describe("readZip", () => {
  it("lee entradas stored y deflate; saltea carpetas, __MACOSX y ocultos", () => {
    const big = Buffer.alloc(50_000, 7);
    const zip = makeZip([
      { name: "fotos/", data: Buffer.alloc(0) },
      { name: "fotos/HX-1.jpg", data: Buffer.from("uno") },
      { name: "fotos/HX-1-2.jpg", data: big, deflate: true },
      { name: "__MACOSX/fotos/._HX-1.jpg", data: Buffer.from("x") },
      { name: "fotos/.DS_Store", data: Buffer.from("x") },
    ]);
    expect(isZip(zip)).toBe(true);
    const entries = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["fotos/HX-1.jpg", "fotos/HX-1-2.jpg"]);
    expect(entries[0].data.toString()).toBe("uno");
    expect(entries[1].data.equals(big)).toBe(true);
  });

  it("corta una entrada que se infla más del tope (zip bomb) y rechaza lo que no es zip", () => {
    const zip = makeZip([{ name: "a.jpg", data: Buffer.alloc(200_000), deflate: true }]);
    expect(() => readZip(zip, { maxEntryBytes: 100_000 })).toThrow(ZipError);
    expect(() => readZip(Buffer.from("no soy un zip, sólo texto largo........................"))).toThrow(ZipError);
    expect(isZip(Buffer.from("PK"))).toBe(false);
  });
});
