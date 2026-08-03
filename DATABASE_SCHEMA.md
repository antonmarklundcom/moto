# DATABASE_SCHEMA.md

MySQL 8 + Drizzle ORM (`drizzle-orm/mysql2`). Este documento es normativo: el esquema no se cambia sin escalar a Opus (`PLAN.md` §4.3).

**Convenciones globales**

- Nombres de tabla y columna en `snake_case`, inglés. El contenido es en español; el esquema no.
- Toda tabla lleva `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY` salvo que se indique otra cosa.
- Toda tabla lleva `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` y `updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.
- Borrado lógico donde se indica: `deleted_at DATETIME NULL`. Toda consulta pública filtra `deleted_at IS NULL`.
- Charset `utf8mb4`, collation `utf8mb4_unicode_ci`.
- Fechas en UTC (`timezone: "Z"` en el pool). La presentación convierte a `America/Asuncion`.
- Dinero: **entero en guaraníes** (ADR-06). Nunca `FLOAT`, nunca `DECIMAL` con centavos.
- Teléfonos: se guardan normalizados en E.164 (`+595981123456`) en `phone_e164`, y el original tal como lo tipeó el usuario en `phone_raw`. La normalización ocurre en el servidor, nunca en el cliente.
- Slugs: `VARCHAR(255)`, únicos donde se indique, generados desde el nombre + desambiguador numérico si colisiona. Un slug publicado **nunca** cambia (rompe URLs y SEO); si el nombre cambia, el slug queda.

---

## 1. Diagrama de dependencias

```
cities ──┐
brands ──┼──> models ──┐
         │             │
categories ────────────┼──> listings ──┬──> listing_images
dealers ───────────────┘               ├──> listing_events
users ────────────────────────────────>┤
                                       ├──> leads ──> lead_deliveries
                                       └──> reports

