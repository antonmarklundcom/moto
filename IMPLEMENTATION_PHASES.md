# IMPLEMENTATION_PHASES.md

Cada fase es independientemente desplegable y verificable. No se empieza una fase sin cumplir el criterio de salida de la anterior — adelantar trabajo de una fase posterior es motivo de escalado (`PLAN.md` §4.3).

Las estimaciones son de esfuerzo relativo para una sesión de implementación con el spec en la mano, no compromisos de calendario.

---

## Fase 0 — Cimientos

**Objetivo:** que exista un repositorio que compila, despliega y habla con la base.

**Alcance**
- `create-next-app` (App Router, TypeScript, Tailwind).
- Drizzle + mysql2 + drizzle-kit + tsx. `drizzle.config.ts`, pool con `connectionLimit: 8`, `timezone: "Z"`.
- Esquema completo de `DATABASE_SCHEMA.md` en `src/db/schema.ts` + primera migración.
- Seeds idempotentes de catálogo: ciudades, categorías, marcas, modelos (`onDuplicateKeyUpdate` por slug).
- `.env.example` con todas las claves de `INTEGRATIONS.md` §6 y un comentario de origen por cada una.
- Interfaz de almacenamiento (`put`/`get`/`delete`/`url`) con implementación local (ADR-16).
- Layout base, tokens mínimos de estilo, `lang="es-PY"`, 404 y 500.
- Despliegue en Hostinger funcionando, con `SITE_NOINDEX=true`.
- Helpers compartidos: formato de guaraníes, normalización de teléfono a E.164, slugify, hash con sal.

**Fuera:** cualquier página pública real, admin, imágenes.

**Criterio de salida**
- `npm run build` limpio.
- Migración y seeds aplicados en la base real de Hostinger.
- El sitio desplegado responde una página con datos leídos de la base.
- `SITE_NOINDEX=true` verificado en el HTML servido en producción.

---

## Fase 1 — MVP

**Objetivo:** el sitio más chico capaz de atraer inventario, rankear y **capturar leads de financiación** (ADR-03).

**Alcance**

*Público*
- Home, `/motos` con búsqueda facetada y paginación real.
- Páginas programáticas: marca, marca+modelo, categoría, ciudad, marca×ciudad, categoría×ciudad, nuevas/usadas, `/motos/en-cuotas` — todas con la regla de umbral de `SEO_ARCHITECTURE.md` §2.2 implementada en código.
- Ficha `/aviso/:slug-:ref` con galería, datos, estado (vendida/vencida) y similares reales.
- `/comercios` y `/comercios/:slug`.
- `/publicar`: formulario multipaso con autosave, compresión en cliente y subida por foto.
- `/financiacion` + formulario. `/seguros` + formulario.
- Denuncia de publicación.
- 10 guías (`CONTENT_STRATEGY.md` §2.3) + páginas legales.

*Fontanería*
- `/ir/wa/*` con registro de evento y 302 (ADR-07).
- `listing_events` completo con filtrado de bots.
- Leads: guardar primero en base, luego enviar a VenderCRM con idempotencia, manejo de todos los códigos, y job de reintentos (`INTEGRATIONS.md`).
- Snippet de atribución + lectura de `vc_attr` del lado servidor.
- Honeypot en todos los formularios.
- Pipeline de imágenes: validación por contenido, re-encodeo, variantes, `content_hash`.
- Máquina de estados completa + job diario de vencimiento.
- Sitemaps segmentados + `robots.txt` + JSON-LD.
- `activity_log` en toda transición.

*Admin*
- Login y sesión.
- Cola de moderación con atajos de teclado y panel de señales.
- CRUD de publicaciones, comercios, catálogo, `model_suggestions`.
- Bandeja de leads con panel de salud del CRM.
- Contenido: guías y `intro_html` con indicador de indexabilidad.
- Denuncias.
- Configuración con el interruptor `SITE_NOINDEX` y el conteo al lado.
- Controles manuales de destacados y planes.

**Fuera:** cuentas de comercio o vendedor, dashboards, pagos automáticos, favoritos, alertas, comparador, repuestos, diseño pulido.

