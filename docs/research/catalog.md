# Catálogo — investigación R0 (G-16, F-10)

Acceso: 2026-09-22, salvo que se indique otra fecha. Fuentes completas también
quedan como comentario en `src/db/seed-data/brands.ts` y `models.ts` — este
documento es la versión legible, con el razonamiento y la tabla de categorías
que R0 no puede escribir directo en el esquema.

## 0. Limitación de red de esta sesión (leer antes que el resto)

`F-10` decía que la sesión anterior no pudo abrir `hondamotos.com.py` porque
"el sitio bloqueó el acceso". Esta sesión probó de nuevo — con `WebFetch`, no
sólo con búsqueda — y encontró algo distinto: **ningún dominio pudo abrirse
directo**, incluidos `hondamotos.com.py`, `www.honda.com.py`,
`www.yamaha.com.py`, `www.abc.com.py` y hasta `en.wikipedia.org`. El endpoint
de diagnóstico del proxy (`/root/.ccr/README.md`) lo confirma: es un bloqueo
de política de red del entorno de esta sesión ("egress policy"), no un
bloqueo del sitio. No es algo que reintentar resuelva, y no es un ítem del
checklist de escalado de `PLAN.md` §4.3 ni una credencial faltante — es una
limitación de herramienta, así que esta sesión siguió trabajando con lo que
sí funciona: `WebSearch`, que sí trae contenido (snippets y páginas de
resultado) de sitios paraguayos.

**Consecuencia práctica:** ninguna fuente de este documento es "abrí la
página y la leí completa". Son resultados de búsqueda que citan URL, título y
fragmentos de texto de la página real — en varios casos con textos técnicos
específicos (fichas técnicas completas, notas de prensa fechadas), lo que da
razonable confianza, pero es un escalón por debajo de abrir la página. Una
sesión futura con acceso de red distinto debería re-confirmar contra la
página viva antes de que el catálogo se use para importar stock real (B8).

**Criterio de activación (revisión Opus, misma fecha).** El catálogo es "modelos
que se venden o se vendieron en Paraguay", 0 km **y usadas** — no la gama
vigente del distribuidor. Una XR 250 Tornado 2008 o una CB 500X 2021 usadas
son publicables y sin fila en el catálogo bloquearían la publicación
(`model_id` NOT NULL al publicar). Evidencia mínima para activar: aviso del
distribuidor oficial, página de producto de la marca en Paraguay, o nota de
prensa paraguaya. Un aviso de un particular solo no alcanza.

## 1. Honda — antes: 0 modelos activos de 4. Ahora: 12 de 14.

