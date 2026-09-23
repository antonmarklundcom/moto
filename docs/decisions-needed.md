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
**Estado:** Abierta
**Qué bloquea:** B2 (`/motos/en-cuotas`, `/motos/nuevas`, `/motos/usadas`) y B1 (marca × ciudad, categoría × ciudad). Sin texto, esas páginas quedan `noindex` para siempre (`SEO_ARCHITECTURE.md` §2.1 exige 200–400 palabras propias). `/motos/en-cuotas` es la página comercial clave.
**Pregunta:** ¿Dónde se guarda el texto editorial de las páginas que no tienen `intro_html` en la base?
- **A)** Archivos versionados `content/seo/<clave>.md` (p. ej. `en-cuotas.md`, `condicion-nuevas.md`, `marca-ciudad/honda-asuncion.md`), escritos por B10 como borrador `[VERIFICAR]` y revisados por vos antes de publicarse. Sin cambio de esquema; editar = PR. Coherente con ADR-22 (config y textos revisados en archivos).
- **B)** Tabla nueva `seo_pages` (clave, `intro_html`, `reviewed_by`, fechas) editable en el admin de B10. Cambio de esquema (ADR nuevo + migración), más trabajo, pero editable sin PR.
**Recomendación:** A, porque los cruces recién pasan el umbral con ≥ 10 publicaciones vivas, así que son pocas páginas en el primer año; no toca el esquema ni bloquea fases; se puede migrar a B cuando haya volumen.
**Respuesta del propietario:**


## 2026-09-23 · B3 · Pausa automática por denuncias: el sistema no tiene permiso de `pause`
**Estado:** Abierta
**Qué bloquea:** criterio de salida de B3 "3 denuncias `estafa`/`robada` pausan la publicación vía `transition()` (actor sistema)". Hoy la tercera denuncia independiente intenta la pausa y la máquina de estados la rechaza (403); la publicación sigue publicada y queda un log `warn`.
**Pregunta:** `TRUST_AND_SAFETY.md` §5 dice que la pausa es automática, pero la matriz de `DATABASE_SCHEMA.md` §3 (que A1 codificó literal en `src/lib/listings/state.ts`) le da `published → paused` a admin, moderador, dealer y seller, no al sistema. ¿Cuál manda?
- **A)** Agregar `system: "yes"` a la fila `pause` de `TRANSITIONS` (una línea) y la columna "sistema: sí (denuncias, T&S §5)" en la matriz del documento. Sólo lo usa `applyAutoPause` (`src/components/listing/reports.ts`), queda en `activity_log` con `job: reports_auto_pause`. El test de B3 cambia `blocked` → `paused`.
- **B)** Sin pausa automática: la tercera denuncia sólo sube la publicación al tope de la cola de denuncias (B6) y una persona decide. Se corrige T&S §5.
**Recomendación:** A, porque es la regla escrita en T&S y la que protege al comprador de una estafa en curso fuera de horario; la pausa es reversible y la baja sigue siendo humana.
**Respuesta del propietario:**
