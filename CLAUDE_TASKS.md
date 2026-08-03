# CLAUDE_TASKS.md

Tareas ejecutables. **Una tarea = un PR.** Escrito para una sesión Sonnet 5 / Codex nueva, sin memoria de la planificación, con acceso sólo a este repositorio.

## Cómo usar este archivo

1. Leer `CLAUDE.md` (se carga solo), `PLAN.md` §4 (ownership) y el documento que cite la tarea.
2. Tomar la primera tarea cuyas precondiciones estén cumplidas. No saltar el orden.
3. **Ejecutar el checklist de escalado de `PLAN.md` §4.3 antes de escribir código.** Si algún ítem da sí → abrir issue `ESCALACIÓN: <tema>` y no abrir el PR.
4. Rama con el nombre indicado, cortada de `main` actualizado.
5. Implementar sólo el alcance de la tarea. Lo que sobra va a otra tarea.
6. Verificar con los pasos de la tarea. **No declarar hecho lo que no se ejecutó.**
7. PR con el título de la tarea, la lista de criterios de aceptación marcada, y qué se verificó.

**Formato de rama:** `claude/f<fase>-<slug>` — ejemplo `claude/f1-ficha-publicacion`.

---

# FASE 0 — Cimientos

## T-001 · Andamiaje del proyecto
**Rama:** `claude/f0-scaffold` · **Precondiciones:** ninguna
**Archivos:** `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.env.example`, `.gitignore`
**Alcance:** Next.js 15 App Router + TypeScript + Tailwind. Dependencias: `drizzle-orm`, `mysql2`, `drizzle-kit`, `tsx`. Layout base con `lang="es-PY"`. Páginas 404 y 500. `.env.example` con todas las claves de `INTEGRATIONS.md` §6, cada una con un comentario de dónde sale su valor.
**Aceptación:** `npm run build` limpio · `.env` en `.gitignore` · sin secretos versionados
**Verificar:** `npm run build && npm run start`, abrir `/`

## T-002 · Esquema de base y conexión
**Rama:** `claude/f0-db-schema` · **Precondiciones:** T-001
**Archivos:** `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema.ts`, `drizzle/*`
**Alcance:** todo `DATABASE_SCHEMA.md`, tabla por tabla, con **todos los índices y su comentario de motivo**. Pool con `connectionLimit: 8` y `timezone: "Z"`. Primera migración generada con `drizzle-kit`.
**Aceptación:** todas las tablas y enums de §2 · todos los índices de §2 · `price_gs` es `BIGINT UNSIGNED` · `users.role` existe con los 4 valores · migración aplica en base limpia
**Verificar:** aplicar contra MySQL local, `SHOW CREATE TABLE listings` y comparar contra el documento
**Escalado:** cualquier desvío del esquema, por chico que parezca

## T-003 · Seeds de catálogo
**Rama:** `claude/f0-seeds` · **Precondiciones:** T-002
**Archivos:** `scripts/seed-catalog.ts`, `src/db/seed-data/*`
**Alcance:** ciudades, categorías, marcas y modelos con `onDuplicateKeyUpdate` por slug. **Las marcas y modelos se construyen desde fuentes reales de comercios paraguayos; lo no confirmado se carga marcado `[VERIFICAR]` y con `is_active = false`** (ADR-11).
**Aceptación:** re-ejecutable sin duplicar · ciudades de `DATABASE_SCHEMA.md` §2.3 con departamento y acentos correctos · ninguna marca inventada
**Verificar:** ejecutar dos veces, comprobar conteos idénticos
**Nota:** `tsx` no carga `.env` solo — cargarlo explícitamente en el script

## T-004 · Utilidades compartidas
**Rama:** `claude/f0-utils` · **Precondiciones:** T-001
**Archivos:** `src/lib/format.ts`, `src/lib/phone.ts`, `src/lib/slug.ts`, `src/lib/hash.ts`, tests
**Alcance:** formato de guaraníes, formato de financiación, normalización de teléfono a E.164, slugify sin acentos, hash con sal.
**Aceptación:** los tests de `TEST_PLAN.md` §2 puntos 1, 2, 7 pasan, incluidos los bordes
**Verificar:** `npm test`

