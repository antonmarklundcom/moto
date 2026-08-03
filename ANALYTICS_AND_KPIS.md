# ANALYTICS_AND_KPIS.md

Qué se mide, cómo se define, qué se mira cada semana y qué número obliga a cambiar de rumbo.

**Principio:** la analítica propia (`listing_events`, `leads`) es la fuente de verdad. No depende de bloqueadores, permite pagarle y reportarle a comercios con datos propios, y es lo que sostiene el argumento de venta del `MONETIZATION.md` §3.2.

---

## 1. Definiciones (para que nadie discuta después qué es un lead)

| Término | Definición exacta |
|---|---|
| **Publicación viva** | `status IN ('published','sold')`, `sold_at` dentro de 90 días, `deleted_at IS NULL` |
| **Vista de ficha** | Un `listing_events.view` con `is_bot = false`, deduplicado por `session_hash` + `listing_id` en 30 minutos |
| **Contacto** | Un `whatsapp_click` o `phone_reveal`, `is_bot = false`. **Es la conversión principal del sitio** |
| **Lead** | Una fila en `leads` no marcada `is_spam`. Sólo tipos comerciales (ADR-08) |
| **Lead de financiación** | `leads.type = 'financing'`, `is_spam = false` |
| **Lead cualificado** | Lead de financiación con teléfono contactable, modelo de interés y entrega declarada. **La contactabilidad se confirma fuera del sitio**, en VenderCRM. El sitio no puede declararlo solo |
| **Comercio activo** | `dealers.status = 'active'` con ≥ 1 publicación viva |
| **Tasa de contacto** | Contactos ÷ vistas de ficha |

**Regla:** ninguna métrica pública ni comercial se reporta con un número que no salga de estas definiciones (`PLAN.md` §5).

---

## 2. Eventos

### 2.1 Propios (`listing_events`) — obligatorios

| Evento | Cuándo | Campos clave |
|---|---|---|
| `view` | Render de ficha en servidor | `listing_id`, `session_hash`, `referrer`, `is_bot` |
| `whatsapp_click` | En `/ir/wa/*`, antes del 302 | `listing_id`, `dealer_id` |
| `phone_reveal` | Al revelar el teléfono | `listing_id` |
| `lead_submit` | Al guardar un lead | `listing_id`, tipo en `leads` |
| `share` | Al usar compartir | `listing_id` |
| `favorite` | Intento de guardar favorito | Mide demanda de una función que no existe (ADR-05) |

`session_hash`, `ip_hash` y `user_agent_hash` son hashes con sal (`IP_HASH_SALT`), nunca el valor crudo. Ver `LEGAL_AND_COMPLIANCE.md`.

**Filtrado de bots:** user-agent conocido, ausencia de `Referer` propio en navegación interna, y más de 30 vistas por `session_hash` en 10 minutos. Se marcan `is_bot`, se guardan, y se excluyen de todo reporte. **No se borran**: sirven para ajustar la heurística.

### 2.2 Search Console

Fuente única y real de consultas. Se conecta el día uno, antes de quitar `SITE_NOINDEX`. Lo que se mira: consultas por página, CTR por página, páginas indexadas contra enviadas, y errores de cobertura.

### 2.3 Analítica de terceros

Una sola, ligera y respetuosa de la privacidad (`INTEGRATIONS.md` §3). Sin píxeles publicitarios mientras no haya campañas.

---

## 3. Tablero semanal

Once números. Si no cabe en una pantalla, no se mira.

**Inventario**
1. Publicaciones vivas (y variación semanal)
2. Altas nuevas: de comercios / de particulares
3. Comercios activos
4. Publicaciones vencidas sin renovar

**Demanda**
5. Vistas de ficha
6. Contactos (WhatsApp + teléfono)
7. Tasa de contacto

**Negocio**
8. **Leads de financiación** ← la métrica que define el proyecto
9. Leads de otros tipos
10. Leads con `crm_status = failed` ← salud de la integración

**Operación**
11. Cola de moderación: pendientes y tiempo mediano

## 4. Tablero mensual

- Sesiones e impresiones desde Search Console, con las 20 consultas principales.
- Páginas programáticas indexables contra `noindex` por umbral (`SEO_ARCHITECTURE.md` §2). Es la métrica de si el SEO programático está creciendo o quedando bloqueado.
- Contactos y leads **por comercio** — el reporte que se le muestra al comercio al vender el plan.
- Ingresos cobrados (registro, no proyección).
- Denuncias por cada 100 publicaciones vivas.
- Modelos más buscados sin inventario → qué stock salir a buscar.

---

## 5. Metas por fase

Metas de trabajo, no proyecciones de negocio. Sirven para saber si seguir.

| Momento | Publicaciones vivas | Comercios | Contactos/sem | Leads financiación/mes |
|---|---|---|---|---|
| Fin fase 1 | 150 | 5 | — (sin público) | — |
| +3 meses | 300 | 8 | 40 | 10 |
| +6 meses | 500 | 12 | 120 | 25 |
| +12 meses | 1.000 | 20 | 350 | 60 |

Se revisan con datos reales al tercer mes. Una meta que no se cumple no es un fracaso automático: es una pregunta sobre cuál de los supuestos era falso.

---

## 6. El número que mata el proyecto

**Si a los 6 meses de tener 150+ publicaciones vivas el sitio genera menos de 20 leads de financiación al mes, con tendencia plana durante 3 meses seguidos, la tesis de `PLAN.md` §1.2 es falsa.**

Qué significa exactamente: la gente encuentra el sitio, mira motos, contacta vendedores — pero no quiere que la ayudemos con la financiación. Si eso pasa, el sitio puede ser un clasificado útil, pero no es el negocio que este plan describe.

**Qué se hace entonces, en orden:**
1. Verificar que no sea un problema de implementación: ¿el CTA se ve? ¿el formulario funciona en móvil? ¿los leads llegan al CRM? Medir antes de concluir.
2. Verificar que no sea un problema de tráfico: 20 leads exigen cierto volumen de visitas. Si no hay visitas, el problema es SEO, no la tesis.
3. Si el flujo funciona y hay tráfico y aun así no hay leads → **escalar a Opus con los datos** para replantear ADR-01. No parchear.

**Señal opuesta, igual de importante:** si los leads de financiación crecen mientras el inventario C2C se estanca, la tesis es *más* cierta de lo previsto y hay que acelerar fase 3 y buscar la financiera aliada antes de lo planeado.

---

## 7. Reportes a comercios

Lo que se le muestra a un comercio (en el admin en fase 1, en su dashboard en fase 2):

- Publicaciones vivas suyas.
- Vistas de sus fichas.
- Contactos de WhatsApp recibidos por sus motos.
- Leads de financiación originados en sus motos.
- Rango de fechas seleccionable.

**Todos los números salen de consultas reales.** Nada estimado, nada redondeado hacia arriba, nada "aproximado". Si un número es bajo, se muestra bajo: es la base de una relación comercial que dura, y es exactamente el argumento honesto de `DATA_SEEDING.md` §2.

---

## 8. Retención de datos

- `listing_events` crudo: 180 días, luego resumen diario agregado y purga (`DATABASE_SCHEMA.md` §2.8).
- `leads`: mientras la relación comercial lo justifique; plazo a fijar con abogado.
- `activity_log`: 24 meses.
- Hashes de IP: nunca la IP cruda, salvo `listings.submitted_ip` con el plazo definido en `LEGAL_AND_COMPLIANCE.md`.
