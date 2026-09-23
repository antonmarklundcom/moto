import { describe, expect, it } from "vitest";
import { otherWwwHost } from "./canonical-host";

describe("otherWwwHost", () => {
  it("sin www → redirige www", () => {
    expect(otherWwwHost("https://moto.com.py")).toEqual({ from: "www.moto.com.py", to: "https://moto.com.py" });
  });
  it("con www → redirige el dominio pelado", () => {
    expect(otherWwwHost("https://www.moto.com.py/")).toEqual({ from: "moto.com.py", to: "https://www.moto.com.py" });
  });
  it("local, IP o vacío → nada", () => {
    for (const v of ["http://localhost:3000", "http://127.0.0.1:3100", "", undefined, "no es url"]) expect(otherWwwHost(v)).toBeNull();
  });
});
