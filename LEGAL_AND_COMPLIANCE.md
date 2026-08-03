# LEGAL_AND_COMPLIANCE.md

> **Advertencia obligatoria.** Este documento **no es asesoramiento legal** y no lo redactó un abogado. Es un inventario de obligaciones probables y de decisiones de producto que las afectan, escrito para que un abogado paraguayo pueda revisarlo rápido. Todo lo marcado `[CONFIRMAR CON ABOGADO]` debe resolverse **antes** de la fase indicada. Ninguna sesión futura debe convertir estas notas en afirmaciones legales dentro del sitio.

---

## 1. Posición jurídica del sitio

moto.com.py es una **plataforma de publicación de avisos**. No es parte de las operaciones, no posee los vehículos, no verifica titularidad ni condición mecánica, no intermedia pagos y no garantiza el resultado de ninguna operación.

Esto se declara en `/terminos`, en `/como-funciona` y en un aviso breve en cada ficha (`TRUST_AND_SAFETY.md` §1). Es la base de toda la limitación de responsabilidad, y por eso el producto no puede contradecirla en ningún lugar del sitio.

`[CONFIRMAR CON ABOGADO — antes de quitar SITE_NOINDEX]` alcance real de la responsabilidad de un intermediario digital en Paraguay por contenido publicado por terceros, y qué diligencia se espera de la plataforma.

---

## 2. Protección de datos — Ley N° 6534/2020

Paraguay cuenta con la Ley N° 6534/2020 de protección de datos personales crediticios. **Su alcance exacto y su aplicabilidad a este proyecto deben ser confirmados por un abogado** — el nombre y el número se registran acá como punto de partida de esa consulta, no como conclusión.

`[CONFIRMAR CON ABOGADO — antes de fase 3]`
- Qué régimen aplica a datos personales no crediticios en Paraguay hoy, y si hay normativa posterior a 2020 que corresponda.
- Si el tratamiento que hacemos (teléfonos, formularios de financiación, hashes de IP) exige registro, consentimiento expreso o aviso.
- Qué exige exactamente el hecho de que un formulario de financiación recoja **situación laboral y capacidad de pago declarada**, que es información sensible en la práctica aunque no sea un dato crediticio formal.
- Si la lista interna de teléfonos bloqueados por fraude (`TRUST_AND_SAFETY.md` §9) es lícita, con qué base y por cuánto tiempo.

### 2.1 Decisiones de producto ya tomadas para minimizar exposición

Se toman ahora porque son baratas ahora y caras después:

| Decisión | Motivo |
|---|---|
| No se guarda la IP cruda en eventos, sólo hash con sal | Minimización |
| No se pide cédula, ni datos bancarios, ni monto exacto de ingreso | No recolectar lo que no se necesita |
| El formulario de financiación usa **rangos**, no cifras exactas | Ídem |
| Doble opt-in obligatorio para alertas y boletín | Consentimiento demostrable |
| Datos de eventos crudos se purgan a los 180 días | Limitación de plazo |
| Cada formulario declara para qué se usan los datos y a quién se derivan | Transparencia |
| El lead se deriva a un tercero (comercio/financiera) → **hay que decirlo antes de enviar** | Es lo que más se olvida y lo más visible si se reclama |

### 2.2 Derechos de los titulares

`/privacidad` debe explicar cómo pedir acceso, rectificación o supresión, con un canal real (email + WhatsApp) y un plazo declarado. Debe existir un procedimiento interno para atenderlo — no alcanza con publicar la dirección.

---

## 3. Publicidad de productos financieros y de seguros

El punto de mayor riesgo regulatorio del proyecto, porque es también la principal línea de ingreso (`MONETIZATION.md`).

`[CONFIRMAR CON ABOGADO — antes de fase 3, bloqueante]`
- ¿Derivar leads a una financiera a cambio de pago constituye intermediación financiera regulada en Paraguay?
- ¿Y derivar leads de seguros? La intermediación de seguros suele exigir registro ante el regulador. **Verificar antes de firmar cualquier acuerdo.**
- ¿Qué debe informarse obligatoriamente al publicar una cuota o una tasa (CAT, costo total, condiciones)?
- ¿Se puede publicar la cuota que informa un comercio sin asumir responsabilidad por su exactitud?

### 3.1 Reglas de producto vigentes hasta que haya respuesta

