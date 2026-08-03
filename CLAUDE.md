# CLAUDE.md — moto.com.py

Este archivo se carga en toda sesión de este repositorio. Es el guardarraíl.

**Antes de trabajar:** leé `PLAN.md` §4 (ownership de decisiones) y la tarea correspondiente en `CLAUDE_TASKS.md`. Ante cualquier duda de arquitectura, la respuesta está en `DECISIONS.md`.

---

## 1. Qué es este proyecto

Portal de motos para Paraguay. **El negocio no es el clasificado: es la captación de leads de financiación y la venta de planes a comercios** (ADR-01). El clasificado existe porque produce el inventario y las páginas que rankean.

Consecuencia práctica: si una decisión de implementación beneficia al flujo de financiación o al inventario de comercios, va primero.

---

## 2. Stack (ADR-04)

- Next.js 15, App Router, TypeScript, Tailwind
- Drizzle ORM + MySQL (`drizzle-orm/mysql2`), pool con `connectionLimit: 8`, `timezone: "Z"`
- `tsx` para scripts sueltos — **no carga `.env` solo**, hay que cargarlo explícitamente
- Despliegue: slot Node.js gestionado de Hostinger

**Prohibido sin escalar:** features exclusivas de Vercel, supuestos de edge/serverless, Redis, Elasticsearch/Algolia, S3 en fase 1, cualquier servicio con coste mensual, y cualquier pasarela de pago (ADR-13).

---

## 3. Las cinco reglas que no se rompen

### 3.1 Nada inventado

Ni datos, ni conteos, ni reseñas, ni logos, ni estadísticas, ni publicaciones de ejemplo en producción.

- Todo número público sale de una consulta real.
- **Nunca** `AggregateRating` ni `Review` en JSON-LD (ADR-10).
- Sin urgencia falsa, sin "más de X motos", sin "el portal N°1".
- Sin logo de comercio o marca sin autorización escrita.
- Si falta un dato y no hay fuente: `[VERIFICAR: qué confirmar y dónde]`. Es una respuesta aceptable; inventar no.
- Los estados vacíos dicen la verdad y ofrecen algo útil.

### 3.2 Español paraguayo en todo lo visible

Voseo (*publicá*, *escribinos*, *fijate*). `Gs. 12.500.000`. Teléfono visible `0981 123 456`, almacenado `+595981123456`. Vocabulario: *moto*, *en cuotas*, *entrega*, *chapa*, *taller*, *repuestos*, *manejar*. Nada de *coche*, *carro*, *móvil*, *conducir*, *checar*. Guía completa: `CONTENT_STRATEGY.md` parte 1.

Botón principal: **"Escribir por WhatsApp"**, nunca "Contactar".

### 3.3 Los permisos se validan en el servidor

Ocultar un botón no es un permiso. Toda mutación llama a `requireRole` y, para roles con alcance, filtra por `dealerId`/`ownerId`. Un POST directo con rol insuficiente devuelve 403.

### 3.4 La regla de indexación es código, no criterio

Una página programática por debajo del umbral de `SEO_ARCHITECTURE.md` §2.1 emite `noindex` **y** queda fuera del sitemap, automáticamente y de forma reversible. Es lo que impide la explosión de páginas finas. No se relaja "por esta vez".

`SITE_NOINDEX=true` está activo hasta que el propietario lo apague con el criterio cumplido.

### 3.5 La conversión se mide

Los CTA de WhatsApp **nunca** enlazan directo a `wa.me`. Pasan por `/ir/wa/*`, que registra el evento y devuelve 302 (ADR-07). Si el registro falla, se redirige igual.

---

## 4. Leads y VenderCRM

- El navegador **nunca** habla con VenderCRM. El formulario postea a nuestro servidor; el servidor postea al CRM con `VENDERCRM_API_KEY` desde el entorno.
- Obligatorios: `phone` e `idempotency_key` = `sha256(phone + "|" + YYYY-MM-DD-HH)`.
- **Nunca** enviar `pipeline`, `stage`, `owner` ni `tag`.
- Omitir los opcionales vacíos; `email: ""` falla la validación.
- `200` con `duplicate:true` es **éxito**.
- Guardar el lead en nuestra base **antes** de llamar al CRM. El visitante nunca ve un error del CRM.
- Honeypot en todo formulario.
- Sólo van al CRM los leads comerciales; los clics de WhatsApp comprador→vendedor **no** (ADR-08).

Contrato completo: `INTEGRATIONS.md` §2. Verificación obligatoria: `TEST_PLAN.md` §5.

---

## 5. Diseño visual: deliberadamente provisional (ADR-15)

El diseño se resuelve en una pasada dedicada posterior. Estilo mínimo con Tailwind, sin librería de componentes, sin animaciones, sin pulir el admin.

**Lo que sí es obligatorio ahora,** porque el rediseño cambia estilos y no estructura: HTML semántico, un solo `h1`, `label` en cada input, foco visible, contraste AA, área táctil ≥ 44 px, `alt` reales, mobile-first, y el presupuesto de rendimiento de `SEO_ARCHITECTURE.md` §10.

---

## 6. Antes de abrir un PR

1. Correr el **checklist de escalado de `PLAN.md` §4.3**. Si algún ítem da sí → issue `ESCALACIÓN: <tema>`, sin PR.
2. Una tarea de `CLAUDE_TASKS.md`, un PR, una sola fase.
3. Si toca páginas públicas: checklist de `SEO_ARCHITECTURE.md` §12.
4. Verificar de verdad. Compilar no es verificar; una integración no está hecha sin su round-trip.
5. En el PR: criterios de aceptación marcados y qué se verificó, incluido lo que quedó sin verificar.

**Escalar siempre que:** haga falta una tabla o columna nueva, cambie un estado o un permiso, cambie una URL o una regla de indexación, cambie el payload del CRM, cambie un precio o plan, se toque moderación o texto legal, se agregue un servicio externo, o haya que elegir entre dos opciones que estos documentos no resuelven.

**Texto legal:** ninguna sesión de implementación lo escribe ni lo "mejora" (`LEGAL_AND_COMPLIANCE.md` §10).

---

## 7. Mapa de documentos

| Necesito saber… | Documento |
|---|---|
| Por qué el proyecto es así | `PLAN.md` |
| Por qué se decidió X | `DECISIONS.md` |
| Qué construir ahora | `CLAUDE_TASKS.md` |
| Tablas, índices, estados | `DATABASE_SCHEMA.md` |
| URLs, indexación, JSON-LD | `SEO_ARCHITECTURE.md` |
| Pantallas y flujos | `PRODUCT_SPEC.md` |
| Admin y permisos | `ADMIN_SPEC.md` |
| WhatsApp, CRM, pagos | `INTEGRATIONS.md` |
| Fraude y moderación | `TRUST_AND_SAFETY.md` |
| Precios y planes | `MONETIZATION.md` |
| Estilo y contenido | `CONTENT_STRATEGY.md` |
| Métricas y definiciones | `ANALYTICS_AND_KPIS.md` |
| Obligaciones legales | `LEGAL_AND_COMPLIANCE.md` |
| Qué verificar | `TEST_PLAN.md` |
| Fases y criterios de salida | `IMPLEMENTATION_PHASES.md` |
| Inventario inicial | `DATA_SEEDING.md` |
