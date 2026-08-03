# MONETIZATION.md

Normativo en mecánica. Cambiar un precio, un plan, la duración de un destacado o la forma de cobro exige escalar a Opus (`PLAN.md` §4.3).

**Regla que atraviesa el documento:** donde no hay una tarifa validada con el mercado, dice `[VALIDAR]`. No se inventan precios para que el documento se vea completo (`PLAN.md` §5).

---

## 1. Ranking por realismo × esfuerzo × tiempo hasta el primer guaraní

| # | Línea | Realismo | Esfuerzo | Primer ingreso | Techo | Veredicto |
|---|---|---|---|---|---|---|
| 1 | **Leads de financiación** | Alto | Medio | Mes 4–8 | Alto | **Es el negocio.** Fase 1 captura, fase 3 monetiza |
| 2 | **Planes de comercio** | Alto | Bajo | Mes 12+ | Medio-alto | Base recurrente. Gratis 12 meses primero (ADR-02) |
| 3 | **Publicaciones destacadas** | Medio | Bajo | Mes 6 | Bajo | Ingreso temprano y simple. No sostiene el proyecto |
| 4 | **Publicidad directa** (talleres, repuesteras, seguros) | Medio | Bajo | Mes 6–9 | Medio | Requiere tráfico demostrable |
| 5 | **Leads de seguro** | Medio | Bajo | Mes 9+ | Medio | Complemento natural del de financiación |
| 6 | **Inventario propio** | Medio | Alto | Fase 6 | Alto | Otro negocio (capital, stock, logística) |
| 7 | **Repuestos y accesorios** | Bajo-medio | Alto | Fase 6+ | Medio | Otro modelo de datos y otra operación |
| 8 | **AdSense / programática** | Alto en facilidad, bajo en retorno | Muy bajo | Inmediato | Muy bajo | **Sólo relleno.** Ver §7 |
| 9 | Cobrar por publicar a particulares | Alto | Bajo | Inmediato | Muy bajo | **Descartada.** Mata el inventario, que es el activo |

---

## 2. Leads de financiación — la línea principal

### 2.1 Por qué

En Paraguay la moto se compra mayoritariamente en cuotas. El comprador no busca "una moto": busca una cuota que le entre en el presupuesto. Una persona que declara modelo de interés, entrega disponible, plazo deseado y situación laboral es un lead con valor económico real para un comercio o una financiera — a diferencia de un clic de contacto entre particulares, que no vale nada para nosotros.

### 2.2 Cómo se captura

Desde la ficha y desde `/financiacion` (`PRODUCT_SPEC.md` §2.3). Se guarda en `leads` y se envía a VenderCRM (`INTEGRATIONS.md`).

### 2.3 Cómo se monetiza, por etapas

| Etapa | Modelo | Nota |
|---|---|---|
| Fase 1–2 (sin aliado) | El lead se deriva gratis al comercio dueño de la moto | Genera reciprocidad y demuestra valor antes de cobrar. Es argumento de venta para el plan |
| Fase 3 | Pago por lead cualificado a comercio o financiera | Precio `[VALIDAR con 3 comercios y 2 financieras]` |
| Fase 4 | Comisión por operación concretada | Requiere confianza y seguimiento del cierre. Difícil de auditar; probablemente no valga la pena |

**Recomendación:** pago por lead cualificado, con definición de "cualificado" acordada por escrito (teléfono contactable, intención real, datos completos). Sin esa definición, toda relación de leads termina en discusión.

### 2.4 Lo que se puede y no se puede prometer

**Se puede:** derivar con un comercio o una financiera, orientar sobre cómo funciona comprar en cuotas, mostrar entrega y cuota publicadas por el comercio.

**No se puede** (`PLAN.md` §5, `LEGAL_AND_COMPLIANCE.md`): prometer aprobación, prometer tasa, decir "sin veraz" o "aprobación garantizada", calcular una cuota propia presentándola como oferta, pedir cédula o datos bancarios, ni cobrarle al comprador por gestionar.

Texto obligatorio junto a todo formulario de financiación:
> Te contactamos para orientarte y derivarte con el comercio o la financiera. moto.com.py no otorga créditos ni garantiza aprobación.

---

## 3. Planes de comercio

### 3.1 Estructura

| Código | Qué incluye | Precio |
|---|---|---|
| `gratuito_12m` | Publicaciones ilimitadas, página de comercio, leads directos a su WhatsApp | Gs. 0 por 12 meses desde el alta |
| `basico` | Hasta N publicaciones, página de comercio, 1 destacado/mes | `[VALIDAR]` |
| `pro` | Publicaciones ilimitadas, N destacados/mes, prioridad en el listado, reporte mensual de leads | `[VALIDAR]` |

**Cómo se validan los precios, concretamente:** al mes 9 del período gratuito, con datos reales de leads entregados a cada comercio en la mano, se le pregunta a los 5 comercios cuánto pagarían. Se fija el precio con eso, no antes y no de memoria.

### 3.2 Argumento de venta al vencer el año gratis

