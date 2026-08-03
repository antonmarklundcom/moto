# DATA_SEEDING.md — cómo hay inventario el día uno

**Riesgo que este documento resuelve:** el número 1 de `PLAN.md` §7. Un clasificado vacío no es un clasificado chico — es un sitio que destruye confianza en la primera visita y no la recupera.

**Regla que gobierna todo este documento:** *nunca* se publica una moto que no exista, no se publica stock de un tercero sin permiso escrito, y no se despliegan datos de demostración a producción. Ver ADR-12 y `PLAN.md` §5.

---

## 1. Cuánto inventario hace falta, realmente

| Umbral | Publicaciones vivas | Qué habilita |
|---|---|---|
| Mínimo para no dar vergüenza | 80 | El sitio se puede mostrar a un comercio sin excusarse |
| Criterio de salida del MVP | 150, de ≥ 5 comercios | Búsqueda con filtros útil; páginas de marca con contenido real |
| Masa crítica para SEO programático | ~400 | Suficientes combinaciones marca × ciudad superan el umbral de indexación |
| Punto donde el C2C empieza a auto-alimentarse | ~1.200 | Hipótesis, no dato. Validar antes de asumirlo |

**No se lanza público hasta 80.** Antes de eso el sitio existe pero se usa sólo como demo en las reuniones con comercios (ver §3).

---

## 2. Opciones de arranque, ordenadas por realismo

### Opción A — Acuerdos con comercios: publicación gratuita a cambio de stock ⭐ principal

**Qué es.** Se contactan entre 15 y 25 comercios de motos; se cierran de 5 a 15. Reciben publicación ilimitada gratis por 12 meses, página de comercio propia y los leads de sus motos directo a su WhatsApp. A cambio, autorizan por escrito publicar su stock y entregan los datos (CSV, planilla, fotos, o acceso a su catálogo).

**Por qué es la principal.** Es la única opción que aporta volumen, calidad de datos y al mismo tiempo construye la relación comercial que después se monetiza (ADR-02). El costo es tiempo de venta, no dinero.

**Qué hay que tener listo antes de la primera llamada:**
- El sitio funcionando con al menos 20 motos cargadas, para poder mostrarlo. Un PDF no vende esto.
- Una página de comercio de ejemplo, aunque sea con el stock del propio comercio ya cargado en vivo durante la reunión.
- El texto de autorización (§5).
- Una respuesta honesta a "¿cuánta gente entra?": **"Estamos arrancando, hoy el tráfico es bajo. Por eso es gratis 12 meses: vos ponés el stock, yo pongo el trabajo de traer las visitas."** No inventar números. La honestidad acá es lo que hace que el comercio te reciba de nuevo en seis meses.

**Objeciones esperables y la respuesta real:**

| Objeción | Respuesta |
|---|---|
| "Ya tengo Facebook" | Facebook no aparece en Google cuando alguien busca `honda cg 150 precio paraguay`. Esto sí, y esa persona ya sabe qué quiere. |
| "¿Cuánto tráfico tenés?" | Poco, estamos arrancando; por eso es gratis. (Nunca inflar.) |
| "No tengo tiempo de cargar" | Lo cargo yo. Mandame la planilla o las fotos. |
| "¿Y después me vas a cobrar?" | Sí, a los 12 meses, y vas a poder decidir con datos tuyos de leads recibidos. |
| "¿Me vas a robar los clientes?" | Los leads de tus motos van a tu WhatsApp directo. Los de financiación los trabajamos juntos. |

**Objetivo de la fase de venta:** 15 contactos → 8 reuniones → 5 acuerdos → ~150 publicaciones. Estas son metas de trabajo, no proyecciones de negocio.

---

### Opción B — Carga manual de stock público **con permiso previo** ⭐ complemento de A

**Qué es.** Muchos comercios publican su stock en Facebook o en su web. Tras obtener autorización escrita (§5), se cargan esas publicaciones a mano o semi-automáticamente.

**Cuándo se usa.** Sólo *después* del sí del comercio, como forma de ejecutar la opción A sin darle trabajo al comercio. **Nunca antes del sí.**

**Lo que está prohibido.** Scrapear y publicar sin permiso. Es un problema legal, arruina la relación con el futuro cliente y produce datos sucios (precios viejos, motos vendidas). Ver ADR-12.

---

### Opción C — Stock propio del propietario

**Qué es.** Publicar las motos propias que el propietario tenga para vender.

**Realismo.** Bajo hoy (supuesto S-3: no hay stock propio). Se mantiene en el documento porque en fase 6 el sitio vende inventario propio y entonces esta vía se reactiva.

---

### Opción D — Captación directa de particulares (campañas en grupos y ferias)

**Qué es.** Publicar la existencia del sitio en grupos de compraventa de motos, ferias y talleres, ofreciendo publicación gratis.

**Realismo.** Medio-bajo como fuente de arranque; bueno como sostenimiento posterior. Un particular aporta una publicación de calidad variable. Sirve para la cola larga de usadas, que es tráfico SEO valioso, pero no resuelve el arranque.

**Advertencia:** publicar en grupos de Facebook ajenos suele violar sus reglas y quema la marca. Hacerlo sólo donde esté permitido.

---

### Opción E — Pagar por las primeras publicaciones

**Qué es.** Incentivo económico a particulares por publicar.

**Realismo.** Bajo. Caro por unidad, atrae publicaciones de baja calidad y gente que sólo viene por el incentivo. **Descartada** salvo como experimento acotado y medido.

---

### Ranking final

