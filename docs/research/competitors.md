# Competidores — investigación R0 (G-17)

Acceso: 2026-09-22. Igual que `catalog.md`, ninguna de estas páginas pudo
abrirse directo esta sesión (ver `catalog.md` §0: bloqueo de política de red
del entorno de esta sesión, confirmado contra `/root/.ccr/README.md`, no un
bloqueo de los sitios). Todo lo de abajo viene de resultados de `WebSearch`
— títulos, URLs y fragmentos de texto de las páginas reales, no de haberlas
navegado. Donde no se pudo verificar una característica (cuotas, velocidad,
indexación) se dice explícitamente "no verificado esta sesión" en vez de
inventar una respuesta. **Ningún número de tráfico o de mercado se reporta
acá** salvo que venga de una fuente pública citada (regla de `BUILD_PLAN.md`
§5.2 R0).

## 1. Clasificados generales (donde hoy se listan motos en Paraguay)

### Clasipar (`clasipar.paraguay.com`, también `clasiparaguay.com`)

- Qué es: clasificados generales (autos, motos, inmuebles, empleo, servicios),
  con sección propia `/categorias/motos`. Es, por lejos, el sitio con más
  presencia en los resultados de búsqueda de este research: **los propios
  distribuidores oficiales publican ahí** (todos los avisos "DIESA S.A." de
  Honda en `catalog.md` §1 son de Clasipar).
- Contacto: aviso individual con botón "Llamar por WhatsApp" (confirmado por
  el texto de al menos un aviso). Requiere cuenta para publicar
  (`/publicar-aviso`).
- Cuotas: sí aparecen en los avisos — varios avisos de DIESA muestran precio
  en cuotas mensuales en guaraníes (ej. "desde Gs. 308.000") y condiciones de
  financiación ("10% de entrega + 36 cuotas sin interés"), pero **el dato de
  cuotas lo escribe cada vendedor en el texto libre del aviso**, no es un
  campo estructurado del sitio — no hay comparación entre comercios para un
  mismo modelo.
- Fotos: sí, formato clásico de clasificado (no se pudo contar cuántas por
  aviso esta sesión).
- Velocidad / indexación: no verificado esta sesión (no se pudo abrir la
  página para medir).
- Oficinas físicas: Avda. Mcal. López y Avda. Sacramento, Superseis Gran
  Unión, Recoleta, Asunción (dato de la propia página de contacto, vía
  búsqueda).
- **Lectura para el negocio:** es el competidor más directo y el más
  relevante — es donde ya están los comercios reales. No compara cuotas
  entre comercios para el mismo modelo (la comparación real es el diferencial
  de moto.com.py, ADR-20 / G-9) y el dato de financiación es texto libre, no
  filtrable.

### Encuentra24 Paraguay (`encuentra24.com.py` / `encuentra24.com`)

- Clasificados regionales (opera en varios países de Centroamérica y
  Paraguay), con sección de vehículos/motos.
- No se verificó esta sesión si muestra cuotas, ni su velocidad ni
  indexación.

### Evisos Paraguay (`evisos.com.py`)

- Clasificados gratuitos; un resultado de búsqueda mencionó "73 avisos" en su
  categoría de motos usadas al momento de la búsqueda (dato del propio sitio,
  no medido por esta sesión — puede haber cambiado).
- Resto de características no verificado esta sesión.

### OLX

- Un resultado de búsqueda devolvió una URL `olx.com.co/paraguay_...` (dominio
  de OLX Colombia con una región "Paraguay" dentro), no un dominio dedicado
  `olx.com.py`. **No está claro si OLX opera con presencia real y propia en
  Paraguay o si es sólo una región dentro de un sitio regional** —
  `[VERIFICAR antes de citarlo como competidor real]`.

### Carden (`carden.com.py`) e Infomotors (`infomotors.com.py`)

