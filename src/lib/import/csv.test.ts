import { describe, expect, it } from "vitest";
import { CsvError, decodeCsvBytes, detectDelimiter, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("comillas con comas, comillas dobles y saltos de línea adentro; CRLF; BOM", () => {
    const text = '\uFEFFa,b,c\r\n1,"dos, tres","con ""comillas"""\r\n4,"línea\nnueva",6\r\n';
    const t = parseCsv(text);
    expect(t.headers).toEqual(["a", "b", "c"]);
    expect(t.rows).toEqual([
      { line: 2, cells: ["1", "dos, tres", 'con "comillas"'] },
      { line: 3, cells: ["4", "línea\nnueva", "6"] },
    ]);
  });

  it("el número de línea sigue a la planilla aunque haya saltos dentro de comillas y filas vacías", () => {
    const t = parseCsv('a,b\n"x\ny",1\n\n,\nz,2');
    expect(t.rows.map((r) => r.line)).toEqual([2, 6]);
  });

  it("detecta ; (Excel en español)", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter('a,"b;c",d')).toBe(",");
    expect(parseCsv("marca;modelo\nHonda;Wave 110S").rows[0].cells).toEqual(["Honda", "Wave 110S"]);
  });

  it("comillas sin cerrar y archivo vacío son errores del archivo", () => {
    expect(() => parseCsv('a,b\n"abierta,1')).toThrow(CsvError);
    expect(() => parseCsv("\n\n")).toThrow(CsvError);
  });

  it("Latin-1 de Excel en Windows se lee bien", () => {
    const latin1 = Buffer.from("ciudad\nAsunción\n", "latin1");
    expect(decodeCsvBytes(latin1)).toBe("ciudad\nAsunción\n");
    expect(decodeCsvBytes(Buffer.from("ciudad\nÑemby\n", "utf8"))).toBe("ciudad\nÑemby\n");
  });
});
