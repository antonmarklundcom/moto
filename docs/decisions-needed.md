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

