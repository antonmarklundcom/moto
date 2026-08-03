# PLAN.md — moto.com.py

**Estado:** decisiones tomadas. Documento maestro del proyecto.
**Última actualización:** 2026-08-03
**Autor de las decisiones:** sesión Opus 5 (planificación). La implementación la ejecutan sesiones Sonnet 5 / Codex a partir de estos documentos.

> Lee también `DECISIONS.md` (registro de decisiones y supuestos) y `DATA_SEEDING.md` (plan de inventario inicial). Este documento no repite lo que está allí.

---

## 0. Qué es esto, en un párrafo

**moto.com.py es un portal de motos para Paraguay cuyo negocio real es la generación de leads de financiación y la venta de planes a comercios, no el clasificado C2C.** El clasificado existe porque produce el inventario y las páginas que rankean; la plata viene de las casas comerciales, las financieras y las aseguradoras. Empieza como portal de stock de comercios + buscador con financiación, con publicación gratuita abierta para sumar oferta, y sólo se convierte en un marketplace C2C real si los datos demuestran que la gente vuelve.

---

## 1. Crítica honesta: ¿es esto un buen negocio?

### 1.1 El caso en contra (primero, porque es el más fuerte)

**a) Facebook Marketplace y los grupos de WhatsApp ya ganaron el C2C.** Un paraguayo que quiere vender su moto usada publica en Marketplace en noventa segundos, gratis, y le escriben ese mismo día. No tiene ninguna razón para crear una cuenta en un sitio que no conoce, subir fotos otra vez y esperar moderación. Cualquier plan que dependa de arrebatarle el C2C informal a Facebook está muerto antes de empezar. Esto no es pesimismo: es la razón por la que casi todos los clasificados verticales de la región terminaron viviendo del lado profesional del mercado, no del particular.

**b) El arranque en frío es brutal y es circular.** Sin publicaciones no hay tráfico; sin tráfico no hay quien publique; sin publicaciones no hay páginas que rankear. Un clasificado vacío no es "un clasificado chico": es un sitio que activamente destruye confianza, porque el visitante que llega y ve tres motos no vuelve nunca. El riesgo número uno de este proyecto no es técnico ni de SEO, es tener un sitio vacío en el mes tres.

**c) El C2C no paga.** Un particular vende una moto cada cuatro años. No tiene presupuesto publicitario, no compra destacados salvo excepciones, y no vuelve. Construir producto para él es construir para un usuario que no genera ingresos.

**d) El dominio no es una estrategia.** `moto.com.py` es un dominio de coincidencia exacta y eso ayuda al CTR y a la memorabilidad, pero Google dejó de premiar los EMD hace más de una década. El dominio es un activo de marca, no un plan de posicionamiento.

**e) Los comercios ya tienen dónde publicar.** Tienen Facebook, Instagram y, los más grandes, su propio sitio. Hay que darles algo que esos canales no les dan.

### 1.2 Qué es defendible, entonces

Hay una cuña real, y es angosta y específica:

**En Paraguay las motos se compran en cuotas, y la búsqueda de una moto es en gran medida una búsqueda de financiación.** La consulta mental del comprador no es "quiero una moto", es "cuánto tengo que pagar por mes y con cuánto de entrega". Ese es un problema que Facebook Marketplace resuelve pésimo (no tiene estructura, no compara, no calcula) y que los sitios de las casas comerciales resuelven sólo para su propio stock. Un buscador que muestre motos **filtrables por entrega y cuota mensual, con el precio en guaraníes, comparables entre comercios**, resuelve algo que hoy nadie resuelve bien en el mercado paraguayo.

De ahí se derivan tres ventajas concretas:

