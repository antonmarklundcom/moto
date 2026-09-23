import { expect, test } from "@playwright/test";

// C2, TEST_PLAN.md §9 y BUILD_PLAN G-26 contra `next start`: cabeceras de
// seguridad y barrido de toda ruta POST de admin/cron sin sesión. Los 403 por
// rol insuficiente con sesión (dealer, moderador) los cubren las pruebas de
// integración de A1/B6/B7/B9 (POST directo a cada mutación).

const ADMIN_POSTS = [
  "/admin/contenido/cargar",
  "/admin/contenido/guardar",
  "/admin/contenido/intro",
  "/admin/denuncias/resolver",
  "/admin/importar/fotos",
  "/admin/moderacion/decision",
];

test("cabeceras: CSP con frame-ancestors, HSTS, nosniff, DENY, referrer, permisos; sin x-powered-by", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

for (const path of ADMIN_POSTS) {
  test(`POST ${path} sin sesión: nunca 2xx`, async ({ request }) => {
    const res = await request.post(path, { maxRedirects: 0, headers: { origin: "http://localhost:3000" }, data: { id: 1 } });
    expect(res.status() >= 300 && res.status() < 500, `${path} → ${res.status()}`).toBe(true);
    expect([200, 201, 204]).not.toContain(res.status());
  });
}

test("POST /api/cron/<job> sin secreto o con uno malo: 401/503, nunca corre", async ({ request }) => {
  for (const auth of [undefined, "Bearer malo"]) {
    const res = await request.post("/api/cron/retry-leads", { headers: auth ? { authorization: auth } : {} });
    expect([401, 403, 503]).toContain(res.status());
  }
});

test("/admin sin sesión redirige al login", async ({ request }) => {
  const res = await request.get("/admin", { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(res.status());
  expect(res.headers().location).toMatch(/\/admin\/login/);
});
