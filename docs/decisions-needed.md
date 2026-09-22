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

(Sin entradas.)
