import { describe, expect, it } from "vitest";
import { resolveMediaPath } from "./media-path";

describe("resolveMediaPath", () => {
  it("acepta variantes y placeholders con su tipo", () => {
    expect(resolveMediaPath(["listings", "ab", "abcdef-640.webp"])).toEqual({
      path: "listings/ab/abcdef-640.webp",
      contentType: "image/webp",
    });
    expect(resolveMediaPath(["dev-fixtures", "placeholder-1.png"])?.contentType).toBe("image/png");
  });

  it("rechaza traversal, ocultos, temporales y tipos no servibles", () => {
    for (const segs of [
      [],
      ["..", "etc", "passwd"],
      ["listings", "..", "..", "x.webp"],
      ["listings", "a..b.webp"],
      [".env"],
      ["listings", ".hidden.webp"],
      ["a.webp.abc123.tmp"],
      ["listings/../../x.webp"],
      ["listings\\..\\x.webp"],
      ["x.svg"],
      ["x.html"],
      ["x"],
      ["x.webp\u0000.png"],
      ["/etc/passwd.png"],
    ]) {
      expect(resolveMediaPath(segs), JSON.stringify(segs)).toBeNull();
    }
  });
});