## T-005 · Almacenamiento y despliegue
**Rama:** `claude/f0-storage-deploy` · **Precondiciones:** T-002
**Archivos:** `src/lib/storage/index.ts`, `src/lib/storage/local.ts`, notas de despliegue
**Alcance:** interfaz `put`/`get`/`delete`/`url` con implementación local (ADR-16). Despliegue en Hostinger con `SITE_NOINDEX=true`.
**Aceptación:** ningún módulo fuera de `storage/` toca el sistema de archivos · el sitio desplegado sirve una página con datos de la base · el HTML de producción contiene `noindex`
**Verificar:** `curl -s https://<dominio> | grep noindex`

---

# FASE 1 — MVP

## T-101 · Consultas de listado y facetas
**Rama:** `claude/f1-queries` · **Precondiciones:** T-002, T-003, T-004
**Archivos:** `src/lib/listings/query.ts`, `src/lib/listings/filters.ts`, tests
**Alcance:** consulta de listado con todos los filtros de `PRODUCT_SPEC.md` §3.2, orden, paginación, y conteos. Sólo publicaciones vivas según `ANALYTICS_AND_KPIS.md` §1.
**Aceptación:** todos los filtros combinables · paginación sin duplicados · `EXPLAIN` sin escaneo completo con 10.000 filas
**Verificar:** tests de integración de `TEST_PLAN.md` §3 + `EXPLAIN`

## T-102 · Regla de umbral de indexación
**Rama:** `claude/f1-index-threshold` · **Precondiciones:** T-101
**Archivos:** `src/lib/seo/indexability.ts`, tests
**Alcance:** función pura que recibe tipo de página, conteo de publicaciones vivas y largo del contenido editorial, y devuelve indexable o no, según `SEO_ARCHITECTURE.md` §2.1. **Ambas condiciones, no una.** La usan las páginas y el generador de sitemaps.
**Aceptación:** tests en los bordes exactos de cada tipo · `SITE_NOINDEX=true` fuerza `noindex` siempre
**Verificar:** `npm test`
**Nota:** es la pieza que impide la explosión de páginas finas. No se relaja.

## T-103 · Listado público `/motos`
**Rama:** `claude/f1-listado` · **Precondiciones:** T-101, T-102
**Archivos:** `src/app/motos/page.tsx`, componentes de filtros y tarjeta
**Alcance:** server component, filtros en URL, paginación real (no scroll infinito), tarjeta según `PRODUCT_SPEC.md` §3.2, estado vacío honesto, canonical y `noindex` de filtros según `SEO_ARCHITECTURE.md` §3.
**Aceptación:** URL con filtro → `noindex, follow` + canonical a la URL limpia · `?page=2` indexable y auto-canonical · conteo real en el encabezado · checklist §12
**Verificar:** ver el HTML de las tres variantes

## T-104 · Ficha de publicación
**Rama:** `claude/f1-ficha` · **Precondiciones:** T-101
**Archivos:** `src/app/aviso/[slug]/page.tsx`, galería, JSON-LD
**Alcance:** todo `PRODUCT_SPEC.md` §3.3 con el orden móvil indicado. Banners de vendida/vencida con el HTTP y la indexación de `SEO_ARCHITECTURE.md` §4. Foto de catálogo etiquetada. Rango de precios sólo con N ≥ 5. Similares reales o el bloque no aparece. JSON-LD `Product`+`Vehicle`+`Offer`+`BreadcrumbList`.
**Aceptación:** **sin `AggregateRating` ni `Review`** · todo dato del JSON-LD visible en la página · CTA WhatsApp sin scroll en móvil · teléfono ausente del HTML inicial
**Verificar:** validador de resultados enriquecidos; buscar el teléfono en el HTML servido → no debe estar

