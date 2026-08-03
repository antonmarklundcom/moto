# PRODUCT_SPEC.md

Roles, flujos y pantallas. El diseño visual se pospone (ADR-15): este documento especifica **estructura, comportamiento, datos y estados**, no estética.

---

## 1. Roles

| Rol | Existe en fase | Puede |
|---|---|---|
| Visitante anónimo | 1 | Buscar, ver fichas, contactar por WhatsApp, publicar (con moderación), enviar leads, denunciar |
| `admin` | 1 | Todo |
| `moderator` | 1 | Moderar, editar publicaciones, resolver denuncias. No toca cobros ni configuración |
| `dealer` | 2 | Gestionar sólo sus publicaciones y su página |
| `seller` | 3+ | Gestionar sólo sus publicaciones |

En fase 1 sólo existen usuarios `admin` y `moderator`. La tabla soporta el resto desde la primera migración (ADR-05).

---

## 2. Flujos críticos

### 2.1 Comprador: buscar → contactar (el flujo que define el producto)

```
Entrada (Google / directo)
  → Listado o ficha
  → Ve datos: precio contado y/o entrega + cuota
  → CTA WhatsApp  →  /ir/wa/:listingId  →  evento  →  302 a wa.me
  → (paralelo) CTA "Quiero financiarla" → formulario → lead → VenderCRM
```

**Requisitos duros:**
- El CTA de WhatsApp está visible sin scroll en móvil, en la ficha y en cada tarjeta del listado.
- Nunca se muestra el teléfono en texto plano sin interacción: se revela con un clic que registra `phone_reveal`. Protege del scraping y produce dato.
- El mensaje pre-cargado se genera en el servidor:
  `Hola, vi esta moto en moto.com.py: {título} — {precio o cuota} — {URL}. ¿Sigue disponible?`
- Desktop: `wa.me` abre WhatsApp Web. Además se muestra el número en texto tras el clic, porque en desktop el flujo falla más seguido.
- Si el vendedor no tiene WhatsApp (`contact_phone` marcado como sólo llamadas), el CTA cambia a "Llamar" con `tel:` y el evento pasa a ser `phone_reveal`.

### 2.2 Vendedor particular: publicar sin cuenta

```
/publicar
  → Paso 1: fotos (lo más difícil, va primero mientras hay motivación)
  → Paso 2: marca → modelo (selector dependiente) → categoría → año → km → cilindrada
  → Paso 3: precio, ¿negociable?, ¿recibe permuta?
  → Paso 4: ciudad, teléfono, nombre
  → Paso 5: descripción (mínimo 120 caracteres, con ayudas)
  → Envío → pending_review → mensaje "Lo revisamos en menos de 24 h"
  → Notificación por WhatsApp al aprobar, con el enlace
```

**Requisitos duros:**
- **Autosave en `localStorage` en cada paso.** La conexión móvil paraguaya se corta; perder el formulario es perder la publicación.
- Compresión en el cliente antes de subir (lado mayor 1600 px, calidad ~0,8). Subir 8 MB desde un celular con datos no termina nunca.
- Subida por foto, no todas juntas, con progreso individual y reintento por foto.
- Sin registro, sin verificación de email. Sólo teléfono, verificado por el moderador.
- Si el modelo no está en el catálogo: campo libre que crea `model_suggestions` y deja `model_id` nulo (ADR-11). No bloquea el envío.
- El formulario funciona sin JavaScript para el envío final (progresivo), aunque las fotos requieran JS.

### 2.3 Lead de financiación (el flujo monetizable — ADR-03)

Dos puntos de entrada: CTA en la ficha, y la landing `/financiacion`.

Campos: nombre, teléfono (obligatorio), ciudad, entrega disponible, plazo deseado, si tiene recibo de sueldo o es independiente, moto de interés (autocompletada si viene de una ficha).

**Lo que el formulario NO hace:** no pide cédula, no pide número de cuenta, no pide monto exacto de ingreso (rango, y opcional), no promete aprobación, no calcula "tu cuota aprobada". Ver `LEGAL_AND_COMPLIANCE.md` y `PLAN.md` §5.

**Texto obligatorio junto al botón:**
> Te contactamos para orientarte y derivarte con el comercio o la financiera. moto.com.py no otorga créditos ni garantiza aprobación.

Tras enviar: página de agradecimiento con qué pasa después y en cuánto tiempo, más un CTA de WhatsApp para quien no quiere esperar.

**Comportamiento del servidor:** guardar el lead en la base **primero**, responder al usuario, y luego enviar a VenderCRM (`INTEGRATIONS.md`). El visitante nunca ve un error del CRM.

### 2.4 Denuncia

Enlace discreto en cada ficha. Motivos con código (`TRUST_AND_SAFETY.md`). No requiere datos del denunciante; el teléfono es opcional. Confirmación honesta: "Recibimos tu denuncia y la vamos a revisar" — sin prometer plazo ni resultado.

---

## 3. Pantallas públicas

### 3.1 Home
Buscador (marca, ciudad, rango de precio), accesos a categorías y marcas con inventario real, bloque `/motos/en-cuotas`, últimas publicaciones, últimas guías. Sin carrusel de héroe. Sin contadores.