featured_purchases ──> listings
dealer_plans ──> dealers
ad_placements
posts
model_suggestions
activity_log
```

---

## 2. Tablas

### 2.1 `users`

Existe desde la primera migración aunque en fase 1 sólo haya admins (ADR-05). Retrofitear roles después obliga a revisar cada verificación de permisos.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `email` | VARCHAR(320) | no | UNIQUE |
| `password_hash` | VARCHAR(255) | no | bcrypt, coste 12 |
| `name` | VARCHAR(200) | no | |
| `phone_e164` | VARCHAR(20) | sí | |
| `role` | ENUM | no | `admin \| moderator \| dealer \| seller`. Default `seller` |
| `dealer_id` | BIGINT UNSIGNED | sí | FK → `dealers.id`. Obligatorio si `role='dealer'` (validado en aplicación) |
| `is_active` | BOOLEAN | no | Default `true` |
| `last_login_at` | DATETIME | sí | |
| `deleted_at` | DATETIME | sí | |

**Índices:** `UNIQUE(email)`; `INDEX(role)` — el admin lista por rol; `INDEX(dealer_id)` — resolver el alcance de fila en cada request de un dealer.

---

### 2.2 `dealers`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `name` | VARCHAR(200) | no | |
| `slug` | VARCHAR(255) | no | UNIQUE. Inmutable |
| `city_id` | BIGINT UNSIGNED | no | FK → `cities.id` |
| `address` | VARCHAR(300) | sí | |
| `phone_e164` | VARCHAR(20) | no | WhatsApp destino de sus leads |
| `phone_raw` | VARCHAR(30) | no | |
| `email` | VARCHAR(320) | sí | |
| `website_url` | VARCHAR(500) | sí | |
| `description` | TEXT | sí | Texto editorial de su página |
| `logo_path` | VARCHAR(500) | sí | Sólo con autorización (ADR-12) |
| `status` | ENUM | no | `prospect \| active \| paused \| archived`. Default `prospect` |
| `is_verified` | BOOLEAN | no | Default `false`. Habilita el sello de verificado y la autoaprobación |
| `auto_approve` | BOOLEAN | no | Default `false`. Ver ADR-09 |
| `authorization_note` | TEXT | sí | Texto exacto de la autorización aceptada (`DATA_SEEDING.md` §5) |
| `authorization_date` | DATE | sí | |
| `authorization_channel` | VARCHAR(50) | sí | `whatsapp \| email \| papel` |
| `free_until` | DATE | sí | Fin del período gratuito de 12 meses |
| `deleted_at` | DATETIME | sí | |

**Índices:** `UNIQUE(slug)`; `INDEX(status)`; `INDEX(city_id)` — página de ciudad lista comercios locales.

**Nota anti-fabricación:** `is_verified` sólo se activa con verificación real documentada. Qué se verifica está en `TRUST_AND_SAFETY.md`.

---

### 2.3 `cities`

Semilla curada, no crecen solas.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `name` | VARCHAR(120) | no | `Asunción`, `Ciudad del Este` |
| `slug` | VARCHAR(150) | no | UNIQUE. `asuncion`, `ciudad-del-este` |
| `department` | VARCHAR(120) | no | `Central`, `Alto Paraná`, `Itapúa` |
| `is_metro_asuncion` | BOOLEAN | no | Gran Asunción: permite agrupar el área metropolitana |
| `intro_html` | TEXT | sí | Contenido editorial de la página de ciudad, gestionado por admin |
| `sort_order` | INT | no | Orden en selectores |
| `is_active` | BOOLEAN | no | Default `true` |

**Índices:** `UNIQUE(slug)`; `INDEX(is_active, sort_order)`.

**Semilla inicial:** Asunción, San Lorenzo, Luque, Capiatá, Lambaré, Fernando de la Mora, Ñemby, Mariano Roque Alonso, Limpio, Ciudad del Este, Encarnación, Pedro Juan Caballero, Coronel Oviedo, Villarrica, Concepción. Departamentos a confirmar contra fuente oficial — `[VERIFICAR: división departamental y grafía oficial con acentos]`.

---

### 2.4 `brands` y `models`

Catálogo normalizado. Texto libre prohibido (ADR-11).

**`brands`**

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `name` | VARCHAR(120) | no | `Honda`, `Yamaha` |
| `slug` | VARCHAR(150) | no | UNIQUE. Inmutable |
| `logo_path` | VARCHAR(500) | sí | Sólo si hay derecho de uso |
| `intro_html` | TEXT | sí | Contenido de la página de marca |
| `is_active` | BOOLEAN | no | |
| `sort_order` | INT | no | |

**`models`**

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `brand_id` | BIGINT UNSIGNED | no | FK → `brands.id` |
| `name` | VARCHAR(150) | no | `CG 150 Titan` |
| `slug` | VARCHAR(200) | no | UNIQUE junto con `brand_id` |
| `category_id` | BIGINT UNSIGNED | sí | FK → `categories.id`. Categoría por defecto del modelo |
| `engine_cc` | SMALLINT UNSIGNED | sí | Cilindrada nominal del modelo |
| `intro_html` | TEXT | sí | |
| `is_active` | BOOLEAN | no | |

**Índices:** `UNIQUE(brand_id, slug)`; `INDEX(brand_id, is_active)`; `INDEX(category_id)`.

**Semilla:** debe construirse desde fuentes reales (sitios de importadoras y comercios paraguayos), no de memoria. Toda marca o modelo no confirmado se carga con una nota `[VERIFICAR]` y no se publica en páginas de SEO hasta confirmarse. Ver ADR-11.

**`model_suggestions`** — cola para cuando un vendedor no encuentra su modelo.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `raw_text` | VARCHAR(255) | no | Lo que escribió el usuario |
| `brand_id` | BIGINT UNSIGNED | sí | Si eligió marca |
| `listing_id` | BIGINT UNSIGNED | sí | FK → `listings.id` |
| `status` | ENUM | no | `pending \| mapped \| created \| rejected` |
| `mapped_model_id` | BIGINT UNSIGNED | sí | FK → `models.id` |
| `resolved_by` | BIGINT UNSIGNED | sí | FK → `users.id` |

---

### 2.5 `categories`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `name` | VARCHAR(120) | no | |
| `slug` | VARCHAR(150) | no | UNIQUE |
| `intro_html` | TEXT | sí | |
| `sort_order` | INT | no | |
| `is_active` | BOOLEAN | no | |

**Semilla:** `naked` (calle), `scooter`, `cub` (tipo 110 automática/semiautomática), `enduro-cross`, `touring`, `deportiva`, `custom-chopper`, `motocarro-carga`, `electrica`, `cuatriciclo`. Los nombres visibles deben usar el término que realmente se usa en Paraguay — validar con un comercio antes de fijar (`CONTENT_STRATEGY.md`).

---

### 2.6 `listings` — tabla central

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `slug` | VARCHAR(255) | no | UNIQUE. Inmutable una vez publicado |
| `public_ref` | CHAR(8) | no | UNIQUE. Código corto legible para soporte y WhatsApp |
| `title` | VARCHAR(200) | no | Generado desde marca+modelo+año, editable |
| `description` | TEXT | sí | Máx 5.000 caracteres |
| `brand_id` | BIGINT UNSIGNED | no | FK |
| `model_id` | BIGINT UNSIGNED | sí | FK. Null mientras espera mapeo del catálogo |
| `model_raw` | VARCHAR(255) | sí | Lo tipeado por el usuario, antes del mapeo (ADR-11) |
| `category_id` | BIGINT UNSIGNED | no | FK |
| `city_id` | BIGINT UNSIGNED | no | FK |
| `dealer_id` | BIGINT UNSIGNED | sí | FK. Null = publicación de particular |
| `owner_user_id` | BIGINT UNSIGNED | sí | FK → `users.id`. Null en fase 1 |
| `condition` | ENUM | no | `new \| used` |
| `year` | SMALLINT UNSIGNED | sí | Obligatorio si `used` |
| `mileage_km` | INT UNSIGNED | sí | Obligatorio si `used` |
| `engine_cc` | SMALLINT UNSIGNED | sí | |
| `price_gs` | BIGINT UNSIGNED | sí | Precio de contado. Null sólo si `has_financing_only` |
| `has_financing_only` | BOOLEAN | no | Default `false`. El comercio sólo publica cuota |
| `down_payment_gs` | BIGINT UNSIGNED | sí | Entrega |
| `installment_gs` | BIGINT UNSIGNED | sí | Cuota mensual |
| `installment_count` | SMALLINT UNSIGNED | sí | Cantidad de cuotas |
| `is_negotiable` | BOOLEAN | no | Default `false` |
| `accepts_trade_in` | BOOLEAN | no | Recibe permuta |
| `contact_phone_e164` | VARCHAR(20) | no | Destino del WhatsApp |
| `contact_phone_raw` | VARCHAR(30) | no | |
| `contact_name` | VARCHAR(200) | sí | |
| `status` | ENUM | no | Ver §3. Default `draft` |
| `rejection_reason_code` | VARCHAR(50) | sí | Ver `TRUST_AND_SAFETY.md` |
| `rejection_note` | TEXT | sí | |
| `published_at` | DATETIME | sí | |
| `expires_at` | DATETIME | sí | `published_at + 60 días` por defecto |
| `sold_at` | DATETIME | sí | |
| `last_verified_at` | DATETIME | sí | Última confirmación de disponibilidad |
| `is_featured` | BOOLEAN | no | Default `false`. Derivado de `featured_purchases`, materializado por rendimiento |
| `featured_until` | DATETIME | sí | |
| `view_count` | INT UNSIGNED | no | Contador desnormalizado, recalculable desde `listing_events` |
| `whatsapp_click_count` | INT UNSIGNED | no | Ídem |
| `submitted_ip` | VARBINARY(16) | sí | Antifraude. Ver retención en `LEGAL_AND_COMPLIANCE.md` |
| `updated_by` | BIGINT UNSIGNED | sí | FK → `users.id` |
| `deleted_at` | DATETIME | sí | |

**Índices y por qué existe cada uno:**

| Índice | Motivo |
|---|---|
| `UNIQUE(slug)` | Resolución de ruta pública |
| `UNIQUE(public_ref)` | Búsqueda por código en soporte |
| `INDEX(status, published_at DESC)` | Listado público ordenado por recientes; es la consulta más frecuente |
| `INDEX(status, is_featured, published_at DESC)` | Destacadas primero en el listado |
| `INDEX(brand_id, model_id, status)` | Páginas de marca y marca+modelo |
| `INDEX(city_id, status)` | Páginas de ciudad |
| `INDEX(category_id, status)` | Páginas de categoría |
| `INDEX(dealer_id, status)` | Página de comercio y alcance de fila del dashboard |
| `INDEX(status, price_gs)` | Filtro y orden por precio |
| `INDEX(status, expires_at)` | Job de vencimiento |
| `INDEX(model_id, status, price_gs)` | La consulta de página de modelo con orden por precio |
| `FULLTEXT(title, description)` | Búsqueda por texto libre. `MATCH ... AGAINST` en modo natural |

**Nota de rendimiento:** la búsqueda facetada combina varios de estos filtros. Empezar con estos índices, medir con `EXPLAIN` sobre datos reales y agregar índices compuestos según el patrón real de uso. **Agregar un índice no requiere escalar; agregar una columna sí.**

**Regla de integridad:** `price_gs` NULL exige `has_financing_only = true` y `installment_gs` NOT NULL. Validado en aplicación y en el formulario; MySQL no lo garantiza.

---

### 2.7 `listing_images`

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `listing_id` | BIGINT UNSIGNED | no | FK, `ON DELETE CASCADE` |
| `storage_path` | VARCHAR(500) | no | Ruta en la abstracción de almacenamiento (ADR-16) |
| `width` / `height` | SMALLINT UNSIGNED | sí | Para evitar CLS |
| `bytes` | INT UNSIGNED | sí | |
| `content_hash` | CHAR(64) | no | SHA-256. Detección de duplicados entre publicaciones |
| `alt_text` | VARCHAR(300) | sí | Generado desde marca/modelo/año si falta |
| `is_catalog_photo` | BOOLEAN | no | `true` = foto oficial del modelo, no de la unidad. **Debe mostrarse etiquetada** |
| `sort_order` | SMALLINT | no | |

**Índices:** `INDEX(listing_id, sort_order)`; `INDEX(content_hash)` — detección de duplicados en moderación.

---

### 2.8 `listing_events`

Tabla de eventos append-only. Es la base de toda la analítica propia y de la atribución de leads.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `listing_id` | BIGINT UNSIGNED | sí | Null en eventos no ligados a una publicación |
| `event_type` | ENUM | no | `view \| whatsapp_click \| phone_reveal \| share \| lead_submit \| favorite` |
| `dealer_id` | BIGINT UNSIGNED | sí | Desnormalizado para reportes por comercio |
| `session_hash` | CHAR(64) | sí | Hash de sesión, sin PII |
| `ip_hash` | CHAR(64) | sí | Hash con sal, no la IP. Ver `LEGAL_AND_COMPLIANCE.md` |
| `user_agent_hash` | CHAR(64) | sí | |
| `referrer` | VARCHAR(500) | sí | |
| `page_url` | VARCHAR(500) | sí | |
| `is_bot` | BOOLEAN | no | Marcado por heurística; se excluye de los reportes |
| `created_at` | DATETIME | no | |

**Índices:** `INDEX(listing_id, event_type, created_at)`; `INDEX(dealer_id, event_type, created_at)`; `INDEX(event_type, created_at)`.

**Crecimiento:** es la tabla que más crece. Política: agregar a resúmenes diarios y purgar filas crudas a los 180 días. Definir el job en fase 3, antes de que duela.

---

### 2.9 `leads`

Sólo los leads comerciales del propietario (ADR-08): financiación, seguro, plan de comercio, publicidad.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | no | PK |
| `type` | ENUM | no | `financing \| insurance \| dealer_plan \| advertising \| general` |
| `listing_id` | BIGINT UNSIGNED | sí | FK. Contexto del lead |
| `dealer_id` | BIGINT UNSIGNED | sí | FK |
| `name` | VARCHAR(200) | sí | |
| `phone_e164` | VARCHAR(20) | no | Identidad del lead |
| `phone_raw` | VARCHAR(30) | no | |
| `email` | VARCHAR(320) | sí | NULL si no se dio. Nunca cadena vacía |
| `message` | TEXT | sí | |
| `payload_json` | JSON | sí | Respuestas del formulario: entrega, ingreso declarado, plazo deseado |
| `utm_source` … `utm_content` | VARCHAR(200) | sí | 5 columnas |
| `gclid`, `fbclid` | VARCHAR(200) | sí | |
| `page_url`, `referrer` | VARCHAR(2000) | sí | |
| `idempotency_key` | VARCHAR(100) | no | UNIQUE |
| `crm_status` | ENUM | no | `pending \| sent \| duplicate \| failed`. Default `pending` |
| `crm_contact_id` | VARCHAR(100) | sí | Devuelto por VenderCRM |
| `crm_deal_id` | VARCHAR(100) | sí | |
| `crm_attempts` | TINYINT UNSIGNED | no | Default 0 |
| `crm_last_error` | TEXT | sí | Cuerpo del error, para diagnóstico |
| `is_spam` | BOOLEAN | no | Default `false` |

**Índices:** `UNIQUE(idempotency_key)`; `INDEX(crm_status, created_at)` — cola de reintentos; `INDEX(type, created_at)`; `INDEX(dealer_id, created_at)`.

**Regla:** el lead se guarda en nuestra base **antes** de intentar el envío a VenderCRM. Si el CRM falla, el lead no se pierde y un job lo reintenta. Ver `INTEGRATIONS.md`.

**`lead_deliveries`** — auditoría de cada intento de envío.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `lead_id` | BIGINT UNSIGNED | FK |
| `attempt_no` | TINYINT UNSIGNED | |
| `http_status` | SMALLINT | |
| `response_body` | TEXT | Truncado a 2.000 |
| `duration_ms` | INT UNSIGNED | |
| `created_at` | DATETIME | |

---

### 2.10 `featured_purchases`, `dealer_plans`, `ad_placements`

**`featured_purchases`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `listing_id` | BIGINT UNSIGNED | FK |
| `dealer_id` | BIGINT UNSIGNED | FK, nullable |
| `amount_gs` | BIGINT UNSIGNED | Lo realmente cobrado |
| `days` | SMALLINT UNSIGNED | |
| `starts_at` / `ends_at` | DATETIME | |
| `payment_method` | ENUM | `transferencia \| tigo_money \| billetera_personal \| efectivo \| cortesia` |
| `payment_reference` | VARCHAR(120) | Nº de comprobante |
| `status` | ENUM | `pending_payment \| active \| expired \| refunded \| cancelled` |
| `created_by` | BIGINT UNSIGNED | FK → `users.id`. Siempre un admin en fase 1 |

**Índices:** `INDEX(listing_id, status)`; `INDEX(status, ends_at)` — job de expiración que apaga `listings.is_featured`.

**`dealer_plans`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `dealer_id` | BIGINT UNSIGNED | FK |
| `plan_code` | VARCHAR(50) | `gratuito_12m`, `basico`, `pro` — ver `MONETIZATION.md` |
| `listing_limit` | SMALLINT UNSIGNED | NULL = ilimitado |
| `monthly_price_gs` | BIGINT UNSIGNED | 0 en el plan gratuito |
| `starts_at` / `ends_at` | DATE | |
| `status` | ENUM | `active \| expired \| cancelled` |
| `notes` | TEXT | |

**`ad_placements`** — venta directa de banners a comercios, talleres y repuesteras.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `advertiser_name` | VARCHAR(200) | |
| `slot_code` | VARCHAR(50) | `home_hero`, `search_inline`, `listing_sidebar` |
| `image_path` | VARCHAR(500) | |
| `target_url` | VARCHAR(500) | |
| `alt_text` | VARCHAR(300) | |
| `city_id` / `brand_id` / `category_id` | BIGINT UNSIGNED | Segmentación opcional |
| `starts_at` / `ends_at` | DATETIME | |
| `amount_gs` | BIGINT UNSIGNED | |
| `impressions` / `clicks` | INT UNSIGNED | Contadores |
| `status` | ENUM | `draft \| active \| paused \| expired` |

**Índices:** `INDEX(slot_code, status, starts_at, ends_at)`.

---

### 2.11 `reports` — denuncias de usuarios

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `listing_id` | BIGINT UNSIGNED | FK |
| `reason_code` | VARCHAR(50) | Ver `TRUST_AND_SAFETY.md` |
| `detail` | TEXT | |
| `reporter_phone_e164` | VARCHAR(20) | Opcional |
| `reporter_ip_hash` | CHAR(64) | Anti-abuso del propio reporte |
| `status` | ENUM | `pending \| reviewed \| actioned \| dismissed` |
| `resolved_by` | BIGINT UNSIGNED | FK → `users.id` |
| `resolved_at` | DATETIME | |
| `resolution_note` | TEXT | |

**Índices:** `INDEX(status, created_at)`; `INDEX(listing_id)`.

---

### 2.12 `posts` — guías y blog

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `slug` | VARCHAR(255) | UNIQUE, inmutable |
| `title` | VARCHAR(255) | |
| `excerpt` | VARCHAR(500) | |
| `body_html` | MEDIUMTEXT | |
| `cover_path` | VARCHAR(500) | |
| `meta_title` / `meta_description` | VARCHAR(255) / VARCHAR(500) | |
| `status` | ENUM | `draft \| review \| published` |
| `published_at` | DATETIME | |
| `author_user_id` | BIGINT UNSIGNED | FK |
| `reviewed_by` | BIGINT UNSIGNED | FK. **Obligatorio para pasar a `published`** |
| `related_brand_id` / `related_city_id` / `related_category_id` | BIGINT UNSIGNED | Enlazado interno automático |

**Índices:** `UNIQUE(slug)`; `INDEX(status, published_at DESC)`.

**Regla:** contenido asistido por IA igual requiere `reviewed_by` humano antes de publicar (`CONTENT_STRATEGY.md`).

---

### 2.13 `activity_log`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `user_id` | BIGINT UNSIGNED | FK, nullable (jobs del sistema) |
| `entity_type` | VARCHAR(50) | `listing`, `dealer`, `lead`… |
| `entity_id` | BIGINT UNSIGNED | |
| `action` | VARCHAR(50) | `created`, `approved`, `rejected`, `price_changed`… |
| `diff_json` | JSON | Antes/después de los campos cambiados |
| `ip_hash` | CHAR(64) | |
| `created_at` | DATETIME | |

**Índices:** `INDEX(entity_type, entity_id, created_at)`; `INDEX(user_id, created_at)`.

**Qué se registra sí o sí:** toda transición de estado de publicación, todo cambio de precio, toda edición de comercio, todo cobro, toda resolución de denuncia.

---

### 2.14 `search_alerts` (fase 3, definido acá para no cambiar el esquema después)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `phone_e164` | VARCHAR(20) | |
| `email` | VARCHAR(320) | |
| `criteria_json` | JSON | Filtros guardados |
| `frequency` | ENUM | `instant \| daily \| weekly` |
| `is_active` | BOOLEAN | |
| `confirmed_at` | DATETIME | Doble opt-in obligatorio |
| `last_sent_at` | DATETIME | |
| `unsubscribe_token` | CHAR(32) | UNIQUE |

Se crea la tabla en la migración inicial; la funcionalidad llega en fase 3. Los estados vacíos del MVP capturan estas altas (`DATA_SEEDING.md` §6).

---

## 3. Máquina de estados de `listings`

```
                 ┌──────────────── reject ─────────────┐
                 │                                     ▼
