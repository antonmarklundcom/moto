# DECISIONS.md — registro de decisiones (ADR)

Registro numerado de decisiones no obvias. Cada entrada: qué se decidió, qué se descartó, por qué, y qué haría revisarla.

**Regla:** ninguna sesión futura revierte una decisión de este archivo sin agregar una entrada nueva que la supersede. No se edita una decisión existente salvo para marcarla como superseded y enlazar a la nueva.

**Estados:** `Aceptada` · `Superseded por ADR-XX` · `Supuesto (pendiente de confirmación del propietario)`

---

## Supuestos pendientes de confirmación

Estas ocho respuestas fueron asumidas por la sesión de planificación porque el propietario pidió avanzar sin esperar. **Si alguna es falsa, revisar los ADR indicados.**

| # | Pregunta | Respuesta asumida | ADR afectados si cambia |
|---|---|---|---|
| S-1 | ¿Hay relaciones ya existentes con comercios de motos? | No. Se parte de cero. | ADR-02, ADR-12, `DATA_SEEDING.md` completo |
| S-2 | ¿Hay acuerdo con alguna financiera o casa de crédito? | No. | ADR-03, ADR-13 |
| S-3 | ¿El propietario tiene motos propias para vender ahora? | No. | ADR-12, fase 6 |
| S-4 | ¿Presupuesto mensual para tráfico pago? | Cercano a cero. Crecimiento vía SEO y venta directa. | ADR-14, `CONTENT_STRATEGY.md` |
| S-5 | ¿Quién modera a diario? | El propietario, volumen bajo. | ADR-09, ADR-10 |
| S-6 | ¿VenderCRM tiene tenant y API key para este sitio? | El producto existe; el tenant y la key todavía no están configurados. | ADR-08 |
| S-7 | ¿Cuentas de vendedor en v1? | No. Publicación sin cuenta + moderación. | ADR-05 |
| S-8 | ¿Hay entidad/RUC paraguayo para facturar planes? | Sí. | ADR-15 |

---

## ADR-01 — El producto se lanza como portal de comercios + leads de financiación, no como marketplace C2C

**Estado:** Aceptada · 2026-08-03

**Decisión.** El posicionamiento y el orden de construcción se organizan alrededor de los comercios y de la captación de leads de financiación. La publicación gratuita para particulares existe como mecanismo de inventario y de SEO, no como el producto central.

**Alternativas descartadas.**
- *Marketplace C2C puro estilo clasificado.* Descartada: compite de frente con Facebook Marketplace y grupos de WhatsApp, que son gratis, instantáneos y ya tienen la red. Y el particular no genera ingresos.
- *Portal exclusivo de comercios, sin publicación de particulares.* Descartada: pierde la cola larga de motos usadas, que es la que produce la mayor parte del tráfico de búsqueda de larga cola.

**Por qué.** En Paraguay la moto se compra en cuotas; la búsqueda es en gran parte una búsqueda de financiación. Ese problema está mal resuelto hoy y produce leads con valor económico real, a diferencia del clic de contacto entre particulares.

**Qué la revisaría.** Que a los 6 meses el tráfico y la recurrencia vengan mayoritariamente del lado C2C y los comercios no conviertan; o que aparezca un competidor que resuelva la financiación primero y mejor.

---

## ADR-02 — El primer usuario a conseguir es un comercio, no un vendedor particular

**Estado:** Aceptada · 2026-08-03

**Decisión.** El criterio de salida del MVP exige ≥ 5 comercios reales y ≥ 150 publicaciones reales. La venta a comercios ocurre **en paralelo al desarrollo**, no después.

**Alternativas descartadas.** Lanzar abierto y esperar que los particulares llenen el sitio. Descartada: es el arranque en frío circular descrito en `PLAN.md` §1.1b.

**Por qué.** Un comercio aporta entre 10 y 80 publicaciones de una vez, con fotos decentes y datos consistentes. Un particular aporta una, mal fotografiada.

**Qué la revisaría.** Que los comercios rechacen sistemáticamente publicar en un sitio nuevo (probable al principio) y que la única vía sea comprar inventario. Ver `DATA_SEEDING.md` plan B.

---

## ADR-03 — El flujo de financiación entra en el MVP, no en una fase posterior

**Estado:** Aceptada · 2026-08-03

**Decisión.** La landing de financiación, el formulario de solicitud y el envío del lead a VenderCRM son parte de la fase 1.

**Alternativas descartadas.** Financiación en fase 4, como decía el brief original. Descartada explícitamente.

**Por qué.** Es la única línea de ingreso con valor unitario alto y es la tesis central del proyecto (ADR-01). Un MVP sin ella es un clasificado más, que es justo lo que `PLAN.md` §1.1 argumenta que no funciona. Además, sin el flujo en producción no se puede validar la tesis con datos.

**Nota importante.** Aunque no exista todavía una financiera aliada (S-2), el flujo se construye igual: los leads se derivan al comercio dueño de la moto y quedan en VenderCRM. Capturar desde el día uno crea el activo que después se vende.

