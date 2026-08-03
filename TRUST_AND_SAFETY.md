# TRUST_AND_SAFETY.md

Los clasificados de vehículos atraen fraude. Un caso sonado en un sitio nuevo es un daño del que no se vuelve. Este documento se decide antes de construir porque retrofitearlo cuesta diez veces más.

Normativo: cambiar política de moderación, motivos de rechazo o el texto de denuncia exige escalar a Opus (`PLAN.md` §4.3).

---

## 1. Qué somos y qué no

**Somos una plataforma de publicación.** No somos parte de ninguna operación, no tenemos las motos, no verificamos la condición mecánica, no verificamos la titularidad, no intermediamos pagos y no garantizamos nada de lo que publica un tercero.

Esto se dice explícitamente en `/terminos`, en `/como-funciona` y en un aviso breve en cada ficha. **No se disimula.** Un sitio que insinúa garantías que no da es el que termina con el problema legal y reputacional.

Lo que sí hacemos, y se comunica con la misma claridad: revisamos toda publicación antes de que sea pública, damos de baja lo que incumple, y publicamos consejos concretos para no ser estafado.

---

## 2. Patrones de fraude en el mercado paraguayo de motos

| # | Patrón | Cómo se ve | Detección |
|---|---|---|---|
| 1 | Vendedor "en el exterior" | Precio muy bajo, "estoy en Brasil/Argentina, te la envío, señá primero" | Palabras clave en la descripción + precio anómalo. **Rechazo automático a revisión** |
| 2 | Seña por adelantado | "Reservá con Gs. X por transferencia" antes de ver la moto | Palabras clave + educación al comprador en la ficha |
| 3 | Precio anzuelo | Precio irreal para atraer contactos; en el WhatsApp aparece otro | Precio fuera del rango del modelo → señal en moderación |
| 4 | Unidad robada | Sin documentación, precio bajo, urgencia, fotos de baja calidad | No verificable por nosotros. Se exige declarar documentación al día y se advierte al comprador |
| 5 | Chapa/transferencia pendiente | "Papeles en trámite", deuda de patente o multas | Campo obligatorio de estado de documentación |
| 6 | Publicación duplicada | La misma unidad publicada por varios o repetida para ganar visibilidad | Hash de imagen (`listing_images.content_hash`) + coincidencia marca/modelo/año/precio |
| 7 | Fotos robadas de otro portal | Marca de agua de otro sitio, foto de catálogo presentada como la unidad | Revisión visual + campo `is_catalog_photo` |
| 8 | Suplantación de comercio | Un particular se hace pasar por comercio conocido | Sólo los `dealers` verificados tienen página y sello |
| 9 | Phishing de financiación | Pide cédula, datos bancarios o "gastos administrativos" por adelantado | Nuestro formulario nunca los pide (`PRODUCT_SPEC.md` §2.3), y lo decimos |
| 10 | Spam comercial | Publicaciones que no son motos, o que sólo derivan a otro sitio | Moderación |

---

## 3. Qué se revisa antes de publicar (ADR-09)

Checklist del moderador. La cola del admin la muestra como lista marcable con atajos de teclado (`ADMIN_SPEC.md`).

**Bloqueantes — no se publica sin esto:**
- [ ] Es una moto (o vehículo de la categoría declarada)
- [ ] Al menos una foto real de la unidad, o foto de catálogo **marcada como tal** si es 0 km
- [ ] Fotos sin marca de agua de otro portal
- [ ] Precio de contado o esquema de financiación completo
- [ ] Marca y modelo mapeables al catálogo
- [ ] Ciudad y teléfono válidos
- [ ] Descripción sin datos de contacto embebidos (evita saltarse el rastreo y el bloqueo)
- [ ] Sin señales del patrón 1 o 2

**Señales de riesgo — publican, pero con marca interna para seguimiento:**
- Precio > 35% por debajo de la mediana del modelo (si hay ≥ 5 unidades para calcularla)
- Teléfono asociado a una publicación rechazada previamente
- Más de 3 publicaciones desde la misma IP en 24 h
- Descripción copiada literal de otra publicación
- Primera publicación de un teléfono con precio alto

**Nota:** ninguna de estas señales rechaza automáticamente. Ordenan la cola. La decisión es humana.

---

## 4. Motivos de rechazo (códigos)

`listings.rejection_reason_code`. Cada uno tiene un texto de aviso al vendedor en español paraguayo, definido en `CONTENT_STRATEGY.md`.

| Código | Motivo |
|---|---|
| `sin_fotos` | Sin fotos o fotos ilegibles |
| `fotos_ajenas` | Fotos con marca de agua de otro sitio o tomadas de internet |
| `sin_precio` | Sin precio ni esquema de financiación |
| `datos_incompletos` | Faltan datos obligatorios |
| `no_es_moto` | No corresponde a la categoría |
| `duplicada` | Ya publicada |
| `sospecha_fraude` | Coincide con un patrón de fraude conocido |
| `contacto_en_descripcion` | Datos de contacto dentro del texto |
| `contenido_inapropiado` | Lenguaje o contenido inaceptable |
| `precio_irreal` | Precio anzuelo evidente |
| `documentacion` | Declara documentación irregular de forma que impide una venta legal |
| `otro` | Con nota obligatoria |

El rechazo **siempre** lleva un texto que explique qué corregir. Un rechazo mudo es un vendedor perdido y una denuncia en redes.

---