**Criterio de salida** (= criterio de MVP de `PLAN.md` §3.3)
- ≥ 150 publicaciones reales de ≥ 5 comercios reales.
- Round-trip de VenderCRM verificado según `INTEGRATIONS.md` §2.9, incluida la prueba de duplicado.
- Un clic de WhatsApp queda registrado antes de redirigir, verificado en la base.
- El sitemap sólo contiene URLs que cumplen el umbral.
- Ficha sin errores en el validador de resultados enriquecidos y sin `AggregateRating`.
- Presupuesto de rendimiento de `SEO_ARCHITECTURE.md` §10 cumplido en la ficha y en `/motos`.
- Páginas legales publicadas y revisadas (`LEGAL_AND_COMPLIANCE.md` §9).

**Sólo entonces:** `SITE_NOINDEX=false` y envío de sitemaps a Search Console.

---

## Fase 2 — Cuentas de comercio

**Objetivo:** que los comercios se autogestionen, cuando el trabajo manual empiece a doler.

**Disparador:** más de ~2 horas semanales cargando stock a mano, o petición explícita de un comercio.

**Alcance:** login de comercio, alcance por fila en todas las queries, dashboard con sus publicaciones y sus métricas reales (`ANALYTICS_AND_KPIS.md` §7), alta y edición propia, autoaprobación configurable, notificación de leads recibidos.

**Fuera:** pagos, facturación, gestión de usuarios múltiples por comercio.

**Criterio de salida:** 3 comercios usándolo sin ayuda; un `dealer` no puede leer ni escribir datos de otro (verificado con pruebas negativas explícitas).

---

## Fase 3 — Monetización activa y financiación

**Objetivo:** cobrar, y convertir los leads de financiación en ingreso.

**Alcance:** destacados vendibles con vigencia automática, planes con alertas de vencimiento, `ad_placements` sirviendo banners con conteo de impresiones y clics, reporte de leads por comercio exportable, alertas de búsqueda (`search_alerts`, tabla ya existente), agregación diaria de eventos y purga a 180 días.

**Bloqueante externo:** `LEGAL_AND_COMPLIANCE.md` §3 resuelto antes de firmar con una financiera o aseguradora.

**Criterio de salida:** primer cobro registrado y conciliado; primer acuerdo de leads con definición escrita de "lead cualificado".

---

## Fase 4 — Contenido a escala y captación

**Objetivo:** crecer tráfico sobre la estructura ya probada.

**Alcance:** guías por marca y por ciudad donde haya inventario, páginas de modelo enriquecidas con datos reales del sitio, mejoras de enlazado interno guiadas por Search Console, optimización de las páginas con impresiones altas y CTR bajo.

**Criterio de salida:** 3 meses seguidos de crecimiento de clics orgánicos.

---

## Fase 5 — Recurrencia

**Objetivo:** que el usuario vuelva.

**Disparador:** demanda medida — el evento `favorite` acumulado y las altas de alertas dicen si esto importa antes de construirlo.

**Alcance:** cuentas de particular, favoritos, comparador, alertas por WhatsApp, historial de búsquedas.

---

## Fase 6 — Inventario propio y repuestos

**Objetivo:** vender directamente.

**Alcance:** inventario propio destacado como tal (nunca disfrazado de particular), sección de repuestos y accesorios con su propio modelo de datos, checkout o pedido por WhatsApp.

**Nota:** es un negocio distinto (capital, stock, logística). Reevaluar antes de empezar.

---

## Reglas transversales

1. Un PR por tarea de `CLAUDE_TASKS.md`.
2. Ningún PR mezcla fases.
3. Todo PR que toque páginas públicas corre el checklist de `SEO_ARCHITECTURE.md` §12.
4. Todo PR ejecuta el checklist de escalado de `PLAN.md` §4.3 antes de abrirse.
5. Ninguna fase se salta el criterio de salida de la anterior.
6. `SITE_NOINDEX` sólo se apaga al cumplir el criterio de salida de fase 1.
