# Decisiones pendientes del propietario

Una fase autónoma escribe acá **sólo** cuando choca con un ítem del checklist de escalado de
`PLAN.md` §4.3 o le falta una credencial sin alternativa (`BUILD_PLAN.md` §4.4). Después
hace commit, push y termina. El watcher (`prompts/_watcher.md`) avisa al propietario.

El propietario responde debajo de cada entrada y cambia el estado a `Respondida`. La fase
bloqueada se vuelve a lanzar con su mismo prompt y lee la respuesta de acá.

Formato de cada entrada:

```
## <fecha> · <fase> · <tema corto>
**Estado:** Abierta | Respondida
**Qué bloquea:** <criterio de salida o archivo>
**Pregunta:** <una pregunta concreta>
- **A)** <opción> — <consecuencia>
- **B)** <opción> — <consecuencia>
**Recomendación:** A|B, porque <razón>.
**Respuesta del propietario:** <vacío hasta que responda>
```

---

## 2026-09-22 · A2 · Texto editorial de cruces, condición y en-cuotas
**Estado:** Respondida
**Qué bloquea:** B2 (`/motos/en-cuotas`, `/motos/nuevas`, `/motos/usadas`) y B1 (marca × ciudad, categoría × ciudad). Sin texto, esas páginas quedan `noindex` para siempre (`SEO_ARCHITECTURE.md` §2.1 exige 200–400 palabras propias). `/motos/en-cuotas` es la página comercial clave.
**Pregunta:** ¿Dónde se guarda el texto editorial de las páginas que no tienen `intro_html` en la base?
- **A)** Archivos versionados `content/seo/<clave>.md` (p. ej. `en-cuotas.md`, `condicion-nuevas.md`, `marca-ciudad/honda-asuncion.md`), escritos por B10 como borrador `[VERIFICAR]` y revisados por vos antes de publicarse. Sin cambio de esquema; editar = PR. Coherente con ADR-22 (config y textos revisados en archivos).
- **B)** Tabla nueva `seo_pages` (clave, `intro_html`, `reviewed_by`, fechas) editable en el admin de B10. Cambio de esquema (ADR nuevo + migración), más trabajo, pero editable sin PR.
**Recomendación:** A, porque los cruces recién pasan el umbral con ≥ 10 publicaciones vivas, así que son pocas páginas en el primer año; no toca el esquema ni bloquea fases; se puede migrar a B cuando haya volumen.
**Respuesta del propietario:** A (2026-09-23). Implementado en `src/lib/seo/editorial.ts` + `content/seo/` (borradores `[VERIFICAR]` de en-cuotas, nuevas y usadas; ver `content/seo/README.md`).


## 2026-09-23 · B3 · Pausa automática por denuncias: el sistema no tiene permiso de `pause`
**Estado:** Respondida
**Qué bloquea:** criterio de salida de B3 "3 denuncias `estafa`/`robada` pausan la publicación vía `transition()` (actor sistema)". Hoy la tercera denuncia independiente intenta la pausa y la máquina de estados la rechaza (403); la publicación sigue publicada y queda un log `warn`.
**Pregunta:** `TRUST_AND_SAFETY.md` §5 dice que la pausa es automática, pero la matriz de `DATABASE_SCHEMA.md` §3 (que A1 codificó literal en `src/lib/listings/state.ts`) le da `published → paused` a admin, moderador, dealer y seller, no al sistema. ¿Cuál manda?
- **A)** Agregar `system: "yes"` a la fila `pause` de `TRANSITIONS` (una línea) y la columna "sistema: sí (denuncias, T&S §5)" en la matriz del documento. Sólo lo usa `applyAutoPause` (`src/components/listing/reports.ts`), queda en `activity_log` con `job: reports_auto_pause`. El test de B3 cambia `blocked` → `paused`.
- **B)** Sin pausa automática: la tercera denuncia sólo sube la publicación al tope de la cola de denuncias (B6) y una persona decide. Se corrige T&S §5.
**Recomendación:** A, porque es la regla escrita en T&S y la que protege al comprador de una estafa en curso fuera de horario; la pausa es reversible y la baja sigue siendo humana.
**Respuesta del propietario:** A (2026-09-23), con un agregado: "si alguien denuncia de mala fe también tiene que quedar bloqueado; no se puede denunciar a cualquiera". Implementado: el sistema pausa; la pausa automática sólo la levanta admin/moderador; una IP con 2 denuncias descartadas en 90 días queda silenciada sin aviso; tras una reanudación humana las denuncias viejas no cuentan y hay 30 días sin pausa automática (T&S §5, `DATABASE_SCHEMA.md` §3).

## 2026-09-23 · Revisión de seguridad · Cerrar sesiones al cambiar la contraseña
**Estado:** Abierta
**Qué bloquea:** nada del lanzamiento; es endurecimiento. Hallazgo #7 de `docs/review/security-2026-09-23.md`.
**Pregunta:** Hoy una cookie de sesión robada sigue valiendo después de `create-admin --reset` y de "Salir" (se renueva sola mientras se use). Arreglarlo necesita una columna nueva (escalado por `CLAUDE.md` §7). ¿Se agrega?
- **A)** Columna `users.session_version INT NOT NULL DEFAULT 0` (migración aditiva). Va dentro de la cookie; `loadSessionUser` la compara; `--reset` y "Salir" la incrementan → todas las sesiones de ese usuario se cierran. Unas 30 líneas y una prueba.
- **B)** Sin columna: se acepta el riesgo y la respuesta a un robo de sesión es desactivar el usuario (`is_active = false`) y crear otro.
**Recomendación:** A, porque el panel es donde está todo (leads, comercios, moderación) y el costo es mínimo.
**Respuesta del propietario:**

## 2026-09-23 · Propietario · Indexar el sitio desde el lanzamiento
**Estado:** Respondida
**Pregunta:** ¿`SITE_NOINDEX=true` hasta 150 publicaciones de ≥ 5 comercios (DATA_SEEDING §3), o indexar desde el día 1?
**Respuesta del propietario:** indexar desde el lanzamiento ("make the site indexed so ppl can find it"). `DEPLOY.md` indica `SITE_NOINDEX=false`. La regla de umbral sigue en código (CLAUDE.md §3.4): marca, modelo, tipo, ciudad y cruces por debajo de §2.1 siguen `noindex` y fuera del sitemap. Se indexan desde el día 1: inicio, guías publicadas, estáticas y fichas publicadas. Pendiente recomendado: la auditoría previa (`docs/closing-report.md`).
