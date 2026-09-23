# Stock de demostración (sólo local)

`stock-demo.csv`: 30 motos **inventadas** para ver el sitio lleno en una máquina de desarrollo
y para probar el importador de B8. No es stock de ningún comercio real.

**Dónde se puede usar (ADR-12, ADR-24):** sólo en una base local. B8 importa este archivo
únicamente si `fixturesRefusalReason()` (`scripts/lib/dev-fixtures-core.ts`) devuelve `null`:
no producción, `ALLOW_DEV_FIXTURES=1`, base en `localhost`, `SITE_URL` local. Nunca en
producción ni en staging.

**Marcas que lo delatan:** título con `[DEV]`, referencia `DEV-…`, comercios `dev-comercio-uno`
(Asunción), `dev-comercio-dos` (San Lorenzo), `dev-comercio-tres` (Ciudad del Este), que crea
`npm run fixtures`. Teléfono `0981 000 000`.

**Qué muestra:** el mismo modelo 0 km en varios comercios (Wave 110S ×3, CG 110, XR 150L,
GL 150, Blitz 110 ×2) para ver el bloque de comparación de cuotas (ADR-20); usadas con los tres
estados de documentación; una sólo financiada (sin contado); una "sólo llamadas" con fijo.

**Los precios y cuotas son ilustrativos**, no de mercado. No se citan en ningún lado.

**Sin fotos:** el archivo no trae imágenes. En modo demo, B8 adjunta la imagen de marcador de
posición de `npm run fixtures` (etiquetada, no presentada como foto de la unidad).

**Columnas:** son las del modelo de planilla para comercios. Si B8 cambia los encabezados de
`docs/templates/stock-template.csv`, actualiza también este archivo para que siga importando
sin rechazos.
