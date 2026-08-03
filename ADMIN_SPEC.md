# ADMIN_SPEC.md

Panel en `/admin`. Sin pulido visual (ADR-15): tablas y formularios funcionales, accesibles y rápidos.

**Principio de seguridad que no se negocia:** ocultar un botón no es un permiso. **Toda mutación revalida el rol en el servidor.** Un `dealer` que adivina una URL o postea a mano a un endpoint debe recibir 403, no una edición aplicada.

```ts
function requireRole(session, allowed: string[]) {
  if (!session) throw new Unauthorized();
  if (!allowed.includes(session.user.role)) throw new Forbidden();
}
// Alcance por fila: si role === 'dealer', toda query filtra dealerId = session.user.dealerId
```

---

## 1. Autenticación

- Sesión propia con cookie (`iron-session` o equivalente) + `users.password_hash` con bcrypt coste 12. Sin OAuth: no hace falta y suma piezas que fallan en Hostinger.
- Cookie `httpOnly`, `secure`, `sameSite=lax`. Sesión de 7 días con renovación.
- Límite de intentos por IP y por cuenta; bloqueo temporal tras 5 fallos.
- Sin registro público. Los usuarios de admin se crean por script o por un admin existente.
- `/admin` completo bajo `Disallow` en `robots.txt` y con `noindex`.

---

## 2. Matriz de permisos

| Pantalla / acción | admin | moderator | dealer (fase 2) |
|---|---|---|---|
| Cola de moderación | ✅ | ✅ | ❌ |
| Aprobar / rechazar publicación | ✅ | ✅ | ❌ |
| Editar cualquier publicación | ✅ | ✅ | sólo propias |
| Borrar publicación | ✅ | ✅ | sólo propias |
| Comercios (CRUD) | ✅ | ver | sólo su ficha |
| Verificar comercio / autoaprobación | ✅ | ❌ | ❌ |
| Catálogo (marcas, modelos, categorías, ciudades) | ✅ | proponer | ❌ |
| Bandeja de leads | ✅ | ver | sólo los de sus motos |
| Cobros, planes, destacados | ✅ | ❌ | ver los propios |
| Publicidad | ✅ | ❌ | ❌ |
| Contenido (guías, textos SEO) | ✅ | ✅ | ❌ |
| Denuncias | ✅ | ✅ | ❌ |
| Configuración del sitio | ✅ | ❌ | ❌ |
| Registro de actividad | ✅ | ver | ❌ |

---

## 3. Cola de moderación — la pantalla central

Es donde se pasa la mayor parte del tiempo operativo. Se diseña para velocidad, no para belleza.

**Vista:** una publicación a la vez, no una grilla. Fotos grandes a la izquierda, datos y checklist a la derecha, cola pendiente contada arriba.

**Orden:** señales de riesgo primero (`TRUST_AND_SAFETY.md` §3), luego FIFO.

**Atajos de teclado obligatorios:**

| Tecla | Acción |
|---|---|
| `A` | Aprobar y pasar a la siguiente |
| `R` | Rechazar → abre selector de motivo |
| `E` | Editar antes de aprobar |
| `S` | Saltar (deja en cola) |
| `1`–`9` | Motivo de rechazo por número |
| `←` / `→` | Navegar fotos |
| `D` | Ver posibles duplicados (por `content_hash` y por marca/modelo/año/precio) |

**Panel de señales visible junto a la decisión:**
- Precio contra la mediana del modelo, con el N sobre el que se calcula (si N < 5, se dice "sin referencia suficiente").
- Publicaciones previas del mismo teléfono, con sus estados.
- Publicaciones desde la misma IP en 24 h.
- Coincidencia de `content_hash` con otras publicaciones.
- Si el modelo llegó como texto libre: selector para mapear al catálogo (resuelve `model_suggestions` en el mismo gesto).

**Al aprobar:** `published`, `published_at = now`, `expires_at = +60 días`, `activity_log`, y notificación al vendedor por WhatsApp con el enlace (manual en fase 1, con el texto pre-armado y botón de copiar).

**Al rechazar:** motivo obligatorio, texto de aviso pre-cargado y editable, `activity_log`.

**SLA declarado:** menos de 24 h. Alerta en el panel si algo lleva más de 20 h en cola.

---

## 4. Publicaciones

Tabla filtrable por estado, comercio, marca, ciudad, rango de fechas y señales. Búsqueda por `public_ref`, título o teléfono.

Acciones masivas: pausar, vencer, extender vencimiento, marcar destacada, exportar CSV.

Edición: mismo formulario que el público más campos de admin (comercio, destacado, vencimiento, notas internas). Cambiar precio no devuelve a moderación pero queda en `activity_log`; cambiar fotos o descripción de una publicación de particular sí (`DATABASE_SCHEMA.md` §3).

