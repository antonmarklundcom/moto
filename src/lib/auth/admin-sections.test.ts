import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, safeAdminNext, sectionsFor } from "./admin-sections";

describe("secciones del panel", () => {
  it("cada sección tiene su página (para que lane 2 tenga directorios disjuntos)", () => {
    for (const s of ADMIN_SECTIONS) {
      expect(existsSync(`src/app/admin/${s.slug}/page.tsx`), s.slug).toBe(true);
    }
  });

  it("matriz de ADMIN_SPEC.md §2", () => {
    const of = (role: Parameters<typeof sectionsFor>[0]) => sectionsFor(role).map((s) => s.slug).sort();
    expect(of("admin")).toHaveLength(ADMIN_SECTIONS.length);
    expect(of("moderator")).toEqual(
      ["actividad", "catalogo", "comercios", "contenido", "denuncias", "leads", "moderacion", "publicaciones"].sort(),
    );
    expect(of("dealer")).toEqual(["comercios", "leads", "monetizacion", "publicaciones"].sort());
    expect(of("seller")).toEqual([]);
  });

  it("safeAdminNext sólo acepta rutas internas del panel", () => {
    expect(safeAdminNext("/admin/leads?page=2")).toBe("/admin/leads?page=2");
    expect(safeAdminNext("/admin")).toBe("/admin");
    for (const bad of ["https://evil.example/admin", "//evil.example", "/adminx", "/", "/admin/login", "/admin\\..\\x", null]) {
      expect(safeAdminNext(bad)).toBe("/admin");
    }
  });
});
