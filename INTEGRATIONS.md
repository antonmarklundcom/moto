# INTEGRATIONS.md

WhatsApp, VenderCRM, analítica y pagos. El contrato de leads es normativo: cambiar payload, destino, enrutamiento o disparadores exige escalar a Opus (`PLAN.md` §4.3).

---

## 1. WhatsApp

### 1.1 Redirección rastreada (ADR-07)

Los CTA **nunca** apuntan directo a `wa.me`. Apuntan a una ruta propia:

```
GET /ir/wa/:listingId            → contacto con el vendedor de esa publicación
GET /ir/wa/comercio/:dealerId    → contacto con un comercio
GET /ir/wa/general               → contacto general del sitio
```

Comportamiento del handler:
1. Resolver la entidad y su teléfono. Si no existe o no está publicada → 404.
2. Insertar `listing_events` (`whatsapp_click`) con `listing_id`, `dealer_id`, `session_hash`, `ip_hash`, `referrer`, `page_url`, `is_bot`.
3. Incrementar `listings.whatsapp_click_count`.
4. Construir el mensaje pre-cargado y responder **302** a `https://wa.me/<E164 sin +>?text=<urlencoded>`.

Requisitos: sin render, sin capa de cliente — sólo el 302. Ruta bloqueada en `robots.txt`. `Cache-Control: no-store`. Si el registro del evento falla, **igual se redirige**: perder un evento es aceptable, perder un contacto no.

Detección de bot mínima: user-agent conocido o falta de `Referer` del propio dominio → `is_bot = true`. Se registra igualmente, pero se excluye de los reportes.

### 1.2 Mensaje pre-cargado

Generado en el servidor desde datos reales:

```
Hola, vi esta moto en moto.com.py:
{título} — {precio o "Entrega Gs. X + Y cuotas de Gs. Z"}
{URL absoluta}
¿Sigue disponible?
```

Máximo ~300 caracteres. Sin emojis. Sin nombre inventado del vendedor.

### 1.3 Lo que no se hace en fase 1

Sin WhatsApp Business API, sin chatbot, sin plantillas de mensajería, sin envío automatizado. Requiere aprobación de Meta, un proveedor con coste mensual y gestión de plantillas. Se reevalúa cuando haya volumen de leads que lo justifique.

---

## 2. VenderCRM

### 2.1 La regla arquitectónica

**El navegador nunca habla con VenderCRM.** El formulario postea a nuestro servidor; nuestro servidor postea al CRM con la API key del sitio.

```
visitante → [form] → handler propio → VenderCRM /api/v1/leads
                     (guarda la key)
```

El endpoint no envía cabeceras CORS a propósito: eso es lo que mantiene la key fuera del código de página. Una key en el cliente permite a cualquiera escribir en el pipeline y obliga a rotarla en todos los sitios que la compartan.

### 2.2 Configuración

Dos valores, ambos desde VenderCRM → **Sitios**:

| Variable de entorno | Contenido |
|---|---|
| `VENDERCRM_URL` | `https://crm.<dominio>` |
| `VENDERCRM_API_KEY` | Key **exclusiva de moto.com.py**, se muestra una sola vez |

Una key por sitio, nunca compartida: es lo que hace posible el reporte por sitio y permite cortar un sitio comprometido sin tocar los demás. Nunca en HTML, nunca en JS de cliente, nunca en el repositorio. `.env.example` documenta ambas con un comentario de dónde salen.

### 2.3 El endpoint

`POST {VENDERCRM_URL}/api/v1/leads`
Cabeceras: `Content-Type: application/json`, `X-Api-Key: <key del sitio>`

| Campo | Obligatorio | Notas |
|---|---|---|
| `phone` | **sí** | 6–30 caracteres. Es la identidad del contacto. El formato local `0981 123 456` se normaliza a `+595981123456` del lado del CRM |
| `idempotency_key` | **sí** | 8–100 caracteres |
| `name` | no | ≤ 200 |
| `email` | no | ≤ 320, debe parsear como email si se envía |
| `message` | no | ≤ 5000 |
| `source` | no | ≤ 100 |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | no | ≤ 200 c/u |
| `gclid`, `fbclid` | no | ≤ 200 |
| `page_url`, `referrer` | no | ≤ 2000 |
| `fields` | no | Objeto con lo demás que valga la pena en la línea de tiempo |