Honda es la marca de mayor volumen probable del segmento (F-10) y estaba
completamente inactiva. Distribuidor oficial confirmado: **DIESA S.A.**
(Avda. Eusebio Ayala km 4,5, Asunción; sucursales en Ciudad del Este,
Encarnación, Carapeguá, Villarrica, Katuete, M. Auxiliadora), vía:
- La Nación, ["Honda Motos Paraguay habilitó su nuevo e innovador
  Showroom"](https://www.lanacion.com.py/2016/03/03/honda-motos-paraguay-habilito-su-nuevo-e-innovador-showroom/)
  (2016-03-03).
- [diesa.com.py/marcas/honda-motos/](https://www.diesa.com.py/marcas/honda-motos/)
  (sitio propio del distribuidor).
- Avisos publicados por la cuenta "DIESA S.A." en `clasipar.paraguay.com`
  (ver modelos abajo — cada uno es un aviso real con título y specs, no un
  listado genérico).

| Modelo | cc | Estado | Fuente |
|---|---|---|---|
| XR 150L | 150 | activo | Clasipar, "MOTOCICLETA HONDA XR150L 0KM — DIESA S.A." (#1153760): "Enduro, Cross and Trial... monocilíndrico 4 tiempos refrigerado por aire, 150cc". Reemplaza el "XR 150" genérico de la semilla anterior — el nombre comercial real lleva la L. |
| Wave 110S | 110 | activo | Clasipar, avisos "DIESA S.A." listan "WAVE110S". Reemplaza el "Wave" sin cilindrada de la semilla anterior. |
| CG 110 | 110 | activo | Clasipar, avisos "DIESA S.A." ("CG110 desde Gs. 308.000" en cuota); título "MOTO HONDA CG 110 - 0KM" (#2025140); Honda Motos Paraguay en Facebook: "La moto Honda CG110 es la preferida por los paraguayos". |
| Navi 110 | 110 | activo | Título de aviso de DIESA "NO TE QUEDES SIN TU MOTO HONDA - DIESA CG 110 CB1 125 NAVI 110 CB160 XR150 Africa 1100" (#92967, aviso antiguo) y aviso "HONDA NAVI 110" (#1996719). Agregado en la revisión Opus. |
| CB1 125 | 125 | activo | Mismo título de aviso de DIESA (#92967). Agregado en la revisión Opus. |
| XR 190 | 190 | activo | Clasipar, avisos "DIESA S.A." ("XR190 desde Gs. 835.000" en cuota); también hay avisos de terceros ("HONDA XR190 18 MILLONES OFERTA"). |
| XR 250 Tornado | 250 | activo | Clasipar, avisos "DIESA S.A." (cuota Gs. 1.299.000); título "MOTO HONDA TORNADO 250 - 0KM" (#2025150). Posiblemente ya no esté en la gama vigente (el NX500 y la línea XR 190 la cubren), pero hay stock usado real. |
| CRF 250F | 250 | activo | Sólo en el texto de un aviso multi-modelo de "DIESA S.A.", sin título propio — **la evidencia más débil de la tabla**. Primera fila a re-confirmar contra el sitio vivo. |
| CB 500X | 500 | activo | Clasipar, avisos "DIESA S.A." y aviso propio "Honda CB500X" (#2368446, 2021 usada). Honda la reemplazó por la NX500 a nivel global; se mantiene por el mercado de usadas. |
| Rebel 500 | 500 | activo | ABC Color, ["Lanzan Honda Rebel 500, NX500 y X-ADV 750"](https://www.abc.com.py/empresariales/2025/04/12/lanzan-honda-rebel-500-nx500-y-x-adv-750/) (2025-04-12); La Nación, ["Diesa presentó las nuevas motocicletas Rebel 500, NX500 y X-ADV 750"](https://www.lanacion.com.py/negocios/2025/04/04/diesa-presento-las-nuevas-motocicletas-rebel-500-nx500-y-x-adv-750/) (2025-04-04). Lanzamiento oficial de Diesa S.A., con nombres y cargos (Miguel Carrizosa, presidente de Diesa; Esteban Carrizosa, brand manager de Honda Motos). |
| NX500 | 500 | activo | Mismas dos notas de prensa. |
| X-ADV 750 | 750 | activo | Mismas dos notas de prensa. |
| CG 150 Titan | 150 | **sigue inactivo** | No aparece en ningún aviso "DIESA S.A." relevado. "Titan" es nomenclatura de Argentina/Brasil para la línea CG; Paraguay parece vender "CG 110" sin el sufijo. `[VERIFICAR: si DIESA vende alguna variante "Titan" o si el nombre correcto en Paraguay es CG 110/CG 125]`. |
| CB 125 | 125 | **sigue inactivo** | No aparece con este nombre; DIESA sí lista "CB1 125" (fila propia, activa). `[VERIFICAR: si "CB 125" es un modelo distinto vendido en Paraguay o un duplicado de CB1 125]`. |

No agregados, a propósito: "CB160" y "Africa 1100" aparecen en el mismo
título de DIESA (#92967), pero el título no da el nombre comercial exacto
(¿CB160F? ¿CRF1100L Africa Twin?). Adivinar el nombre sería inventarlo.
`[VERIFICAR: nombre comercial exacto en hondamotos.com.py]`.

`hondamotos.com.py` y `www.honda.com.py` (encontrado este ciclo — dominio
distinto al ya conocido) siguen sin poder abrirse directo por la limitación
de red de la sección 0. Ambos quedan como la fuente a re-confirmar primero
en la próxima sesión con acceso.

## 2. Marca nueva: Star (ALEX S.A.)

`G-16` pedía sumar marcas del segmento de entrada no cubiertas. **Star** es
una marca fabricada/ensamblada en Paraguay, orientada a cobradoras y
motonetas, y no estaba en el catálogo. No se afirma su participación de
mercado: la única cifra disponible es de la propia marca.

- ABC Color, ["STAR, la motocicleta que acompaña en todo lo que uno se
  propone"](https://www.abc.com.py/empresariales/2025/07/10/star-la-motocicleta-que-acompana-en-todo-lo-que-uno-se-propone/)
  (2025-07-10): marca de **ALEX S.A.**, empresa paraguaya con más de 75 años
  en el mercado nacional, "más de 450.000 motocicletas STAR" circulando
  (sección Empresariales, cifra declarada por la marca, no verificada).
- Sitio propio: [star.com.py](https://www.star.com.py/), con categorías
  Cobrador, Motoneta, Pistera, Todoterreno, Carga.

Modelos confirmados con página de producto propia (mayor confianza que un
listado de reventa):

| Modelo | cc | Fuente |
|---|---|---|
| Star 150 | 150 | [star.com.py/producto/SK150-CG-CKD/motocicleta-star-150-150cc](https://www.star.com.py/producto/SK150-CG-CKD/motocicleta-star-150-150cc) |
| SMX 150 | 150 | [star.com.py/producto/SMX150-CKD/smx-150cc](https://star.com.py/producto/SMX150-CKD/smx-150cc) |

Se vieron mencionados en avisos de terceros (Clasipar, no página oficial de
Star) otros modelos — SK 110, A1 110cc, DAX 110cc, NK 150, NT 150, "150 X" —
que **no se agregan** todavía: son avisos de revendedores, no una página de
producto de `star.com.py` como las dos de arriba. `[VERIFICAR: catálogo
completo vigente en star.com.py — el sitio no pudo abrirse directo esta
sesión, sólo vía resultados de búsqueda parciales]`.

## 3. Kenton — de 1 modelo activo a 6

La semilla anterior sólo tenía "Classic 125", sourced a un retailer
(`digi.com.py`). Esta vez se encontraron páginas de producto propias en
`kenton.com.py`, con ficha técnica completa:

| Modelo | cc | Fuente |
|---|---|---|
| GL 150 | 150 | kenton.com.py/moto/gl-150/ |
| GL 150 Pro | 150 | kenton.com.py/moto/gl-150-pro/ |
| GTR 150 | 150 | kenton.com.py/moto/gtr-150/ |
| GTR 150 LTD | 150 | kenton.com.py/moto/gtr-150-ltd/ |
| Blitz 110 | 110 | kenton.com.py/moto/blitz-110-dlx/, /blitz-110-se/, /blitz-110-automatic/ |

No se afirma nada sobre qué modelo de Kenton "vende más": ninguna fuente
fechada lo dice.

## 4. Marcas revisadas sin cambios (fuente paraguaya específica no encontrada)

Se buscó activamente ampliar Bajaj, Yamaha, Suzuki y TVS y **no se agregó
nada** porque no apareció una fuente paraguaya específica lo bastante sólida:

- **Bajaj:** La Nación (2019-01-12, "Bajaj llegó al Paraguay y busca ser
  líder en el segmento de motos") lista el portafolio de AMS explícitamente
  como "Boxer 150, Rouser 200 y Dominar 400" — coincide exacto con lo que ya
  estaba activo. Se buscó "Dominar 250" / "Pulsar N160" para Paraguay y sólo
  aparecieron fuentes de Argentina; no se agrega nada.
- **Yamaha:** se buscó Ray ZR, FZ, Saluto contra `yamaha.com.py` y no
  aparecieron resultados específicos de Paraguay (sólo México/Guatemala/
  Colombia). Sin cambios.
- **TVS, Suzuki:** sin resultados nuevos específicos de Paraguay más allá de
  lo ya activo.
- **Zanella:** sigue sin una fuente de distribución en Paraguay. Sigue
  inactiva.

## 5. Mapeo propuesto modelo → categoría

`DATABASE_SCHEMA.md` §2.4 dice que `models.category_id` es la categoría por
defecto del modelo, y este seed no la asigna: eso requiere tocar
`scripts/seed-catalog.ts` y/o el esquema de inserción, que no es **Owns** de
R0. Se deja la propuesta acá para que la fase que sí tenga ese archivo la
aplique. Categorías existentes (`src/db/seed-data/categories.ts`): `naked`,
`scooter`, `cub`, `enduro-cross`, `touring`, `deportiva`, `custom-chopper`,
`motocarro-carga`, `electrica`, `cuatriciclo`.

| Modelo (slug) | Categoría propuesta | Motivo / confianza |
|---|---|---|
| yamaha/xtz-125, xtz-150, xtz-250 | enduro-cross | Línea trail de Yamaha |
| yamaha/ybr-125z | naked | Commuter de calle |
| yamaha/crypton | naked | Commuter económico |
| bajaj/boxer-150 | naked | Commuter/trabajo |
| bajaj/rouser-ns-200 | naked | Naked deportiva |
| bajaj/dominar-400 | touring | Adventure-touring |
| suzuki/v-strom-250, -650, -800, -1050 | touring | Línea adventure-touring |
| suzuki/dr-650 | enduro-cross | Trail |
| suzuki/gixxer-150 | naked | Naked de calle, no carenada |
| tvs/raider-125 | naked | Commuter deportivo |
| kenton/classic-125 | naked | `[VERIFICAR: podría ser "cub" si el motor es automático — no se confirmó la caja]` |
| kenton/gl-150, gl-150-pro | naked | Cobradora/trabajo de calle |
| kenton/gtr-150, gtr-150-ltd | naked | Cobradora con estética deportiva |
| kenton/blitz-110 | cub | Ficha técnica confirma caja **semiautomática** — encaja con la definición de `cub` en `DATABASE_SCHEMA.md` §2.5 |
| star/star-150 | naked | Nombre de línea "CG" (commuter clásica) |
| star/smx-150 | enduro-cross | `[VERIFICAR: "SMX" sugiere supermotard/cross, no se confirmó la ficha]` |
| honda/xr-150 (XR 150L), xr-190, xr-250-tornado, crf-250f | enduro-cross | Confirmado explícito como Enduro/Cross/Trial en el aviso de XR150L; línea XR/CRF completa |
| honda/wave (Wave 110S) | cub | Underbone semiautomática clásica |
| honda/cg-110, cb1-125 | naked | Commuter clásica |
| honda/navi-110 | scooter | Automática (CVT), estética de mini moto `[VERIFICAR: la categoría que usaría un comercio]` |
| honda/cb-500x | touring | Adventure-touring carenada |
| honda/rebel-500 | custom-chopper | Cruiser |
| honda/nx500 | touring | Adventure |
| honda/x-adv-750 | scooter | `[VERIFICAR: Honda lo vende como "adventure scooter", ninguna categoría actual encaja del todo — la más cercana es scooter]` |
| honda/cg-150-titan, cb-125 | — | Siguen inactivos, sin categoría hasta confirmarse |

## 6. Lo que queda para la próxima sesión con acceso de red distinto

1. Re-abrir `hondamotos.com.py` y `www.honda.com.py` directo y confirmar el
   catálogo completo contra la sección 1 (¿hay CG 150 Titan o CB 125 después
   de todo? ¿faltó algún modelo de la línea Wave/Biz/Elite?).
2. Abrir `star.com.py/catalogo` directo y completar la línea (Cobrador,
   Motoneta, Trail, Carga) más allá de los 2 modelos confirmados acá.
3. Confirmar si Yamaha Paraguay vende Ray ZR / FZ / Saluto (no se encontró
   nada específico de Paraguay esta sesión).