## T-105 · Redirección rastreada de WhatsApp
**Rama:** `claude/f1-whatsapp-track` · **Precondiciones:** T-002
**Archivos:** `src/app/ir/wa/[...params]/route.ts`, `src/lib/events.ts`
**Alcance:** `INTEGRATIONS.md` §1 completo. Registrar evento, incrementar contador, 302 a `wa.me` con mensaje pre-cargado. Sin render. `no-store`. **Si el registro del evento falla, redirigir igual.**
**Aceptación:** el evento se inserta antes del 302 · texto correcto y escapado · marcado de bots · bloqueado en `robots.txt`
**Verificar:** `curl -I` y comprobar 302 + fila en `listing_events`

## T-106 · Páginas programáticas de SEO
**Rama:** `claude/f1-paginas-seo` · **Precondiciones:** T-102, T-103
**Archivos:** rutas de marca, marca+modelo, categoría, ciudad, cruces, condición, `/motos/en-cuotas`
**Alcance:** las rutas de `SEO_ARCHITECTURE.md` §1 que existen; las combinaciones prohibidas de §2.3 devuelven **404**. Umbral aplicado en cada una. `intro_html` desde la base. Metadatos de §9 con conteos reales.
**Aceptación:** una página bajo umbral emite `noindex` y no aparece en el sitemap · marca×modelo×ciudad → 404 · sin conteos escritos a mano
**Verificar:** revisar HTML de una página sobre y otra bajo umbral

## T-107 · Formulario de publicación
**Rama:** `claude/f1-publicar` · **Precondiciones:** T-002, T-004, T-108
**Archivos:** `src/app/publicar/*`, acciones de servidor
**Alcance:** `PRODUCT_SPEC.md` §2.2. Cinco pasos, fotos primero, autosave en `localStorage`, compresión en cliente, subida por foto con reintento, selector dependiente marca→modelo, `model_suggestions` cuando no está en catálogo, honeypot, mínimo de 120 caracteres de descripción.
**Aceptación:** recargar no pierde datos · una foto que falla no tumba las demás · queda `pending_review` · nunca crea `model` nuevo directamente
**Verificar:** E2E 1 y 2 de `TEST_PLAN.md` §4

## T-108 · Pipeline de imágenes
**Rama:** `claude/f1-imagenes` · **Precondiciones:** T-005
**Archivos:** `src/lib/images/*`, endpoint de subida
**Alcance:** validación de tipo **por contenido**, re-encodeo, variantes responsive, `content_hash` SHA-256, `width`/`height` guardados, `alt` generado si falta, límite de tamaño, **SVG rechazado**.
**Aceptación:** un ejecutable renombrado a `.jpg` se rechaza · toda imagen se re-encodea · dimensiones persistidas
**Verificar:** `TEST_PLAN.md` §9 punto 1

## T-109 · Captura de leads + VenderCRM
**Rama:** `claude/f1-leads-crm` · **Precondiciones:** T-002, T-004
**Archivos:** `src/app/api/leads/route.ts`, `src/lib/crm/vendercrm.ts`, `src/app/financiacion/*`, `src/app/seguros/*`, tests
**Alcance:** todo `INTEGRATIONS.md` §2. **Guardar en `leads` primero, responder al usuario, después postear al CRM.** Idempotencia, todos los códigos de respuesta, `lead_deliveries`, honeypot, timeout 10 s, snippet de atribución y lectura de `vc_attr`.
**Aceptación:** la key **nunca** llega al cliente · payload sin `pipeline`/`stage`/`owner`/`tag` · opcionales vacíos omitidos, no `""` · CRM caído → el visitante ve la página de gracias · doble envío → un solo contacto
**Verificar:** **`TEST_PLAN.md` §5 completo, los 7 puntos.** No se cierra esta tarea sin el round-trip real
**Escalado:** cualquier cambio de payload o de disparadores