**Qué la revisaría.** Nada razonable. Si esto se saca del MVP, hay que replantear el proyecto entero.

---

## ADR-04 — Stack: Next.js 15 App Router + Drizzle + MySQL en Hostinger Node

**Estado:** Aceptada · 2026-08-03

**Decisión.** Ver `PLAN.md` §2 para las seis funciones que lo justifican y los cuatro costes que implica.

**Alternativas descartadas.**
- *PHP/MySQL.* Haría el 70% bien. Se descarta por la superficie SEO generada e invalidada dinámicamente y por el pipeline de imágenes.
- *PHP primero y migrar a Node después.* Descartada: pagar dos veces por lo mismo y migrar URLs con SEO ya ganado es el peor de los mundos.
- *Static site + headless CMS.* Descartada: el inventario cambia a diario y hay moderación, cuentas y leads. No es un sitio estático.

**Qué la revisaría.** Que Hostinger Node resulte inviable operativamente, o que aparezca la necesidad de traspasar el mantenimiento a un desarrollador local PHP.

---

## ADR-05 — Sin cuentas de usuario en la fase 1

**Estado:** Aceptada · 2026-08-03 · depende de S-7

**Decisión.** Publicación mediante formulario público sin registro. La publicación se vincula a un teléfono verificado por moderación manual. Las cuentas de comercio llegan en fase 2; las de particular, quizá nunca.

**Alternativas descartadas.** Auth completo desde el día uno. Descartada: construir auth, recuperación de contraseña, verificación de email y dashboards antes de tener usuarios es trabajo especulativo caro.

**Por qué.** Cada campo obligatorio de registro reduce publicaciones. Con volumen bajo, la moderación humana cubre lo que haría el auth.

**Consecuencia técnica que NO se pospone.** La tabla `users` con enum `role` (`admin | moderator | dealer | seller`) existe desde la primera migración aunque sólo haya admins. Agregar roles después obliga a retrofitear cada verificación de permisos.

**Qué la revisaría.** Superar ~40 publicaciones semanales de particulares, o que los comercios pidan autogestión.

---

## ADR-06 — Precios en guaraníes como entero, nunca decimal ni float

**Estado:** Aceptada · 2026-08-03

**Decisión.** `price_gs BIGINT` sin decimales. El guaraní no usa centavos en la práctica comercial. Formato de presentación: `Gs. 12.500.000` (punto como separador de miles).

**Alternativas descartadas.** `DECIMAL(12,2)` — arrastra decimales que no existen. `FLOAT` — inaceptable para dinero, siempre.

**Qué la revisaría.** Nada. Si aparecen precios en USD (posible en motos importadas de alta gama), se agrega una columna `price_usd` separada y una `currency`, nunca se mezclan en el mismo campo.

---

## ADR-07 — Los clics de WhatsApp pasan por un endpoint rastreado del servidor antes de redirigir

**Estado:** Aceptada · 2026-08-03

**Decisión.** Los CTA de WhatsApp apuntan a una ruta propia que registra un evento `whatsapp_click` y luego responde con una redirección a `wa.me` con el mensaje pre-cargado.

**Alternativas descartadas.**
- *Enlace `wa.me` directo en el HTML.* Descartada: la conversión principal del sitio sería invisible para siempre.
- *Sólo evento de analytics en cliente.* Descartada: los bloqueadores lo comen y no queda en nuestra base para atribuir a la publicación ni al comercio.

**Coste aceptado.** Un salto extra de red antes de abrir WhatsApp. Se mitiga con una respuesta 302 mínima sin render.

**Qué la revisaría.** Que la latencia medida degrade la tasa de clic de forma detectable.

---

## ADR-08 — Los clics de WhatsApp comprador→vendedor NO se envían a VenderCRM

**Estado:** Aceptada · 2026-08-03 · depende de S-6

**Decisión.** A VenderCRM van sólo: leads de financiación, leads de seguro, consultas de plan de comercio y consultas de publicidad. El contacto de un comprador con un vendedor particular se registra como evento propio pero no crea contacto en el CRM.

**Por qué.** Ese lead es del vendedor, no del propietario del sitio. Meterlo en el pipeline propio ensucia el CRM con contactos no accionables, dispara el límite de 60/min y confunde la métrica de leads comerciales.

**Qué la revisaría.** Que se lance un producto de intermediación donde el sitio sí participe de la venta C2C.

---

## ADR-09 — Moderación previa a la publicación, no posterior

**Estado:** Aceptada · 2026-08-03 · depende de S-5

**Decisión.** Toda publicación de particular pasa por `pending_review` antes de ser pública. Los comercios verificados pueden tener autoaprobación activable por comercio.

**Alternativas descartadas.** Publicar y moderar después. Descartada: con volumen bajo el coste de moderar previo es mínimo, y una moto robada o una estafa pública en un sitio nuevo es un daño reputacional del que no se vuelve.