## 5. Denuncias de usuarios

Enlace en cada ficha, sin registro, teléfono opcional.

| Código | Etiqueta visible |
|---|---|
| `estafa` | Creo que es una estafa |
| `vendida` | Ya está vendida |
| `precio_falso` | El precio no es real |
| `no_responde` | El vendedor no responde |
| `duplicada` | Está publicada varias veces |
| `robada` | Creo que es robada |
| `datos_incorrectos` | Los datos no coinciden |
| `otro` | Otro motivo |

**Reglas:**
- 3 denuncias independientes de tipo `estafa` o `robada` sobre la misma publicación → pausa automática a `paused` + prioridad máxima en la cola. La pausa es automática; la baja definitiva es humana.
- Denuncias `vendida` → no pausan; marcan para verificación de disponibilidad.
- Se limita a 5 denuncias por `reporter_ip_hash` por día para evitar sabotaje entre competidores.
- Toda resolución escribe `activity_log` con nota.
- Nunca se le dice al denunciado quién lo denunció.

---

## 6. Verificación de comercios

`dealers.is_verified` se activa **sólo** con verificación documentada, nunca por defecto ni por antigüedad:

- Existencia real del local (dirección comprobada, visita o llamada).
- Teléfono verificado con contacto efectivo.
- Autorización escrita registrada (`DATA_SEEDING.md` §5).
- RUC o nombre comercial declarado — `[VERIFICAR: qué se puede exigir y consultar legalmente en Paraguay sin infringir la Ley 6534/2020]`.

Qué significa el sello, escrito literalmente junto a él: *"Verificamos que este comercio existe y que su contacto es real. No verificamos las motos ni garantizamos las operaciones."* Nada más. Un sello que sugiere más de lo que hay es fabricación (`PLAN.md` §5).

---

## 7. Educación del comprador

Bloque compacto y siempre visible en la ficha, más una guía completa enlazada:

> **Antes de pagar:** vé la moto en persona, revisá que la documentación coincida con el vendedor, no transfieras dinero por adelantado y desconfiá de precios muy por debajo del mercado.

Guía extendida en `/guias/como-comprar-una-moto-usada-sin-que-te-estafen`, entre las 10 fundacionales (`CONTENT_STRATEGY.md`). No es sólo defensivo: es contenido de búsqueda con demanda real.

---

## 8. Anti-abuso técnico

| Vector | Mitigación fase 1 |
|---|---|
| Spam de publicaciones | Límite por IP (3/24 h), honeypot, moderación previa |
| Spam de formularios | Honeypot en todos; Turnstile cuando haya tráfico real |
| Scraping de teléfonos | Teléfono nunca en el HTML inicial; se revela por interacción registrada |
| Scraping de inventario | Límite por IP en listados, `robots.txt`, sin API pública |
| Enumeración de fichas | `public_ref` aleatorio de 8 caracteres, no secuencial |
| Fuerza bruta en admin | Límite por IP y por cuenta, bloqueo temporal, contraseñas fuertes |
| Subida de archivos maliciosos | Validación de tipo real por contenido (no por extensión), re-encodeo de toda imagen, tamaño máximo, sin SVG |
| XSS en descripciones | Sanitización en salida; nunca HTML crudo del usuario |
| Enumeración de leads | Rutas de admin autenticadas; nada de leads en rutas públicas |

---

## 9. Retirada de contenido

| Situación | Acción | HTTP posterior |
|---|---|---|
| Fraude confirmado | Baja definitiva + registro del teléfono en lista interna | 410 |
| Pedido del vendedor | Baja lógica | 301 a la página de modelo |
| Pedido del comercio (fin de autorización) | Baja de todo su stock en 48 h | 301 |
| Denuncia de titularidad por un tercero | Pausa inmediata, revisión, y derivación a la autoridad si corresponde | 410 si se confirma |
| Orden de autoridad competente | Cumplir y registrar | Según corresponda |

Toda retirada queda en `activity_log` con motivo, responsable y fecha.

**Lista interna de teléfonos bloqueados:** teléfonos con fraude confirmado no pueden publicar de nuevo. Es un dato personal: su base legal, su plazo de conservación y su procedimiento de revisión deben confirmarse con abogado antes de implementarse (`LEGAL_AND_COMPLIANCE.md`).

---

## 10. Qué NO se hace, deliberadamente

- **No se verifica la condición mecánica ni la titularidad.** No tenemos cómo y prometerlo sería mentir.
- **No se intermedia el pago.** Ni depósito en garantía ni escrow: es otro negocio, con otra regulación.
- **No hay reseñas** (ADR-10): sin volumen son manipulables y crean responsabilidad.
- **No se publica el historial de precios de una publicación** en fase 1: es útil, pero mal presentado invita a conflictos con vendedores. Se evalúa después.
- **No se muestran denuncias públicamente.** Difamación sin verificación.

---

## 11. Métricas de salud

| Métrica | Frecuencia | Alarma |
|---|---|---|
| Tasa de rechazo en moderación | Semanal | > 30% (problema de formulario) o < 5% (moderación laxa) |
| Tiempo mediano en la cola | Diario | > 24 h |
| Denuncias por cada 100 publicaciones vivas | Semanal | > 5 |
| Publicaciones dadas de baja por fraude | Mensual | Cualquier tendencia creciente |
| Denuncias `vendida` sobre publicaciones activas | Semanal | Indica que falta refrescar disponibilidad |