1. **Tráfico de intención estructurada.** Consultas como `honda cg 150 precio paraguay`, `motos en cuotas asunción`, `cuánto sale una moto 150 en paraguay` tienen intención comercial altísima y Facebook no puede rankear para ellas: Marketplace no genera páginas indexables útiles. Los sitios de comercios rankean mal porque son lentos, están mal estructurados y sólo cubren su marca.
2. **El lead de financiación vale mucho más que el clasificado.** Una persona que dice "quiero esta moto, tengo Gs. 2.000.000 de entrega, gano X" es un lead vendible a una financiera o a un comercio. Ese lead vale órdenes de magnitud más que un clic de contacto entre dos particulares.
3. **Los comercios pagan por distribución cualificada, no por hosting.** No les vendemos "un lugar donde publicar" (ya lo tienen). Les vendemos compradores que ya eligieron modelo y ya declararon capacidad de pago.

### 1.3 Veredicto de negocio

**El marketplace C2C de consumo es la puerta de entrada equivocada. Este sitio se lanza como portal de stock de comercios + captación de leads de financiación, con publicación gratuita abierta como mecanismo de crecimiento de inventario y de SEO — no como el producto.**

Consecuencias directas de este veredicto, que atraviesan todos los demás documentos:

- El primer usuario que hay que conseguir es **un comercio**, no un vendedor particular.
- La primera métrica que importa es **leads de financiación por semana**, no publicaciones totales.
- El MVP incluye el flujo de financiación. **No es una fase 4.** Sacar el flujo de financiación del MVP convierte a este proyecto en un clasificado más, que es exactamente lo que la sección 1.1 dice que no funciona.
- Las cuentas de vendedor particular se posponen. Un formulario de publicación sin cuenta + moderación alcanza para el volumen del primer año.

### 1.4 Qué haría fracasar esto igual

Enumerado acá para que ninguna sesión futura lo olvide:

- Cero comercios firmados a los 60 días → no hay inventario → el proyecto no arranca. Ver `DATA_SEEDING.md`.
- Cero acuerdos de referencia con financieras → los leads se capturan y no se monetizan. Se pueden derivar a los comercios mientras tanto, pero es peor negocio.
- Generar 20.000 páginas finas marca × modelo × ciudad y comerse una degradación de calidad de todo el dominio. Ver las reglas de indexación en `SEO_ARCHITECTURE.md`.
- Un caso de estafa sonado sin política de moderación previa. Ver `TRUST_AND_SAFETY.md`.
- Inventar datos para que el sitio parezca más grande de lo que es. Ver la sección 5.

---

## 2. Veredicto de stack

### 2.1 La decisión

**Next.js 15 (App Router) + Drizzle ORM + MySQL, desplegado en un slot Node.js gestionado de Hostinger.** Sin hedging, sin fase PHP intermedia.

### 2.2 Por qué, en funciones concretas

Node se justifica acá por seis funciones específicas, no por moda:

1. **Superficie SEO generada desde la base de datos con revalidación bajo demanda.** Las páginas de marca, modelo, ciudad y categoría son proyecciones de filas de la base. Cuando se publica o vence una moto, las páginas afectadas tienen que reflejarlo sin rebuild completo. ISR + `revalidateTag` resuelve exactamente esto. En PHP la alternativa es cachear a mano e invalidar a mano, que es el mismo problema resuelto peor.
2. **Sitemaps programáticos segmentados** generados desde la base con reglas de umbral (ver `SEO_ARCHITECTURE.md`). Es código que consulta, filtra y pagina; conviene que viva junto al modelo de datos y tipado.
3. **Pipeline de imágenes.** Las fotos las sube un vendedor desde un Android de gama media con datos móviles: hace falta compresión en cliente, normalización, variantes responsive y `next/image`. Reimplementar esto en PHP es trabajo puro sin ganancia.
4. **Autorización con alcance por fila.** Un comercio edita sólo sus propias publicaciones; un moderador edita todas. Con Drizzle + TypeScript el filtro `dealerId` es verificable estáticamente en cada query. En PHP suelto es una convención que alguien va a olvidar.
5. **Reenvío de leads del lado servidor a VenderCRM** con clave en entorno, idempotencia, timeout y reintento — el navegador nunca habla con el CRM. Route handlers hacen esto de forma natural.
6. **Búsqueda facetada** con estado de filtros en la URL, server components y streaming. Es el corazón del producto y es donde el rendimiento se nota.