Sólo funciona si en esos 12 meses se registró todo: *"En el último año te mandamos X consultas por WhatsApp y Y solicitudes de financiación."* Esos números salen de `listing_events` y `leads` — reales, verificables, mostrables en pantalla. Es la razón por la que la analítica propia es obligatoria desde fase 1 y no un lujo.

### 3.3 Lo que NO se hace

No se cobra por listar. No se restringe artificialmente el inventario de un comercio que no paga hasta que exista un mercado real (el inventario es el activo). No se venden posiciones de ranking dentro de los resultados de búsqueda sin marcarlas visiblemente como destacadas.

---

## 4. Publicaciones destacadas

- Duración: 7, 15 o 30 días. Precio `[VALIDAR]`.
- Qué da: posición prioritaria en su categoría/ciudad, marca visual, aparición en el bloque de destacadas de la home.
- **Siempre etiquetada como "Destacado".** Publicidad no señalada es engaño al usuario y problema con Google.
- Límite: máximo 3 destacadas simultáneas en la home y 20% de los resultados de un listado. Si todo está destacado, nada lo está.
- Cobro manual (ADR-13), registrado en `featured_purchases` con vencimiento; un job diario apaga las vencidas.

---

## 5. Publicidad directa

**Compradores reales en Paraguay:** talleres, repuesteras, cascos y accesorios, escuelas de manejo, aseguradoras, gestorías de transferencia, financieras.

Espacios: `home_hero`, `search_inline` (cada N resultados, marcado), `listing_sidebar`. Segmentables por ciudad, marca o categoría.

Precio `[VALIDAR]`. Se vende por mes, con reporte de impresiones y clics desde `ad_placements`.

**Requisito previo:** no se sale a vender publicidad hasta poder mostrar tráfico real de Search Console y analítica propia. Vender espacios sin audiencia quema la relación con quien después sería cliente de un plan.

---

## 6. Leads de seguro

Complemento natural: quien compra una moto necesita seguro contra terceros. Formulario en la ficha y en `/seguros`, lead a VenderCRM con `tipo_lead: seguro`.

Monetización: acuerdo de referencia con corredor o aseguradora, `[VALIDAR]`. Prohibido: cotizar nosotros, prometer cobertura o precio, o insinuar que somos intermediarios habilitados. `[VERIFICAR: qué exige la ley paraguaya para intermediar seguros — probablemente registro ante la Superintendencia. Confirmar con abogado antes de fase 3.]`

---

## 7. Publicidad programática (AdSense): por qué casi no cuenta

Hay que decirlo claro porque es la salida fácil: **el RPM en Paraguay es bajo.** Un sitio con tráfico modesto en un país chico no genera ingresos relevantes por display. Poner AdSense temprano tiene un costo real: ensucia la experiencia, compite con nuestros propios CTA de WhatsApp y financiación, y suma peso a páginas cuyo presupuesto de rendimiento ya es ajustado.

**Decisión:** sin AdSense en fases 1–3. Se reevalúa sólo si el tráfico crece mucho y los espacios directos quedan sin vender. La publicidad directa a comercios locales rinde varias veces más por espacio.

---

## 8. Métodos de cobro (Paraguay)

| Método | Fase 1 | Nota |
|---|---|---|
| Transferencia bancaria | Sí | Principal. Comprobante y conciliación manual |
| Tigo Money | Sí | Muy extendido |
| Billetera Personal | Sí | |
| Efectivo | Sí | Sólo en visita a comercio |
| Bancard / vPOS | No | Coste y burocracia antes del primer cliente pagante (ADR-13) |
| Tarjeta recurrente | No | Requiere pasarela |

Flujo de cobro completo en `INTEGRATIONS.md` §4. Facturación: `[VERIFICAR con contador: régimen aplicable, timbrado y facturación electrónica para servicios de publicidad digital en Paraguay]` — ver `LEGAL_AND_COMPLIANCE.md`.

---

## 9. Proyección: qué se puede afirmar y qué no

**No hay proyección de ingresos en este documento**, deliberadamente. Cualquier número sería inventado: no hay tarifas validadas, no hay tráfico medido y no hay tasa de conversión conocida (`PLAN.md` §5).

Lo que sí se puede afirmar:
- La primera plata realista llega por destacados y publicidad directa, alrededor del mes 6, y será chica.
- El ingreso recurrente empieza al vencer los 12 meses gratis de los primeros comercios.
- La línea de financiación es la única con techo alto, y depende de cerrar un acuerdo que hoy no existe (supuesto S-2).

**Cuándo se puede proyectar en serio:** cuando existan 3 meses de datos de leads de financiación y una tarifa acordada con al menos un comprador de leads. Antes de eso, cualquier modelo financiero es ficción.

---

## 10. Reglas anti-fabricación aplicadas a monetización

- Ningún precio publicado sin base real. `[VALIDAR]` es una respuesta aceptable; un número inventado no.
- Ningún "más de X comercios confían en nosotros" sin el conteo real.
- Ningún logo de comercio sin autorización escrita (ADR-12).
- Ninguna estadística de mercado sin fuente citable.
- Ningún contenido patrocinado sin etiquetar.
- Ninguna posición pagada en resultados sin marca visible de "Destacado".
- Ningún número de tráfico prometido a un anunciante que no salga de Search Console o de la analítica propia.