## T-110 · Job de reintento de leads
**Rama:** `claude/f1-lead-retry` · **Precondiciones:** T-109
**Archivos:** `scripts/cron-retry-leads.ts`
**Alcance:** reintentar `failed` con backoff 1 min / 5 min / 30 min / 2 h / 12 h, máximo 5, misma `idempotency_key`.
**Aceptación:** no duplica · se detiene a los 5 · registra cada intento

## T-111 · Máquina de estados y job de vencimiento
**Rama:** `claude/f1-estados` · **Precondiciones:** T-002
**Archivos:** `src/lib/listings/state.ts`, `scripts/cron-expire-listings.ts`, tests
**Alcance:** transiciones y matriz de permisos de `DATABASE_SCHEMA.md` §3, `activity_log` en cada una, job diario de vencimiento, regla de que editar fotos o descripción de un particular vuelve a `pending_review`.
**Aceptación:** **pruebas negativas de cada transición prohibida** · el job sólo toca lo que corresponde
**Escalado:** agregar o cambiar cualquier estado

## T-112 · Sitemaps y robots
**Rama:** `claude/f1-sitemaps` · **Precondiciones:** T-102, T-106
**Archivos:** `src/app/sitemap.xml/route.ts`, `src/app/sitemaps/*`, `src/app/robots.txt/route.ts`
**Alcance:** `SEO_ARCHITECTURE.md` §7 y §3.4. Índice + hijos de máximo 5.000. `lastmod` real. Sin `priority` ni `changefreq`.
**Aceptación:** **ninguna URL `noindex` aparece jamás** · `SITE_NOINDEX=true` → sitemap vacío o ausente · XML válido

## T-113 · Autenticación de admin
**Rama:** `claude/f1-admin-auth` · **Precondiciones:** T-002
**Archivos:** `src/lib/auth/*`, `src/app/admin/login/*`, middleware
**Alcance:** `ADMIN_SPEC.md` §1. Sesión por cookie, bcrypt coste 12, límite de intentos, `requireRole` server-side, script de alta de admin.
**Aceptación:** `/admin` sin sesión redirige, la API responde 401 · rol insuficiente → 403 llamando directo al endpoint · `/admin` con `noindex` y en `robots.txt`
**Verificar:** `TEST_PLAN.md` §9

## T-114 · Cola de moderación
**Rama:** `claude/f1-moderacion` · **Precondiciones:** T-111, T-113
**Archivos:** `src/app/admin/moderacion/*`
**Alcance:** `ADMIN_SPEC.md` §3 completo: una publicación a la vez, atajos de teclado, panel de señales (precio contra mediana con su N, historial del teléfono, IP en 24 h, duplicados por `content_hash`), mapeo de modelo en el mismo gesto, motivos de rechazo con texto pre-cargado.
**Aceptación:** todos los atajos funcionan · aprobar fija `published_at` y `expires_at` · rechazar exige motivo · todo a `activity_log` · si N < 5 dice "sin referencia suficiente" en vez de mostrar una mediana pobre
**Verificar:** E2E 3 y 4

## T-115 · CRUD de admin
**Rama:** `claude/f1-admin-crud` · **Precondiciones:** T-113
**Archivos:** `src/app/admin/publicaciones/*`, `/comercios/*`, `/catalogo/*`
**Alcance:** `ADMIN_SPEC.md` §4, §5, §6. Incluye el bloque de autorización del comercio, `free_until` con alerta a 60 días, cola de `model_suggestions`, slug bloqueado tras publicar, botón de baja de stock.
**Aceptación:** no se puede editar un slug publicado · el comercio sin autorización registrada no puede tener stock publicado

## T-116 · Bandeja de leads y salud del CRM
**Rama:** `claude/f1-admin-leads` · **Precondiciones:** T-109, T-113
**Archivos:** `src/app/admin/leads/*`
**Alcance:** `ADMIN_SPEC.md` §7. Contexto completo del lead, panel de estados de CRM, **alarma roja con 5 intentos fallidos**, último error con su cuerpo, reintento manual, exportar CSV.
**Aceptación:** el lead muestra `payload_json` y la atribución · la alarma aparece con un `failed` agotado