### 2.3 Lo que cuesta esta decisión

Se enuncia para que la decisión sea honesta:

- Consume un slot Node de Hostinger (hay 10 por cuenta; verificar presupuesto de slots antes de arrancar).
- El build y el deploy son más frágiles que subir archivos PHP por FTP.
- El traspaso a un desarrollador paraguayo promedio es más difícil: el mercado local es mucho más PHP/WordPress que Next.js.
- Coste cognitivo mayor para cambios triviales de contenido — mitigado poniendo el contenido editable en la base y en el admin, no en el código.

### 2.4 Por qué no PHP/MySQL

PHP haría el 70% de esto perfectamente bien. Se descarta por el 30% restante: la superficie SEO generada e invalidada dinámicamente, y el pipeline de imágenes. Ese 30% es precisamente el motor del proyecto. Además el stack Next.js 15 + Drizzle + MySQL sobre Hostinger ya está probado en producción por el propietario, con lo cual el camino de despliegue es conocido y no es un riesgo nuevo.

### 2.5 Lo que explícitamente NO va en el stack

- Sin Vercel ni features exclusivas de Vercel. Sin supuestos de edge/serverless. Hostinger es Node gestionado, con proceso largo y sistema de archivos.
- Sin Elasticsearch, Algolia ni servicio de búsqueda externo en fase 1. MySQL con índices bien puestos aguanta decenas de miles de publicaciones. Se reevalúa cuando la búsqueda facetada supere ~200 ms p95.
- Sin Redis en fase 1.
- Sin S3 en fase 1: las imágenes van al disco del slot con una capa de abstracción de almacenamiento de una sola interfaz, para poder mover a object storage sin tocar el resto. Esa abstracción es obligatoria desde el día uno.
- Sin pasarela de pago automatizada en fase 1. Ver `MONETIZATION.md`.

---

## 3. Alcance del MVP

### 3.1 Qué entra (Fase 1)

**Público:**
- Home con buscador y accesos a categorías/marcas principales.
- Búsqueda y listado con filtros: marca, modelo, categoría, ciudad, rango de precio, año, cilindrada, condición (nueva/usada), y **entrega y cuota mensual** cuando el dato existe.
- Ficha de publicación con galería, datos estructurados, CTA de WhatsApp rastreado y CTA de financiación.
- Páginas SEO: marca, marca+modelo, categoría, ciudad, y marca×ciudad sólo cuando superan el umbral de indexación.
- Landing de financiación + formulario de solicitud (el producto monetizable).
- Formulario de publicación gratuita sin cuenta.
- 10 guías fundacionales (transferencia de chapa, comprar usada sin que te estafen, cuotas y entregas, mantenimiento básico, seguro contra terceros).
- Páginas legales: términos, privacidad, cómo funciona.

**Admin:**
- Cola de moderación (la pantalla central).
- CRUD de publicaciones, comercios, marcas/modelos, ciudades.
- Bandeja de leads con el contexto de la publicación adjunto.
- Gestión de contenido de las páginas SEO (texto introductorio por marca/ciudad).
- Marcado manual de comercio pagado / destacado con vencimiento.

**Piping (infraestructura invisible que es la mitad del valor de este MVP):**
- Eventos: vista, clic de WhatsApp, revelado de teléfono, envío de lead.
- Integración VenderCRM del lado servidor con idempotencia y atribución de primer toque.
- Redirección rastreada de WhatsApp.
- Sitemaps y datos estructurados.
- Máquina de estados de publicación completa.
- `activity_log` desde el día uno.

### 3.2 Qué queda explícitamente fuera del MVP, y por qué

