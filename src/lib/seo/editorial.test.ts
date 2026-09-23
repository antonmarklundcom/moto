// Texto editorial en archivos (decisión A2): sólo lo revisado y sin [VERIFICAR] cuenta.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { editorialFromFile, editorialKeys, editorialText, parseEditorialFile } = await import("./editorial");

const file = (meta: string, body: string) => `---\n${meta}\n---\n\n${body}\n`;
const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");

describe("editorial", () => {
  it("un borrador no cuenta", () => {
    expect(editorialFromFile(parseEditorialFile(file("status: draft\nreviewed_by: Anton", words(500))))).toBeNull();
  });

  it("revisado sin revisor no cuenta", () => {
    expect(editorialFromFile(parseEditorialFile(file("status: reviewed\nreviewed_by:", words(500))))).toBeNull();
  });

  it("revisado con [VERIFICAR] pendiente no cuenta", () => {
    expect(editorialFromFile(parseEditorialFile(file("status: reviewed\nreviewed_by: Anton", `${words(500)} [VERIFICAR: x]`)))).toBeNull();
  });

  it("revisado, con revisor y limpio: HTML saneado y palabras", () => {
    const t = editorialFromFile(parseEditorialFile(file("status: reviewed\nreviewed_by: Anton", `## Título\n\n${words(10)} <script>alert(1)</script>`)));
    expect(t).not.toBeNull();
    expect(t!.html).toContain("<h2>");
    expect(t!.html).not.toContain("<script");
    expect(t!.words).toBeGreaterThanOrEqual(11);
  });

  it("claves inválidas no leen el disco", () => {
    expect(editorialText("../../.env")).toBeNull();
    expect(editorialText("marca-ciudad/../../x")).toBeNull();
    expect(editorialKeys.brandCity("honda", "luque")).toBe("marca-ciudad/honda-luque");
  });

  it("los archivos del repo parsean y los borradores no se publican solos", () => {
    const dir = path.join(process.cwd(), "content", "seo");
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".md") && n !== "README.md")) {
      const parsed = parseEditorialFile(readFileSync(path.join(dir, name), "utf8"));
      expect(parsed, name).not.toBeNull();
      if (parsed!.status !== "reviewed") expect(editorialText(name.replace(/\.md$/, "")), name).toBeNull();
    }
  });
});