## T-117 · Admin de contenido y configuración
**Rama:** `claude/f1-admin-contenido` · **Precondiciones:** T-113
**Archivos:** `src/app/admin/contenido/*`, `src/app/admin/config/*`
**Alcance:** `ADMIN_SPEC.md` §9 y §11. CRUD de `posts` con `reviewed_by` **obligatorio** para publicar, edición de `intro_html` con indicador de indexabilidad, interruptor `SITE_NOINDEX` con el conteo de publicaciones vivas al lado.
**Aceptación:** publicar sin revisor es imposible en la interfaz y en el servidor

## T-118 · Denuncias
**Rama:** `claude/f1-denuncias` · **Precondiciones:** T-113
**Archivos:** `src/app/api/reportes/route.ts`, `src/app/admin/denuncias/*`
**Alcance:** `TRUST_AND_SAFETY.md` §5. Formulario público sin registro, límite de 5 por IP/día, **pausa automática con 3 denuncias de `estafa` o `robada`**, cola con resolución y nota obligatoria.
**Aceptación:** la pausa automática funciona · la baja definitiva sigue siendo humana

## T-119 · Guías y páginas legales
**Rama:** `claude/f1-contenido` · **Precondiciones:** T-117
**Archivos:** `src/app/guias/*`, `src/app/terminos/*`, `/privacidad`, `/como-funciona`
**Alcance:** plantilla de guía con `Article` + `BreadcrumbList`, índice, enlazado a listados. Las 10 guías de `CONTENT_STRATEGY.md` §2.3 **en borrador**, con `[VERIFICAR]` en todo dato de trámite o arancel.
**Aceptación:** ninguna guía se publica con un `[VERIFICAR]` sin resolver · ningún dato de trámite afirmado sin fuente
**Escalado:** **el texto legal no lo redacta la sesión de implementación** (`LEGAL_AND_COMPLIANCE.md` §10). Crear las páginas con un marcador y escalar

## T-120 · Home
**Rama:** `claude/f1-home` · **Precondiciones:** T-103, T-106
**Alcance:** `PRODUCT_SPEC.md` §3.1. Sólo marcas, categorías y ciudades **con inventario real**. Sin contadores inventados, sin carrusel.
**Aceptación:** nada renderizado desde datos falsos · si no hay inventario, la sección no aparece

## T-121 · Pasada de rendimiento y accesibilidad
**Rama:** `claude/f1-perf-a11y` · **Precondiciones:** todas las anteriores de fase 1
**Alcance:** cumplir `SEO_ARCHITECTURE.md` §10 y `PRODUCT_SPEC.md` §5. Lighthouse móvil con throttling 4G y axe.
**Aceptación:** LCP < 2,5 s · CLS < 0,1 · ficha < 500 KB · axe sin violaciones críticas · navegable por teclado
**Verificar:** `TEST_PLAN.md` §7 y §8

## T-122 · Cierre de fase 1
**Rama:** `claude/f1-cierre` · **Precondiciones:** T-101…T-121
**Alcance:** ejecutar el criterio de salida de `IMPLEMENTATION_PHASES.md` fase 1 y documentar el resultado en el PR. **No se apaga `SITE_NOINDEX` en esta tarea** — es decisión del propietario con el conteo real a la vista.
**Aceptación:** cada punto del criterio verificado y evidenciado, o listado explícitamente como incumplido

---

# FASE 2 y siguientes

Se detallan cuando fase 1 cumpla su criterio de salida. Alcance en `IMPLEMENTATION_PHASES.md`. Escribir tareas de fase 2 antes de cerrar fase 1 es adelantar trabajo de una fase posterior — ítem del checklist de escalado.

---

## Recordatorio permanente

- Una tarea, un PR, una fase.
- Checklist de escalado de `PLAN.md` §4.3 **antes** de escribir código.
- Ningún dato inventado en ningún lado (`PLAN.md` §5).
- Ninguna integración se declara hecha sin el round-trip real.
- Ante la duda entre dos opciones no resueltas por estos documentos: escalar, no elegir.