1. **A — Acuerdos con comercios.** Es el plan.
2. **B — Carga con permiso.** Es cómo se ejecuta A sin fricción.
3. **D — Particulares.** Sostenimiento, no arranque.
4. **C — Stock propio.** Se reactiva en fase 6.
5. **E — Pago por publicación.** Descartada.

---

## 3. Secuencia real de arranque

Nótese que la venta ocurre **antes** de que el sitio esté terminado. Esto es deliberado.

| Momento | Estado del producto | Actividad comercial |
|---|---|---|
| Semana 0 | Nada | Armar la lista de 25 comercios objetivo con nombre, ciudad, teléfono y dónde publican hoy |
| Fase 0–1 en curso | Búsqueda + ficha funcionando, sin público | Primeras 5 conversaciones. Objetivo: aprender objeciones, no cerrar |
| ≥ 20 publicaciones cargadas | Demo mostrable en vivo | Reuniones en serio. Cargar el stock del comercio durante la reunión si se puede |
| ≥ 80 publicaciones | Se abre al público, `noindex` fuera | Seguir cargando |
| ≥ 150 de ≥ 5 comercios | Se quita `noindex`, se envían sitemaps | Contenido y SEO pasan a primer plano |

**Regla de indexación durante el arranque:** el sitio permanece con `noindex` global hasta superar las 150 publicaciones. Que Google descubra primero un sitio vacío es una desventaja de arranque difícil de revertir. Esta regla debe estar implementada como una variable de entorno explícita (`SITE_NOINDEX=true`), no como un olvido.

---

## 4. Calidad de datos: qué se carga y qué no

Toda publicación cargada durante el arranque cumple lo mismo que exigiría el moderador a un particular:

- Marca y modelo mapeados al catálogo (ADR-11), nunca texto libre.
- Año, kilometraje si es usada, cilindrada, condición.
- Precio real en guaraníes. Si el comercio sólo publica cuota, se pide el precio de contado; si no lo da, la publicación indica claramente que sólo hay precio financiado.
- Mínimo 1 foto real de la unidad o, en motos 0 km, la foto oficial del modelo — **identificada como foto de catálogo, no de la unidad**.
- Ciudad del comercio.
- Fecha de última verificación de disponibilidad.

**Se rechaza:** publicaciones sin precio de ningún tipo, fotos con marca de agua de otro portal, texto copiado de otro clasificado, y unidades cuya disponibilidad no se pudo confirmar en los últimos 30 días.

---

## 5. Texto de autorización

A confirmar con abogado antes de usarse (ver `LEGAL_AND_COMPLIANCE.md`). Borrador de trabajo, por WhatsApp o correo, con respuesta afirmativa guardada:

> Hola [nombre], te confirmo lo que hablamos. **[Comercio]** autoriza a moto.com.py a publicar su stock de motos (fotos, precios, descripciones y datos de contacto) en el sitio, sin costo, por 12 meses desde hoy. Las consultas de tus motos te llegan directo a tu WhatsApp. Podés pedir que saquemos tus publicaciones cuando quieras, avisando por este mismo medio, y las bajamos en 48 horas. Después de los 12 meses te paso una propuesta de plan y decidís con los datos de leads que hayas recibido. ¿Confirmás?

Se guarda en el admin: el texto, la fecha, el medio y la respuesta. Campo `authorization_note` + `authorization_date` en `dealers`.

---

## 6. Manejo honesto del vacío mientras dure

Mientras el inventario sea bajo, el producto lo dice en lugar de simularlo:

- Búsqueda sin resultados: *"Todavía no tenemos motos que coincidan con esta búsqueda."* + avisador por email/WhatsApp + enlaces a búsquedas cercanas con resultados reales.
- Página de ciudad con pocas motos: se muestra el número real y se ofrecen ciudades cercanas. No se rellena con motos de otra ciudad haciéndolas pasar por locales.
- Página de ciudad por debajo del umbral: `noindex, follow` automático (regla en `SEO_ARCHITECTURE.md`).
- **Nunca** contadores inventados, "más de X motos", ni motos de ejemplo.

---

## 7. Cómo se mide si esto funciona

| Métrica | Frecuencia | Umbral de alarma |
|---|---|---|
| Comercios contactados / con reunión / cerrados | Semanal | < 3 contactos por semana |
| Publicaciones vivas | Semanal | Estancado 2 semanas seguidas |
| Publicaciones por comercio | Mensual | Un comercio con 0 altas en 30 días = relación fría |
| Publicaciones vencidas sin renovar | Mensual | > 30% del total |
| Publicaciones de particulares por semana | Semanal | Es la señal de si el C2C arranca solo |

Definiciones y eventos en `ANALYTICS_AND_KPIS.md`.

---

## 8. Plan B si a los 60 días no hay comercios firmados

Escenario real, no hipotético. Si tras ~20 contactos hay menos de 3 acuerdos:

1. **Diagnosticar cuál es el no.** ¿"No me interesa el canal" o "no confío en un sitio nuevo"? Son problemas distintos: el primero mata la tesis, el segundo se resuelve con tiempo y con tráfico demostrable.
2. **Invertir el orden.** Construir tráfico primero con contenido (guías de transferencia de chapa, comparativas de modelos, cómo funcionan las cuotas) y volver a los comercios con visitas medibles en la mano. Es más lento pero cambia la conversación por completo.
3. **Estrechar el foco.** Un solo segmento — por ejemplo motos 0 km financiadas en Asunción y Central — y ser el mejor ahí antes de abrir.
4. **Reevaluar ADR-01** con lo aprendido. Si los comercios no quieren canal pero los particulares publican solos, la tesis del proyecto era otra y hay que reescribirla, no forzarla.
