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

`SITE_NOINDEX=true` está activo hasta que el propietario lo cambie con el criterio cumplido. Acepta `true | content | false` (ADR-26); ante un valor ausente o inválido, falla cerrado a `true`. Sólo el propietario lo cambia.

### 3.5 La conversión se mide

Los CTA de WhatsApp **nunca** enlazan directo a `wa.me`. Pasan por `/ir/wa/*`, que registra el evento y devuelve 302 (ADR-07). Si el registro falla, se redirige igual.

---

## 4. Leads y VenderCRM

- El navegador **nunca** habla con VenderCRM. El formulario postea a nuestro servidor; el servidor postea al CRM con `VENDERCRM_API_KEY` desde el entorno.
- Obligatorios: `phone` e `idempotency_key` = `sha256(phone_e164 + "|" + type + "|" + YYYY-MM-DD-HH)` (hora UTC, ADR-25; `leadIdempotencyKey()` en `src/lib/hash.ts`).
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

## 6. Proceso de construcción (fase 1 en adelante)

La construcción corre en fases autónomas según **`BUILD_PLAN.md` §4 (protocolo) y §5 (fases)**, ADR-18. Cada fase tiene su archivo en `prompts/` con lo que le pertenece (**Owns**) y sus criterios de salida.

- `BUILD_PLAN.md` §4 reemplaza el orden y el formato de `CLAUDE_TASKS.md` y los puntos 1–2 de §7: rama `phase/<id>`, un PR por fase. Los T-xxx quedan como referencia de criterios de aceptación.
- Escalar = **parada dura** (§4.4): la pregunta con opciones A/B y recomendación va a `docs/decisions-needed.md`, commit, push, fin de la sesión. Lo que no está en el checklist de `PLAN.md` §4.3: elegir razonablemente y dejarlo en `docs/log/<fase>.md`.
- Puerta de calidad: `npm run verify` (typecheck + lint + unitarias + integración contra MySQL local + build). Sin GitHub Actions. El hook `.claude/hooks/session-start.sh` deja MySQL, `.env`, migraciones y catálogo listos.
- Datos de prueba sólo con `npm run fixtures` (títulos `[DEV]`, se niega fuera de local).
- Nunca Fable en fases, subagentes, sesiones lanzadas ni Routines (§4.8).

---

## 7. Antes de abrir un PR

1. Correr el **checklist de escalado de `PLAN.md` §4.3**. Si algún ítem da sí → issue `ESCALACIÓN: <tema>`, sin PR.
2. Una tarea de `CLAUDE_TASKS.md`, un PR, una sola fase.
3. Si toca páginas públicas: checklist de `SEO_ARCHITECTURE.md` §12.
4. Verificar de verdad. Compilar no es verificar; una integración no está hecha sin su round-trip.
5. En el PR: criterios de aceptación marcados y qué se verificó, incluido lo que quedó sin verificar.

**Escalar siempre que:** haga falta una tabla o columna nueva, cambie un estado o un permiso, cambie una URL o una regla de indexación, cambie el payload del CRM, cambie un precio o plan, se toque moderación o texto legal, se agregue un servicio externo, o haya que elegir entre dos opciones que estos documentos no resuelven.

**Texto legal:** ninguna sesión de implementación lo escribe ni lo "mejora" (`LEGAL_AND_COMPLIANCE.md` §10).

---

## 8. Mapa de documentos

| Necesito saber… | Documento |
|---|---|
| Por qué el proyecto es así | `PLAN.md` |
| Cómo se construye, en qué orden, qué falta | `BUILD_PLAN.md` |
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