Vista de detalle con la línea de tiempo de la publicación: eventos, cambios, leads generados, denuncias.

---

## 5. Comercios

CRUD completo. Campos operativos que importan:

- `status`, `is_verified`, `auto_approve`.
- **Bloque de autorización:** texto exacto aceptado, fecha, canal (`DATA_SEEDING.md` §5). Sin esto no se publica su stock.
- `free_until` con alerta a los 60 días de vencer, para preparar la conversación comercial.
- Panel por comercio con lo que se le va a mostrar cuando se le venda el plan: publicaciones vivas, vistas, clics de WhatsApp, leads de financiación, todo en un rango de fechas. **Todos los números salen de consultas reales** (`MONETIZATION.md` §3.2).
- Botón "Baja de todo el stock" para cuando un comercio retira la autorización, con confirmación y ejecución en 48 h.

---

## 6. Catálogo

- **Marcas / modelos / categorías / ciudades:** CRUD con `is_active`, `sort_order`, `intro_html`.
- El slug se bloquea después de publicado (`SEO_ARCHITECTURE.md` §1). La interfaz lo muestra deshabilitado con la explicación.
- **Cola de `model_suggestions`:** lista de modelos propuestos por vendedores, con acciones mapear / crear / rechazar. Cada resolución actualiza las publicaciones afectadas.
- Aviso visible cuando una marca o modelo está marcado `[VERIFICAR]` y todavía no se confirmó contra fuente real (ADR-11).

---

## 7. Bandeja de leads

Lista por tipo, estado de CRM y fecha. Cada lead muestra **todo el contexto**: la publicación, el comercio, las respuestas del formulario (`payload_json`), la atribución (`utm_*`, `gclid`, `fbclid`), la página de origen.

Un lead sin sus respuestas es una llamada a ciegas. Ese es el punto de la pantalla.

**Panel de salud del CRM, arriba:**
- Leads `pending` / `sent` / `duplicate` / `failed` en las últimas 24 h.
- **Alerta roja si hay algún `failed` con 5 intentos.**
- Último error recibido, con su cuerpo (`INTEGRATIONS.md` §2.10 nombra el campo que falla).
- Botón de reintento manual.

Acciones: marcar spam, reenviar al CRM, exportar CSV.

---

## 8. Monetización

- **Destacados:** alta manual con publicación, días, monto real cobrado, método, referencia. Lista con vencimientos próximos.
- **Planes:** alta y renovación por comercio, con vigencia. Alertas de vencimiento a 30 y 7 días.
- **Publicidad:** CRUD de `ad_placements` con imagen, destino, segmentación, vigencia, y contadores de impresiones y clics.
- Vista de ingresos por mes desde los cobros registrados. **Es un registro de lo cobrado, no una proyección** (`MONETIZATION.md` §9).

---

## 9. Contenido

- CRUD de `posts` con editor, borrador/revisión/publicado.
- **`reviewed_by` obligatorio para publicar.** La interfaz impide publicar sin revisor, incluido contenido asistido por IA (`CONTENT_STRATEGY.md`).
- Edición de `intro_html` de marcas, modelos, categorías y ciudades desde el admin, con el conteo de publicaciones vivas y **un indicador de si la página está indexable** según los umbrales de `SEO_ARCHITECTURE.md` §2.1. Es lo que convierte esa regla en algo accionable en vez de invisible.

---

## 10. Denuncias

Cola por estado y prioridad. Muestra la publicación, el motivo, el detalle y las denuncias previas de la misma publicación. Acciones: descartar, pausar, dar de baja (410), bloquear teléfono. Nota de resolución obligatoria. Todo a `activity_log`.

---

## 11. Configuración del sitio (sólo admin)

- **`SITE_NOINDEX`: interruptor visible con el conteo actual de publicaciones vivas al lado**, para que quitarlo sea una decisión informada y deliberada (`DATA_SEEDING.md` §3).
- Número de WhatsApp general del sitio.
- Días de vigencia por defecto de las publicaciones.
- Umbrales de indexación (lectura; cambiarlos exige escalar).
- Textos legales.

---

## 12. Registro de actividad

`activity_log` filtrable por entidad, usuario, acción y fecha, con el diff. Sirve para auditoría y para responder "¿quién cambió este precio?" sin adivinar.

---

## 13. Fuera de alcance del admin en fase 1

Dashboards de comercio (fase 2), autogestión de pagos (ADR-13), reportes automáticos por email, gestión de usuarios más allá del alta manual, y cualquier gráfico que no responda una pregunta operativa concreta.