**Coste aceptado.** Fricción y demora para el vendedor. Se mitiga con un SLA declarado (revisión en menos de 24 h) y una cola optimizada para teclado.

**Qué la revisaría.** Superar el volumen que una persona puede moderar (~50/día). Entonces: autoaprobación con revisión por muestreo y señales de riesgo.

---

## ADR-10 — Sin reseñas de vendedores ni comercios hasta tener volumen

**Estado:** Aceptada · 2026-08-03

**Decisión.** No hay sistema de reseñas ni calificaciones en fase 1–3, y por lo tanto no se emite `Review` ni `AggregateRating` en JSON-LD.

**Por qué.** Con poco volumen, las reseñas son trivialmente manipulables, generan responsabilidad legal y no aportan señal. Y emitir markup de reseñas sin reseñas reales es fabricación (ver `PLAN.md` §5).

**Qué la revisaría.** Volumen suficiente de transacciones verificables. Requiere primero saber cuándo una venta ocurrió, dato que hoy no tenemos.

---

## ADR-11 — Marcas y modelos normalizados en catálogo, nunca texto libre

**Estado:** Aceptada · 2026-08-03

**Decisión.** `brands` y `models` son tablas semilla. El formulario de publicación ofrece selección; el texto libre sólo alimenta un campo `model_raw` que un moderador mapea al catálogo.

**Alternativas descartadas.** Campo de texto libre para modelo. Descartada: destruye la búsqueda facetada y las páginas SEO programáticas, que son el motor del proyecto. "CG150", "cg 150", "Honda CG 150 Titan" serían tres modelos distintos.

**Coste aceptado.** Trabajo de curaduría del catálogo y fricción cuando falta un modelo. Se mitiga con una cola de "modelos propuestos" en el admin.

**Nota de verificación.** El catálogo semilla de marcas presentes en Paraguay debe construirse a partir de fuentes reales (sitios de importadoras y comercios), no de memoria. Marcar `[VERIFICAR]` cualquier marca no confirmada.

---

## ADR-12 — Inventario inicial vía acuerdos con comercios, nunca por scraping ni datos inventados

**Estado:** Aceptada · 2026-08-03

**Decisión.** Ver `DATA_SEEDING.md`. Sólo se carga stock de terceros con permiso escrito. No se publican datos fabricados ni de demostración en producción, en ningún caso.

**Alternativas descartadas.** *Scrapear stock público de comercios y publicarlo sin avisar.* Descartada por razones legales, de reputación comercial (son los futuros clientes) y de calidad de datos.

**Qué la revisaría.** Nada respecto a la fabricación. El método de obtención con permiso puede evolucionar (feeds, CSV, API).

---

## ADR-13 — Sin pasarela de pago automatizada en fase 1

**Estado:** Aceptada · 2026-08-03

**Decisión.** Cobro por transferencia bancaria / billetera, cotizado y confirmado por WhatsApp, marcado a mano en el admin con fecha de vencimiento del plan o del destacado.

**Alternativas descartadas.** Integrar Bancard/vPOS desde el inicio. Descartada: integración con coste y burocracia real antes de tener el primer cliente pagante.

**Qué la revisaría.** Más de ~15 cobros mensuales manuales, o demanda concreta de autogestión de pago por parte de comercios.

---

## ADR-14 — Crecimiento liderado por SEO y venta directa, no por tráfico pago

**Estado:** Aceptada · 2026-08-03 · depende de S-4

**Decisión.** El plan de crecimiento asume presupuesto publicitario cercano a cero. La inversión va en contenido, estructura técnica y llamadas a comercios.

**Qué la revisaría.** Que aparezca presupuesto, o que se valide un lead de financiación con valor suficiente para pagar tráfico rentablemente.

---

## ADR-15 — El diseño visual se pospone a una pasada dedicada posterior

**Estado:** Aceptada · 2026-08-03 · decisión explícita del propietario

**Decisión.** La implementación prioriza la fontanería (datos, rutas, eventos, integraciones, moderación, SEO técnico, admin). El estilo es mínimo y consistente hasta que llegue un pase dedicado de diseño.

**Restricción que NO se relaja.** HTML semántico, accesible y mobile-first con presupuesto de rendimiento. El rediseño posterior cambia estilos, no estructura; eso sólo funciona si la estructura está bien desde el principio. Ver `PLAN.md` §6.

---

## ADR-16 — Almacenamiento de imágenes en disco tras una interfaz de abstracción

**Estado:** Aceptada · 2026-08-03

**Decisión.** Fase 1 guarda en el disco del slot de Hostinger, pero todo el acceso pasa por una única interfaz de almacenamiento (`put`, `get`, `delete`, `url`).

**Por qué.** Evita un servicio externo y su coste el día uno, sin encerrarse: mover a object storage después es cambiar una implementación, no cazar rutas por todo el código.

**Qué la revisaría.** Presión de espacio en disco del slot, o necesidad de CDN por volumen de tráfico.