### 3.2 Listado `/motos` y páginas programáticas
- Filtros: marca, modelo (dependiente), categoría, ciudad, condición, precio, año, km, cilindrada, **entrega máxima**, **cuota máxima**.
- Los filtros de entrega y cuota son diferenciales del producto: van visibles, no escondidos en "más filtros".
- Orden: recientes (por defecto), precio asc/desc, km asc, año desc.
- Estado de filtros en la URL (compartible, con las reglas de indexación de `SEO_ARCHITECTURE.md` §3).
- Tarjeta: foto, título, precio **o** "Desde Gs. X/mes", ciudad, año, km, sello de comercio verificado si aplica, CTA WhatsApp.
- Paginación real (no scroll infinito): el scroll infinito rompe el rastreo y el botón "atrás".
- Encabezado con el conteo real de resultados.

### 3.3 Ficha `/aviso/:slug-:ref`
Orden en móvil: galería → título → precio/financiación → **CTA WhatsApp** → datos → descripción → CTA financiación → vendedor/comercio → similares → denunciar.

- Precio en `Gs. 12.500.000`. Si `has_financing_only`: "Entrega Gs. X + Y cuotas de Gs. Z", con nota de que el precio de contado no fue informado.
- Banner de estado si `sold` o `expired` (`SEO_ARCHITECTURE.md` §4).
- Foto de catálogo etiquetada explícitamente: *"Foto de catálogo del modelo, no de esta unidad"* (`listing_images.is_catalog_photo`).
- Bloque de contexto del modelo separado visualmente de la descripción del vendedor.
- Rango de precios del modelo sólo si hay ≥ 5 unidades, indicando sobre cuántas se calcula.
- Similares reales o el bloque no aparece.

### 3.4 Comercio `/comercios/:slug`
Datos, descripción, ciudad, inventario paginado, CTA WhatsApp al número del comercio. El sello "verificado" sólo si `is_verified` con verificación documentada.

### 3.5 `/financiacion` y `/motos/en-cuotas`
- `/financiacion`: cómo funciona comprar en cuotas en Paraguay, qué suelen pedir, qué hace el sitio (deriva) y qué no (no aprueba), formulario, preguntas frecuentes reales.
- `/motos/en-cuotas`: listado filtrado por publicaciones con datos de financiación, con contenido editorial propio.

### 3.6 `/guias` y `/guias/:slug`
Artículo, migas, enlaces a listados relacionados, CTA contextual. Sin muro de suscripción.

### 3.7 Estáticas
`/como-funciona`, `/terminos`, `/privacidad`, `/contacto`, `/publicar`.

---

## 4. Estados vacíos, de carga y de error

Ver `PLAN.md` §5: los estados vacíos dicen la verdad.

| Situación | Qué se muestra |
|---|---|
| Búsqueda sin resultados | "Todavía no tenemos motos que coincidan." + filtros aplicados con opción de quitarlos uno a uno + búsquedas cercanas **con resultados reales** + alta de aviso |
| Ciudad con pocas motos | El conteo real + ciudades cercanas con inventario. Nunca motos de otra ciudad presentadas como locales |
| Marca sin inventario | Página `noindex` con contexto de la marca y aviso |
| Ficha no encontrada | 404 con buscador y modelos populares reales |
| Ficha retirada por fraude | 410 explicando que se retiró por incumplir las normas |
| Fallo al subir foto | Error por foto con reintento; las demás no se pierden |
| Fallo al enviar formulario | El contenido no se pierde; se muestra qué campo falló |
| Fallo del CRM | Invisible para el visitante: ve la página de gracias (`INTEGRATIONS.md`) |
| Carga de listados | Esqueletos con la altura final para evitar CLS |

---

## 5. Rendimiento y accesibilidad (no negociables pese a ADR-15)

- Presupuesto de `SEO_ARCHITECTURE.md` §10.
- Listados y fichas son server components; el JS de cliente se limita a filtros, galería y subida de fotos.
- HTML semántico: un solo `h1`, jerarquía correcta, `nav`/`main`/`article`/`footer`.
- Todo input con `label` asociado. Errores asociados por `aria-describedby`.
- Foco visible siempre. Navegable por teclado completo.
- Contraste mínimo AA. Área táctil ≥ 44 px.
- `alt` real en imágenes: `"{Marca} {Modelo} {Año} usada en {Ciudad}"`, no `"moto"`.
- `lang="es-PY"`.
- Funciona sin JS para leer y navegar.

**Motivo:** el rediseño posterior cambia estilos, no estructura. Eso sólo es cierto si la estructura está bien ahora.

---

## 6. Copy: reglas de conversión

- Botón principal siempre "Escribir por WhatsApp", nunca "Contactar".
- Precios siempre con `Gs.` y separador de miles con punto.
- Nada de urgencia falsa: sin "¡3 personas viendo!", sin cuentas regresivas.
- Los conteos que se muestran son consultas reales.
- Voz: cercana, directa, sin jerga de marketing. Guía completa en `CONTENT_STRATEGY.md`.

---

## 7. Fuera de alcance del MVP

Ver `PLAN.md` §3.2. Recordatorio de lo que **no** se construye: cuentas de vendedor, chat interno, favoritos, comparador, alertas (la tabla existe, la función no), pasarela de pago, app, reseñas, repuestos.