- **Nunca** calculamos ni publicamos una cuota propia. Sólo mostramos la que declara el comercio, identificada como informada por él.
- **Nunca** se promete aprobación, tasa, plazo ni "sin informconf".
- El descargo de `PRODUCT_SPEC.md` §2.3 acompaña todo formulario de financiación.
- No se cobra al comprador por gestionar nada.
- No se usa la palabra "crédito preaprobado" en ninguna forma.

---

## 4. Facturación y régimen tributario

`[CONFIRMAR CON CONTADOR — antes del primer cobro]`
- Régimen aplicable a la venta de publicidad digital y servicios de suscripción para el titular del sitio.
- Timbrado y facturación electrónica: qué exige hoy la administración tributaria paraguaya para emitir comprobantes por estos servicios.
- Tratamiento del IVA en publicidad y en pago por lead.
- Si el pago por lead a una financiera tiene un tratamiento distinto al de publicidad.

Consecuencia de producto: `featured_purchases` y `dealer_plans` guardan monto real, método y referencia de pago, para que la conciliación contable sea posible sin reconstruir nada.

---

## 5. Textos legales que deben existir antes de abrir al público

| Página | Contenido mínimo | Cuándo |
|---|---|---|
| `/terminos` | Naturaleza de plataforma, normas de publicación, causales de baja, limitación de responsabilidad, propiedad del contenido subido, ley aplicable y jurisdicción | Antes de quitar `SITE_NOINDEX` |
| `/privacidad` | Qué datos se recogen, para qué, con quién se comparten (comercios, financieras, VenderCRM), cuánto se conservan, cómo ejercer derechos, cookies | Ídem |
| `/como-funciona` | Qué hacemos y qué no, en lenguaje claro y no legal | Ídem |
| Aviso en ficha | Una línea: no verificamos las unidades | Ídem |
| Aviso de cookies | Sólo si se usan cookies no esenciales | Al agregar analítica de terceros |

Los tres primeros se redactan con abogado. **Copiar términos de otro sitio es el error clásico y produce un documento que no describe este producto** — y, si describe cosas que no hacemos, empeora la posición en vez de mejorarla.

---

## 6. Contenido de terceros y propiedad intelectual

- Las fotos subidas por vendedores: los términos deben otorgar licencia de uso para mostrarlas en el sitio y en su promoción. `[CONFIRMAR CON ABOGADO]` alcance de la licencia.
- Fotos con marca de agua de otros portales: rechazo (`TRUST_AND_SAFETY.md` §4, código `fotos_ajenas`).
- Logos de marcas de motos: sólo uso nominativo para identificar el producto. Sin logo de comercio sin autorización escrita (ADR-12).
- Publicación de stock de comercios: sólo con la autorización registrada de `DATA_SEEDING.md` §5, guardada en `dealers.authorization_note`. **`[CONFIRMAR CON ABOGADO]` si ese texto por WhatsApp constituye autorización suficiente.**
- Contenido propio: aviso de derechos en el pie.

---

## 7. Menores y capacidad

`[CONFIRMAR CON ABOGADO]` edad mínima para publicar y si hace falta declararla. Los términos deben fijar una edad mínima de uso.

---

## 8. Comunicaciones comerciales

- WhatsApp saliente sólo hacia quien nos escribió o dejó su teléfono en un formulario declarando que lo contactaríamos.
- Sin mensajería masiva no solicitada.
- Boletín con doble opt-in y baja en un clic en cada envío.
- Toda plantilla de contacto identifica al sitio y el motivo del contacto.

---

## 9. Calendario de cumplimiento

| Momento | Qué debe estar resuelto |
|---|---|
| Antes de quitar `SITE_NOINDEX` | Términos, privacidad, cómo funciona, aviso en ficha, §1 |
| Antes del primer cobro | §4 con contador |
| Antes de firmar con una financiera o aseguradora | §3 completo, bloqueante |
| Antes de la lista de teléfonos bloqueados | §2 sobre licitud y plazo |
| Antes del boletín | §2.2 y §8 |

---

## 10. Regla permanente para sesiones futuras

Ninguna sesión de implementación escribe, edita ni "mejora" texto legal por su cuenta, ni traduce estas notas a afirmaciones dentro del sitio. Todo cambio en `/terminos`, `/privacidad` o en cualquier descargo **escala a Opus y de ahí al abogado** (`PLAN.md` §4.3). Un descargo bien intencionado escrito por un modelo puede empeorar la posición legal del sitio.