| Fuera | Por qué |
|---|---|
| Cuentas y dashboard de vendedor particular | El volumen del año uno lo maneja la moderación. Construir auth de vendedores antes de tener vendedores es trabajo especulativo. |
| Cuentas de comercio | Los primeros 10–15 comercios se cargan por admin. El dashboard llega cuando el trabajo manual duela, no antes. |
| Pasarela de pago automática | El primer año se cobra por transferencia y se confirma a mano. Integrar Bancard antes del primer cliente pagante es invertir en una hipótesis. |
| Mensajería interna comprador–vendedor | WhatsApp ya es el canal. Construir un chat propio es competir contra un hábito nacional y perder. |
| Repuestos y accesorios | Es un producto distinto con otro modelo de datos. Fase 6. |
| App móvil | Nunca, salvo que los datos griten lo contrario. Web móvil bien hecha. |
| Comparador de motos, alertas de precio, favoritos | Requieren usuarios recurrentes que todavía no existen. Fase 3+. |
| Reseñas de comercios | Sin volumen son manipulables y peligrosos. Ver `TRUST_AND_SAFETY.md`. |
| Diseño visual pulido | Ver sección 6. |

### 3.3 Criterio de salida del MVP

El MVP se considera terminado cuando, en producción y verificable:
- Hay ≥ 150 publicaciones reales publicadas provenientes de ≥ 5 comercios reales.
- Un lead de financiación enviado desde el sitio aparece como contacto en VenderCRM con teléfono normalizado, y un reenvío duplicado no crea un segundo contacto.
- Un clic de WhatsApp queda registrado como evento antes de redirigir.
- El sitemap se genera y sólo contiene URLs que cumplen la regla de indexación.
- La ficha de publicación pasa la prueba de resultados enriquecidos de Google sin errores y sin `AggregateRating`.

---

## 4. Ownership de decisiones (Opus vs Sonnet/Codex)

Esta sección es normativa. Una sesión Sonnet debe poder leerla y saber, sin criterio propio, si una tarea le corresponde o si debe escalar.

### 4.1 Opus ya decidió (está en estos documentos; no se re-decide)

- Veredicto de negocio y posicionamiento (§1.3).
- Veredicto de stack y exclusiones (§2).
- Alcance y exclusiones del MVP (§3).
- Modelo de datos, normalización marca/modelo, tipos monetarios y máquina de estados → `DATABASE_SCHEMA.md`.
- Taxonomía de URLs, reglas de indexación/canonical y manejo de publicaciones vencidas → `SEO_ARCHITECTURE.md`.
- Política de moderación y de fraude → `TRUST_AND_SAFETY.md`.
- Mecánica y base de precios de monetización → `MONETIZATION.md`.
- Contrato de leads con VenderCRM → `INTEGRATIONS.md`.
- Reglas anti-fabricación (§5).
- Fases y criterios de salida → `IMPLEMENTATION_PHASES.md`.

### 4.2 Sonnet 5 / Codex implementa (sin preguntar)

- Componentes, páginas y layouts según spec.
- Pantallas CRUD del admin sobre el esquema definido.
- Formularios, validación y estados de error.
- Pipeline de imágenes y almacenamiento tras la interfaz definida.
- Generadores de sitemap y JSON-LD según las reglas dadas.
- Route handlers, incluida la integración VenderCRM según el contrato dado.
- Tests, seeds, scripts de migración.
- Redacción de copy siguiendo `CONTENT_STRATEGY.md`.
- Refactors internos que no cambian esquema, URLs ni comportamiento observable.
- Correcciones de bugs, rendimiento y accesibilidad.
- Elección de librerías utilitarias menores (fechas, validación, slugify), siempre que no agreguen coste mensual ni servicio externo.

### 4.3 Checklist de escalado — escalar a Opus si CUALQUIERA es verdadera

Marcar cada ítem antes de abrir un PR. Si alguno da sí, parar y escalar.