- Ambos se presentan como plataformas de compra/venta de vehículos usados en
  Paraguay (Carden como app). Aparecieron avisos de autos con más frecuencia
  que de motos en los resultados — no está confirmado que tengan una sección
  de motos comparable a Clasipar. `[VERIFICAR alcance real en motos]`.

## 2. Sitios de importador/distribuidor (compiten por la búsqueda de marca+modelo, no son clasificados)

Estos no son "competidores" en el sentido de C2C/clasificado, pero si un
comprador busca `{marca} {modelo} precio paraguay` (la consulta de mayor
intención que `BUILD_PLAN.md` §3.5 quiere ganar), hoy puede aterrizar acá en
vez de en moto.com.py:

- **Diesa** (`diesa.com.py`) — Honda. Tiene página por sucursal
  (`/dealers/honda-<ciudad>/`) y notas de prensa propias sobre lanzamientos
  (ver `catalog.md` §1). No muestra "comparar cuotas entre comercios" porque
  es un solo distribuidor — no compite en eso, compite en ranking por marca.
- **Kenton** (`kenton.com.py`) — ficha técnica completa por modelo, con
  manuales descargables (`/manuales/`).
- **Star** (`star.com.py`) — catálogo por tipo (Cobrador, Motoneta, Pistera,
  Todoterreno, Carga), fabricante nacional (ALEX S.A.).
- **TVS Paraguay** (`paraguay.tvsmotor.com`) — sitio de marca regional.
- **Yamaha Paraguay** (`yamaha.com.py`, operado por Chacomer S.A.E.) y
  **Chacomer** (`chacomer.com.py`) — también vende Kenton y Suzuki bajo el
  mismo grupo según la semilla existente.

Ninguno de estos compara entre comercios (no tendrían motivo: cada uno vende
sólo su propia marca) — es exactamente el hueco que el bloque de
financiación por comercio (ADR-20/G-9) de moto.com.py llena y que hoy nadie
llena en Paraguay, según lo relevado.

## 3. Facebook Marketplace y grupos

Se observó, sin poder entrar a inspeccionar contenido con detalle (Facebook
requiere sesión, y esta sesión no tiene credenciales ni las usaría sin pedir
permiso):

- Existe un grupo público **"Compra y venta de motos paraguay"** en
  Facebook (URL con ID de grupo, confirmado que existe vía búsqueda).
- Existen secciones de **Facebook Marketplace** filtradas por Asunción para
  motos en general, motos chopper y "dirt bikes" por separado —
  `facebook.com/marketplace/asuncion/motos/`,
  `.../motorcycles/`, `.../chopper-motorcycles/`, `.../dirt-bikes/`.
- No se puede saber desde acá cuántos avisos activos tienen, si muestran
  cuotas, ni la calidad de fotos — es contenido dentro de Facebook, no
  indexado ni accesible para este research. `[VERIFICAR manualmente, alguien
  con cuenta de Facebook, cuánto volumen real de motos se mueve ahí — el plan
  de negocio (S-E) ya asume presencia orgánica en Facebook/Instagram/
  WhatsApp Channel, así que esto también es inteligencia competitiva para esa
  vía]`.

## 4. Resumen para el negocio

| Sitio | Tipo | Compara cuotas entre comercios | Indexado/rankea por marca+modelo (no verificado a fondo) |
|---|---|---|---|
| Clasipar | Clasificado general | No (texto libre, no filtrable) | Aparece en resultados de búsqueda para consultas de marca+modelo+Paraguay |
| Encuentra24, Evisos | Clasificado general | No verificado | No verificado |
| Diesa / Kenton / Star / TVS / Yamaha-Chacomer | Sitio de marca/distribuidor | No aplica (mono-marca) | Aparecen en resultados de búsqueda de marca propia |
| Facebook Marketplace/grupos | Red social | No | No indexado por buscadores tradicionales |

Ninguno relevado hace lo que `BUILD_PLAN.md` §3 punto 1 propone como
diferencial: comparar la misma moto entre varios comercios en una sola
página. Clasipar es el que más se le acerca en volumen de avisos reales de
comercios, pero no en estructura.