**Se omiten los campos opcionales vacíos.** Enviar `email: ""` falla la validación; hay que no enviar la clave.

**Nunca se envía `pipeline`, `stage`, `owner` ni `tag`.** El enrutamiento vive en el registro del sitio dentro del CRM, para que se pueda re-enrutar sin tocar código y para que una key filtrada no pueda desviar leads a otro pipeline.

### 2.4 `idempotency_key`

```
sha256(phone_e164 + "|" + YYYY-MM-DD-HH)
```

Colapsa el doble clic y el reintento tras timeout, pero deja que la misma persona vuelva a consultar mañana. Se guarda en `leads.idempotency_key` con índice único: nuestra base también rechaza el duplicado antes de llamar al CRM.

### 2.5 Payload por tipo de lead

**Financiación** (`type = financing`):
```json
{
  "phone": "0981 123 456",
  "idempotency_key": "<sha256>",
  "name": "Juan Pérez",
  "message": "Consulta de financiación desde la publicación A3F9K2P1",
  "source": "site:moto-com-py",
  "page_url": "https://moto.com.py/aviso/honda-cg-150-titan-2022-asuncion-a3f9k2p1",
  "fields": {
    "tipo_lead": "financiacion",
    "listing_ref": "A3F9K2P1",
    "marca": "Honda",
    "modelo": "CG 150 Titan",
    "anio": 2022,
    "precio_gs": 12500000,
    "ciudad": "Asunción",
    "entrega_disponible_gs": 2000000,
    "plazo_deseado_meses": 24,
    "situacion_laboral": "relacion_dependencia",
    "comercio": "Motocenter Asunción"
  }
}
```

**Seguro** (`insurance`), **plan de comercio** (`dealer_plan`), **publicidad** (`advertising`): misma forma, `fields.tipo_lead` distinto y los datos propios de cada uno.

**No se envían** (ADR-08): clics de WhatsApp comprador→vendedor, vistas, ni publicaciones creadas. Son eventos propios, no leads del propietario.

### 2.6 Manejo de respuestas

| Código | Significado | Qué hace el handler |
|---|---|---|
| `201` | Creado. Cuerpo: `contactId`, `dealId`, `submissionId`, `duplicate:false` | `crm_status = sent`, guardar ids |
| `200` | Idempotencia repetida. `duplicate:true` | `crm_status = duplicate`. **Es éxito**: el reintento funcionó |
| `401` | Key ausente o inválida | `failed`. Log en nivel error: el sitio está mal configurado |
| `403` | Sitio desactivado o suscripción en sólo lectura | `failed`. Avisar de revisar **Sitios** / facturación |
| `422` | Validación fallida | `failed`. **Guardar el cuerpo entero**: nombra el campo |
| `429` | Límite de 60/min por sitio | `failed`, reintento con backoff |
| timeout / red | — | `failed`, reintento |

Cada intento escribe una fila en `lead_deliveries`.

### 2.7 Reglas que deciden si esto funciona en producción

1. **Key del lado servidor.** §2.1.
2. **Siempre `idempotency_key`.** Sin él, cada doble clic y cada timeout con escritura exitosa es un contacto duplicado que alguien tiene que limpiar a mano.
3. **El teléfono es obligatorio y es la identidad.** `required` en el HTML, `type="tel"`, y validación en el servidor también. Se acepta el formato local que la gente escribe.
4. **El spam se frena en el sitio, no en el CRM.** Honeypot en todo formulario:
   ```html
   <input name="website" tabindex="-1" autocomplete="off"
          style="position:absolute;left:-9999px" aria-hidden="true">
   ```
   Si llega con contenido: redirigir a la página de gracias y **no** postear nada. Con tráfico real, sumar Cloudflare Turnstile.
5. **Nunca bloquear al visitante esperando al CRM.** Timeout ~10 s, try/catch. Si el CRM no responde, el visitante igual ve la página de gracias y el fallo queda en el log y en `leads.crm_status = failed`.
6. **Capturar atribución.** Incluir en todas las páginas:
   ```html
   <script src="{VENDERCRM_URL}/vc-attribution.js" defer></script>
   ```
   Guarda los primeros `utm_*`/`gclid`/`fbclid` en una cookie `vc_attr` de 90 días y **no la sobrescribe**, de modo que quien llegó por una campaña hoy y convierte la semana que viene se atribuye bien. Se lee del lado servidor y se mapea al payload. Sin esto, todos los leads parecen tráfico directo.