- [ ] ¿Requiere una tabla nueva, una columna nueva, o cambiar un tipo, un enum o una clave foránea?
- [ ] ¿Agrega, quita o renombra un estado de la máquina de estados de publicaciones, o cambia quién puede ejecutar una transición?
- [ ] ¿Cambia un patrón de URL público, un canonical, una regla de indexación, o el umbral de contenido de una página programática?
- [ ] ¿Cambia el comportamiento de publicaciones vencidas o vendidas (código HTTP, redirección, permanencia)?
- [ ] ¿Cambia el payload, el destino, el enrutamiento o las condiciones de disparo de un lead a VenderCRM?
- [ ] ¿Cambia un precio, un plan, la duración de un destacado, o cómo se cobra?
- [ ] ¿Toca la política de moderación, el texto de reporte de abuso, o qué se verifica antes de publicar?
- [ ] ¿Agrega un servicio externo, una dependencia con coste mensual, o un proveedor de infraestructura nuevo?
- [ ] ¿Introduce una afirmación pública nueva sobre cantidades, resultados, garantías o confianza (§5)?
- [ ] ¿Cambia texto legal o de privacidad?
- [ ] ¿Adelanta trabajo de una fase posterior a una fase anterior?
- [ ] ¿Alguna decisión requiere elegir entre dos opciones cuyo impacto no está resuelto en estos documentos?

**Cómo se escala:** abrir un issue titulado `ESCALACIÓN: <tema>` con la opción A, la opción B, qué recomienda el implementador y qué queda bloqueado. No abrir el PR con la decisión ya tomada.

---

## 5. Reglas anti-fabricación (no negociables)

Aplican a código, contenido, copy, datos de prueba y datos estructurados. Se heredan en cada sesión futura vía `CLAUDE.md`.

1. **Ningún número público que no provenga de una consulta real a la base o de una medición real.** Nada de "más de 500 motos publicadas" escrito a mano.
2. **Ninguna publicación falsa, ni siquiera como demo.** Los datos de prueba viven en desarrollo y jamás se despliegan a producción. Si producción está vacía, se muestra vacía con un estado vacío honesto.
3. **Ninguna reseña, testimonio, calificación ni contador de urgencia inventado.** Sin `AggregateRating` ni `Review` en JSON-LD mientras no existan reseñas reales verificadas.
4. **Ningún logo de comercio, marca o aliado sin acuerdo por escrito.**
5. **Ninguna promesa sobre aprobación de crédito, cobertura de seguro o estado mecánico de una moto.** El sitio deriva; no aprueba, no asegura, no garantiza.
6. **Ningún "el portal N°1", "el más grande", "líder" ni superlativo comparativo no demostrable.**
7. **Cifras de mercado sin fuente citable: se omiten.** Si hace falta una, se escribe `[VERIFICAR: <qué hay que confirmar y dónde>]` y no se publica hasta confirmarse.
8. **Los estados vacíos dicen la verdad** y ofrecen una acción útil (avisame cuando haya, buscá en otra ciudad), nunca simulan actividad.

---

## 6. Nota sobre diseño visual

Decisión del propietario: **el diseño visual se resuelve después, en una pasada dedicada de Claude Design.** Estos documentos y la implementación de Sonnet priorizan la fontanería: modelo de datos, rutas, eventos, integraciones, moderación, SEO técnico y admin.

Qué significa en la práctica para el implementador:

- Usar un sistema de estilos mínimo y consistente (Tailwind con tokens en `globals.css`), sin librería de componentes pesada, sin animaciones elaboradas, sin ilustraciones a medida.
- **El HTML debe ser semánticamente correcto y accesible** aunque sea feo: encabezados jerárquicos, `label` en cada input, foco visible, contraste suficiente, `alt` real en las imágenes. El rediseño posterior cambia estilos, no estructura — y eso sólo funciona si la estructura está bien.
- Mobile-first obligatorio: el usuario paraguayo llega desde un Android de gama media con datos móviles. El presupuesto de rendimiento no es negociable aunque el diseño sea provisional.
- No invertir tiempo en pulido visual del admin. Tablas y formularios funcionales.
- Mantener las clases de estilo separadas de la lógica para que la pasada de diseño no tenga que reescribir componentes enteros.

