# Launch prep — setup sin pasos manuales + guías listas para publicar

## Built
- `src/instrumentation.ts` → `src/lib/boot/boot.ts` al arrancar (`next start`, nunca en `next build`):
  - carpeta de fotos (`STORAGE_LOCAL_PATH` o `~/moto-uploads`);
  - migraciones de `/drizzle` (idempotentes);
  - catálogo, sólo si no hay marcas (`src/db/seed-catalog.ts`, compartido con `npm run seed:catalog`);
  - primer admin desde `ADMIN_EMAIL` + `ADMIN_PASSWORD`, sólo si no hay ningún admin activo;
  - programador interno de jobs (`src/lib/boot/schedule.ts`): retry-leads 5 min, expire-listings y expire-featured 1 h, purge-uploads 6 h, purge-auth-attempts 24 h, con el candado de `job_runs` de siempre. Sólo en producción; `INTERNAL_CRON=false` lo apaga y el cron de hPanel sigue funcionando.
  - Un fallo se registra (`boot: … falló`) y el sitio sigue arrancando.
- `www` ↔ dominio pelado: redirección 308 a `SITE_URL` (`src/lib/canonical-host.ts`, `next.config.ts`).
- `GOOGLE_SITE_VERIFICATION` opcional en el layout raíz.
- `DEPLOY.md` reescrito para el propietario: sin SSH, Remote MySQL ni cron.
- Guías: 12 en `content/guias/` (2 nuevas: `cuanto-vale-mi-moto-usada`, `moto-0-km-o-usada`); 10 sin `[VERIFICAR]`. Los hechos no confirmables se reescribieron como "preguntá en…" en vez de afirmarse; nada inventado. Quedan con marcas `como-transferir-una-moto-en-paraguay` (11) y `papeles-de-una-moto-al-dia` (12).
- Enlaces a guías no publicadas se muestran como texto (`src/app/(public)/guias/links.ts`); la ficha enlaza la guía anti-estafa desde "Antes de pagar" cuando está publicada (KNOWN-ISSUES).

## Verificado
- Arranque real contra una base **vacía** con `next start`: tablas, 8 marcas, admin, carpeta; `retry-leads` y `expire-listings` corrieron solos (`job_runs` succeeded); segundo arranque sin duplicar nada ("ya hay marcas", "ya hay un admin"). Inicio y `/motos/honda` 200.
- Pruebas: unitarias (programador, host canónico, enlaces de guías, reglas de las 12 guías) e integración (migraciones re-ejecutables, carpeta, primer admin, carga de borradores).

## Not done / blocked
- **Fuentes oficiales:** la política de red de la sesión bloquea pj.gov.py, bacn.gov.py, antsv.gov.py, asuncion.gov.py y demás (WebFetch 403). Sin páginas leídas no se afirma nada, así que no hay sección "Fuentes" ni las guías nuevas de trámites (habilitación municipal, registro de conducir, casco y normas, robo, prenda). Con la red abierta: re-correr la investigación (reglas en el prompt de esta sesión) y completar las guías 1 y 4.
- Textos de marca/tipo/ciudad para superar §2.1: esperan inventario real (las páginas necesitan además 5–10 publicaciones vivas).
- `tests/e2e/support/detail-targets.ts`: borra las denuncias de hoy sobre fichas [DEV] antes de la prueba (el límite de 5 por IP y día la hacía fallar al repetir). E2E 55/55 dos veces.