### 2.8 Reintentos

`leads` con `crm_status = failed` y `crm_attempts < 5` se reintentan con backoff (1 min, 5 min, 30 min, 2 h, 12 h). Mismo `idempotency_key` — por eso el reintento es seguro. Tras 5 intentos: alerta en el admin. El lead está en nuestra base igual: no se pierde nunca.

### 2.9 Verificación antes de dar por hecha la integración

No alcanza con que compile:
1. Enviar el formulario real con un teléfono real.
2. VenderCRM → **Contactos**: el contacto está, teléfono normalizado a `+595…`.
3. Si el sitio tiene etapa por defecto configurada, **Pipeline** muestra el negocio.
4. **Sitios** cuenta el lead contra este sitio.
5. Enviar el mismo formulario dos veces seguidas: **no** debe crear un segundo contacto. Si lo crea, la `idempotency_key` no es estable.

### 2.10 Diagnóstico cuando no llegan leads

En orden de frecuencia real:
1. **Mirar primero el log del servidor.** El handler traga los errores por diseño (regla 5): el fallo está en el log, no en pantalla.
2. `401` → key mal, o la cabecera `X-Api-Key` no se está enviando. Confirmar que la variable se lee en tiempo de ejecución.
3. `422` → el cuerpo nombra el campo. Casi siempre `email: ""` enviado en vez de omitido, o `idempotency_key` de menos de 8 caracteres.
4. `403` → sitio desactivado en **Sitios**, o suscripción vencida.
5. Nada en el log → el formulario no llega al handler. Revisar `action` y método.
6. Aparece el contacto pero no el negocio → esperable si el sitio no tiene etapa por defecto. Es configuración del CRM, no un bug.

---

## 3. Analítica

- **Propia primero:** `listing_events` es la fuente de verdad de vistas, clics de WhatsApp y revelados de teléfono. No depende de bloqueadores ni de terceros, y permite pagar/reportar a comercios con datos propios.
- **Google Search Console** desde el día uno: es la única fuente real de consultas.
- **Analítica de terceros:** una sola, ligera y respetuosa de la privacidad. Sin Google Analytics en fase 1 salvo necesidad concreta — añade peso, complica el aviso de privacidad y duplica lo que ya medimos.
- **Sin píxeles publicitarios** mientras no haya campañas (ADR-14). Cada píxel es una obligación en el aviso de privacidad.

---

## 4. Pagos

Fase 1 manual (ADR-13):

1. El comercio pide un plan o un destacado (formulario o WhatsApp) → `leads` tipo `dealer_plan`.
2. Se cotiza y se acuerda por WhatsApp.
3. Paga por transferencia bancaria, Tigo Money o Billetera Personal.
4. Un admin registra el cobro en `featured_purchases` / `dealer_plans` con método, referencia y vigencia.
5. Un job diario expira lo vencido y apaga `listings.is_featured`.

Sin Bancard/vPOS hasta ~15 cobros mensuales manuales o demanda concreta de autogestión. La integración tiene coste y burocracia reales.

---

## 5. Correo

Fase 1: transaccional mínimo (aviso de aprobación o rechazo al vendedor si dejó email; alertas internas). El canal principal hacia el vendedor es WhatsApp, manual, desde el número del sitio.

Proveedor: SMTP de Hostinger si alcanza; si no, un servicio transaccional. SPF, DKIM y DMARC configurados antes del primer envío. Sin boletín en fase 1 (requiere doble opt-in y política de datos, `LEGAL_AND_COMPLIANCE.md`).

---

## 6. Variables de entorno

```
DATABASE_URL=mysql://usuario:clave@host:3306/base
SITE_URL=https://moto.com.py
SITE_NOINDEX=true            # true hasta 150 publicaciones reales
VENDERCRM_URL=
VENDERCRM_API_KEY=
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=/home/.../uploads
IP_HASH_SALT=
SESSION_SECRET=
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS=
WHATSAPP_SITE_NUMBER=        # E.164, contacto general del sitio
```

`.env.example` se versiona con todas las claves y un comentario de origen; el `.env` real nunca.