draft ──submit──> pending_review ──approve──> published ──> paused
                        │                        │  │  ▲       │
                        │                        │  │  └──resume┘
                        │                  mark_sold  expire
                        │                        │  │
                        ▼                        ▼  ▼
                    rejected                  sold  expired
                                                 │     │
                                                 └─renew┘──> published
```

| Estado | Visible al público | Indexable | Significado |
|---|---|---|---|
| `draft` | no | no | Formulario iniciado, sin enviar |
| `pending_review` | no | no | En cola de moderación |
| `published` | sí | sí | Activa |
| `paused` | no | no | Pausada por el vendedor o el admin |
| `sold` | sí, marcada como vendida | sí, 90 días | Vendida. Ver `SEO_ARCHITECTURE.md` |
| `expired` | sí, marcada como vencida | no (`noindex, follow`) | Venció sin renovar |
| `rejected` | no | no | Rechazada con motivo |

**Quién puede ejecutar cada transición:**

| Transición | admin | moderator | dealer (propia) | seller (propia) | sistema |
|---|---|---|---|---|---|
| `draft → pending_review` | sí | — | sí | sí | — |
| `pending_review → published` | sí | sí | sólo si `auto_approve` | no | sí (auto-aprobación) |
| `pending_review → rejected` | sí | sí | no | no | — |
| `published → paused` | sí | sí | sí | sí | — |
| `paused → published` | sí | sí | sí | sí | — |
| `published → sold` | sí | sí | sí | sí | — |
| `published → expired` | — | — | — | — | sí (job diario) |
| `expired/sold → published` (renovar) | sí | sí | sí | sí | — |
| cualquiera → `deleted_at` | sí | sí | sí (propia) | sí (propia) | — |

**Reglas duras:**
- Toda transición escribe en `activity_log`.
- `published` exige: ≥ 1 imagen, precio o cuota, ciudad, marca, `model_id` no nulo, teléfono válido.
- Un cambio de precio en una publicación `published` **no** vuelve a moderación, pero se registra.
- Un cambio de fotos o de descripción en una publicación de particular **sí** vuelve a `pending_review` (evita el bait-and-switch post-aprobación).
- `expires_at` por defecto: 60 días. Configurable por comercio.

---

## 4. Reglas de migración

1. Migraciones generadas con `drizzle-kit`, versionadas en `/drizzle`, nunca editadas a mano después de aplicadas.
2. Nunca `DROP COLUMN` en una sola release: deprecar → dejar de escribir → dejar de leer → borrar en una release posterior.
3. Toda migración que toque `listings` debe probarse contra un dump con ≥ 10.000 filas antes de producción.
4. Los seeds (`cities`, `brands`, `models`, `categories`) son idempotentes: `onDuplicateKeyUpdate` por slug, seguros de re-ejecutar.
5. **Los seeds de demostración de publicaciones no existen para producción.** Sólo hay seed de catálogo. Ver ADR-12.
6. Pool con `connectionLimit: 8` — Hostinger limita conexiones concurrentes por usuario.

---

## 5. Lo que NO está en el esquema y por qué

| Ausente | Motivo |
|---|---|
| Tabla de mensajes/chat interno | WhatsApp es el canal (ADR-01, `PLAN.md` §3.2) |
| Reseñas y calificaciones | ADR-10 |
| Tabla de pagos automatizados | ADR-13. `featured_purchases` registra cobros manuales |
| Repuestos / accesorios | Fase 6, modelo de datos distinto |
| Favoritos de usuario | Requiere cuentas (ADR-05). El evento `favorite` existe para medir demanda antes de construirlo |