---

## 7. Riesgos, ordenados por probabilidad × daño

| # | Riesgo | Probabilidad | Daño | Mitigación | Documento |
|---|---|---|---|---|---|
| 1 | Sitio vacío: no se firman comercios | Alta | Fatal | Vender a comercios antes de escribir código de fase 2; criterio de salida del MVP exige 5 comercios reales | `DATA_SEEDING.md` |
| 2 | Leads capturados sin comprador (sin financiera aliada) | Alta | Alto | Derivar leads a los comercios como valor mientras tanto; cerrar financiera en fase 3 | `MONETIZATION.md` |
| 3 | Explosión de páginas finas programáticas | Alta | Alto | Umbral de indexación + desindexación automática | `SEO_ARCHITECTURE.md` |
| 4 | Estafa con repercusión pública | Media | Alto | Política de moderación previa, reporte visible, verificación de comercios | `TRUST_AND_SAFETY.md` |
| 5 | Moderación manual insostenible | Media | Medio | Cola optimizada por teclado, autoaprobación de comercios verificados | `ADMIN_SPEC.md` |
| 6 | Costes de LLM/servicios inesperados | Baja | Medio | Sin servicios externos en fase 1 | §2.5 |
| 7 | Cumplimiento de Ley 6534/2020 mal resuelto | Media | Medio | Minimización de datos, base legal explícita, revisión de abogado antes de fase 3 | `LEGAL_AND_COMPLIANCE.md` |
| 8 | Deuda de rendimiento por imágenes de usuarios | Media | Medio | Compresión en cliente + variantes + presupuesto de peso | `PRODUCT_SPEC.md` |
| 9 | Duplicación de publicaciones entre comercios | Media | Bajo | Detección por hash de imagen + marca/modelo/año/precio en moderación | `TRUST_AND_SAFETY.md` |

**Número que mata el proyecto:** si a los 6 meses de tener 150+ publicaciones vivas el sitio genera menos de 20 leads de financiación al mes con tendencia plana, la tesis de §1.2 es falsa y hay que pivotar o cerrar. Definición exacta y medición en `ANALYTICS_AND_KPIS.md`.

---

## 8. Mapa de documentos

| Documento | Qué decide |
|---|---|
| `PLAN.md` | Este. Estrategia, stack, MVP, ownership, riesgos |
| `DECISIONS.md` | Registro numerado de decisiones y supuestos |
| `DATA_SEEDING.md` | Cómo hay inventario el día uno sin inventar nada |
| `PRODUCT_SPEC.md` | Roles, flujos, pantallas, estados |
| `SEO_ARCHITECTURE.md` | URLs, indexación, canonical, sitemaps, JSON-LD |
| `DATABASE_SCHEMA.md` | Tablas, índices, estados, tipos |
| `ADMIN_SPEC.md` | Pantallas de administración y permisos |
| `MONETIZATION.md` | Líneas de ingreso, precios, cobro |
| `TRUST_AND_SAFETY.md` | Fraude, moderación, reportes |
| `CONTENT_STRATEGY.md` | Editorial + guía de estilo español paraguayo |
| `INTEGRATIONS.md` | WhatsApp, VenderCRM, analytics, pagos |
| `ANALYTICS_AND_KPIS.md` | Eventos, definiciones, tablero, número de corte |
| `LEGAL_AND_COMPLIANCE.md` | Términos, privacidad, Ley 6534/2020 |
| `TEST_PLAN.md` | Verificación por fase |
| `IMPLEMENTATION_PHASES.md` | Fases, alcance, criterios de salida |
| `CLAUDE_TASKS.md` | Tareas ejecutables, una por PR |
| `CLAUDE.md` | Guardarraíles que se cargan en cada sesión |
