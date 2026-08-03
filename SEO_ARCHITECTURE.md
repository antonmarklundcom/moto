# SEO_ARCHITECTURE.md

Normativo. Cambiar un patrón de URL, un canonical o una regla de indexación exige escalar a Opus (`PLAN.md` §4.3).

**Premisa:** el motor de este proyecto es tráfico de búsqueda con intención comercial. El mayor riesgo no es no rankear: es generar decenas de miles de páginas finas y degradar la calidad percibida de todo el dominio. Este documento existe sobre todo para impedir eso.

---

## 1. Taxonomía de URLs

Slugs en español, minúsculas, sin acentos, separados por guiones. Sin `.html`. Sin barra final. HTTPS y `www` → sin `www` (301).

| Patrón | Ejemplo | Tipo |
|---|---|---|
| `/` | `/` | Home |
| `/motos` | `/motos` | Listado general + buscador |
| `/motos/:brand` | `/motos/honda` | Marca |
| `/motos/:brand/:model` | `/motos/honda/cg-150-titan` | Marca + modelo |
| `/motos/tipo/:category` | `/motos/tipo/scooter` | Categoría |
| `/motos/ciudad/:city` | `/motos/ciudad/asuncion` | Ciudad |
| `/motos/:brand/ciudad/:city` | `/motos/honda/ciudad/asuncion` | Marca × ciudad (condicional) |
| `/motos/tipo/:category/ciudad/:city` | `/motos/tipo/scooter/ciudad/luque` | Categoría × ciudad (condicional) |
| `/motos/nuevas` · `/motos/usadas` | | Condición |
| `/motos/en-cuotas` | | **Página comercial clave** |
| `/aviso/:slug-:ref` | `/aviso/honda-cg-150-titan-2022-asuncion-a3f9k2p1` | Ficha de publicación |
| `/comercios` | | Índice de comercios |
| `/comercios/:slug` | `/comercios/motocenter-asuncion` | Página de comercio |
| `/financiacion` | | Landing de financiación |
| `/seguros` | | Landing de seguro |
| `/guias` · `/guias/:slug` | `/guias/transferencia-de-chapa-moto-paraguay` | Contenido |
| `/publicar` | | Formulario de publicación |
| `/terminos` · `/privacidad` · `/como-funciona` · `/contacto` | | Estáticas |

**Por qué la ficha lleva el `public_ref` en la URL:** dos motos idénticas (misma marca, modelo, año, ciudad) producirían el mismo slug. Anteponer el sufijo corto garantiza unicidad sin recurrir a IDs largos ni a slugs con números arbitrarios, y hace la URL citable por WhatsApp.

**Inmutabilidad:** un slug publicado nunca cambia. Si cambia el título, el slug queda. Es la regla que evita una cadena de redirecciones creciente.

---

## 2. Reglas de indexación (la sección más importante)

### 2.1 Umbrales

Una página programática es indexable **sólo si cumple todo**:

| Tipo de página | Mínimo de publicaciones vivas | Contenido editorial mínimo |
|---|---|---|
| Marca | 5 | 300 palabras propias (`brands.intro_html`) |
| Marca + modelo | 3 | 250 palabras propias |
| Categoría | 8 | 300 palabras propias |
| Ciudad | 8 | 250 palabras propias |
| Marca × ciudad | 10 | 200 palabras propias, específicas de esa combinación |
| Categoría × ciudad | 10 | 200 palabras propias |
| Condición (nuevas/usadas) | 15 | 300 palabras |
| `/motos/en-cuotas` | 10 | 400 palabras |

"Publicaciones vivas" = `status IN ('published','sold')` con `sold_at` dentro de los últimos 90 días, `deleted_at IS NULL`.

### 2.2 La regla automática

Esto se implementa como **código**, no como disciplina editorial:

1. En cada render, la página calcula su conteo de publicaciones vivas.
2. Si está por debajo del umbral → emite `<meta name="robots" content="noindex, follow">`.
3. Si está por debajo del umbral → **se excluye del sitemap**.
4. Si vuelve a superarlo → vuelve a ser indexable automáticamente, y reaparece en el sitemap en la siguiente generación.
5. Una página sin el contenido editorial mínimo es `noindex` **aunque** supere el umbral de publicaciones. Ambas condiciones, no una.

**Consecuencia deliberada:** al lanzar, casi todas las páginas × ciudad estarán `noindex`. Es correcto. Se ganan a medida que hay inventario real.

### 2.3 Combinaciones que no existen nunca

Estas combinaciones no generan URL ni enlace interno, y devuelven 404:

- Marca × modelo × ciudad (`/motos/honda/cg-150-titan/ciudad/luque`) — explosión combinatoria sin demanda de búsqueda proporcional.
- Cualquier combinación de tres o más facetas.
- Año como segmento de ruta (`/motos/honda/cg-150/2019`) — es un filtro, no una página.
- Rango de precio como ruta — es un filtro.

Si aparece demanda medible para una de estas, se escala a Opus con los datos de Search Console.

### 2.4 Durante el arranque

`SITE_NOINDEX=true` como variable de entorno impone `noindex` global hasta superar 150 publicaciones reales (`DATA_SEEDING.md` §3). Debe ser una variable explícita y visible en el admin, no un olvido. Quitarla es una acción deliberada y registrada.

---

## 3. Filtros, canonical y paginación

### 3.1 Facetas por query string

Los filtros que no tienen página propia viven en query string: `?precio_min=`, `?precio_max=`, `?anio_min=`, `?km_max=`, `?cilindrada=`, `?condicion=`, `?orden=`, `?q=`, `?entrega_max=`, `?cuota_max=`.

**Regla:** toda URL con cualquier query string de filtro u orden es `noindex, follow` y su `<link rel="canonical">` apunta a la URL limpia de la página base.

Ejemplo: `/motos/honda?precio_max=15000000&orden=precio_asc` → `noindex, follow`, canonical a `/motos/honda`.

Excepción única: `?page=N` (ver §3.2).

### 3.2 Paginación

- `/motos/honda?page=2` es **indexable** y **auto-canonical** (canonical a sí misma, no a la página 1). Apuntar el canonical de la página 2 a la 1 esconde el inventario de las páginas profundas.
- Se emiten `rel="prev"` / `rel="next"`. Google dice que ya no los usa; otros buscadores sí, y el coste es cero.
- El `<title>` de la página 2+ incluye "— Página 2" para evitar títulos duplicados.
- Máximo 50 páginas por listado; más allá, el usuario debe filtrar. Evita rastreo infinito.

### 3.3 Orden

`?orden=` nunca es indexable. Existe un único orden por defecto por página, y es el que ve el buscador.

### 3.4 `robots.txt`

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /ir/          # redirecciones rastreadas de WhatsApp
Disallow: /*?orden=
Disallow: /*?q=
Disallow: /publicar/exito
Sitemap: https://moto.com.py/sitemap.xml
```

No se bloquean los parámetros de filtro por `robots.txt` (bloquear impide ver el `noindex`); se manejan con la meta y el canonical. Sí se bloquean búsqueda libre y orden, que no aportan nada al rastreo.

---

## 4. Publicaciones vencidas y vendidas

Es la decisión de SEO más consecuente en un clasificado: son el mayor activo (URLs con antigüedad y enlaces) y el mayor pasivo (páginas sin producto).

**Decisión:**

| Estado | HTTP | Indexación | Qué ve el usuario |
|---|---|---|---|
| `sold`, < 90 días | 200 | indexable | Ficha con banner "Esta moto ya se vendió", precio visible, CTA a motos similares reales |
| `sold`, ≥ 90 días | 200 | `noindex, follow` | Igual, sin indexar |
| `expired` | 200 | `noindex, follow` | "Esta publicación venció", CTA a similares y a renovar |
| Vencida/vendida hace > 12 meses | **301** | — | Redirige a la página de marca+modelo correspondiente |
| Borrada por fraude | **410** | — | Página de error explicando que se retiró |
| Nunca existió | 404 | — | |

**Por qué no 404 inmediato:** una ficha vendida sigue respondiendo la intención del usuario ("¿cuánto sale una CG 150 usada?") y mantiene el valor del enlace. Devolver 404 el día que se vende es tirar el activo.

**Por qué 301 al año:** después de 12 meses el precio es engañoso y la página ya no ayuda a nadie. Consolidar en la página de modelo preserva el valor sin mantener ruido.

**Por qué 410 en fraude:** señal explícita de retirada permanente. Y no queremos que reaparezca.

El job diario que ejecuta estas transiciones vive en `IMPLEMENTATION_PHASES.md` fase 1.

---

## 5. Contenido de la ficha: el problema del contenido fino

Una publicación de particular tiene dos líneas de descripción. Sin ayuda, cada ficha es contenido fino.

**Mitigaciones, todas sin inventar nada:**

1. **Datos estructurados visibles y ricos:** marca, modelo, año, km, cilindrada, condición, ciudad, entrega, cuota, permuta. Son datos reales de la base y dan sustancia a la página.
2. **Bloque de contexto del modelo,** tomado de `models.intro_html` (escrito una vez, reusado), claramente separado de la descripción del vendedor.
3. **Enlazado interno real:** otras unidades del mismo modelo, del mismo comercio, de la misma ciudad — sólo si existen; si no, no se muestra el bloque.
4. **Rango de precios del modelo** calculado desde publicaciones reales del sitio, mostrando el número de unidades sobre el que se calcula. Si hay menos de 5, no se muestra.
5. **Mínimo de descripción en el formulario:** 120 caracteres, con ayudas concretas ("contá el estado, si tiene papeles al día, por qué la vendés").
6. Lo que **no** se hace: generar descripciones automáticas que suenen a escritas por el vendedor. Es fabricación (`PLAN.md` §5). Un bloque de contexto del modelo etiquetado como tal no lo es.

---

## 6. Datos estructurados (JSON-LD)

| Página | Schema |
|---|---|
| Ficha | `Product` con `Vehicle` como `itemOffered`, `Offer` (`priceCurrency: "PYG"`, `availability`), `BreadcrumbList` |
| Listados (marca, modelo, ciudad, categoría) | `ItemList` con `ListItem` y URL, `BreadcrumbList`, `CollectionPage` |
| Comercio | `AutoDealer` con `address`, `telephone`, `areaServed` |
| Guías | `Article` + `BreadcrumbList`, `FAQPage` si tiene preguntas reales |
| Global | `Organization` con `WebSite` y `SearchAction` |

**Prohibiciones duras:**
- **Nunca** `AggregateRating` ni `Review`. No tenemos reseñas (ADR-10). Emitirlas es fabricación y motivo de penalización manual.
- Nunca `priceValidUntil` inventado.
- `availability` refleja el estado real: `InStock` si `published`, `SoldOut` si `sold`.
- Si `has_financing_only`, no se emite `price`; se emite el bloque de financiación como texto, no como precio de oferta.
- Todo dato del JSON-LD debe estar también visible en la página. Sin excepciones.

---

## 7. Sitemaps

Índice en `/sitemap.xml`, hijos segmentados, máximo 5.000 URLs cada uno:

- `/sitemaps/listings-N.xml` — sólo `published`, y `sold` de menos de 90 días
- `/sitemaps/brands.xml`, `/sitemaps/models.xml`, `/sitemaps/cities.xml`, `/sitemaps/categories.xml` — **sólo las que superan el umbral de §2.1**
- `/sitemaps/dealers.xml` — comercios `active` con ≥ 1 publicación viva
- `/sitemaps/content.xml` — guías publicadas y páginas estáticas

Reglas: `lastmod` real desde `updated_at`, nunca la fecha de hoy. Sin `priority` ni `changefreq` (Google los ignora, dan falsa sensación de control). Regeneración diaria más invalidación bajo demanda al publicar o vencer. Una URL `noindex` jamás aparece en un sitemap.

---

## 8. Enlazado interno

- Home → marcas principales, categorías, ciudades principales, `/motos/en-cuotas`, últimas publicaciones.
- Marca → sus modelos con inventario, sus ciudades con inventario (sólo las que superan umbral).
- Ficha → modelo, marca, ciudad, categoría, comercio, unidades similares reales.
- Guías → páginas de listado relevantes con anclaje descriptivo (`related_brand_id` y `related_city_id` de `posts` automatizan esto).
- Migas de pan en toda página profunda, con `BreadcrumbList`.

**Regla:** nunca se enlaza internamente a una página `noindex` por umbral desde la navegación principal. Sí desde filtros contextuales. Enlazar en masa a páginas que le dijimos a Google que no indexe es una señal contradictoria y desperdicia rastreo.

---

## 9. Metadatos

Plantillas (`{}` = dato real de la base; si un dato falta, el segmento se omite, no se rellena):

| Página | Title | Meta description |
|---|---|---|
| Ficha | `{Marca} {Modelo} {Año} — Gs. {precio} en {Ciudad} \| moto.com.py` | `{Condición} con {km} km en {ciudad}. {Entrega y cuota si existen}. Contactá al vendedor por WhatsApp.` |
| Marca | `Motos {Marca} en Paraguay — {N} publicadas \| moto.com.py` | `Encontrá motos {Marca} en Paraguay. Precios en guaraníes, nuevas y usadas, contacto directo por WhatsApp.` |
| Marca+modelo | `{Marca} {Modelo} en Paraguay — precios y unidades \| moto.com.py` | |
| Ciudad | `Motos en {Ciudad} — {N} publicadas \| moto.com.py` | |
| En cuotas | `Motos en cuotas en Paraguay — entrega y cuota mensual \| moto.com.py` | |

**El `{N}` sale de una consulta real, siempre** (`PLAN.md` §5). Si es 0, la página es `noindex` y el título omite el conteo.

Reglas: title ≤ 60 caracteres visibles cuando sea posible, description 140–160, ningún par duplicado en todo el sitio, `og:` y `twitter:` completos con la primera imagen real de la publicación.

---

## 10. Rendimiento como factor de ranking y de conversión

Presupuesto medido en 4G paraguaya con un Android de gama media:

| Métrica | Objetivo |
|---|---|
| LCP | < 2,5 s |
| INP | < 200 ms |
| CLS | < 0,1 |
| Peso de la ficha | < 500 KB con 5 imágenes |
| Imagen de listado | ≤ 40 KB (WebP/AVIF) |

Medidas obligatorias: `next/image` con `width`/`height` desde la base (por eso las columnas existen), lazy loading salvo la primera imagen, `priority` sólo en el LCP, sin fuentes web pesadas (system stack hasta la pasada de diseño), JS de cliente mínimo — la ficha y los listados son server components.

---

## 11. Consultas objetivo (mapa inicial)

Volumen bajo, intención altísima. Se compensa con profundidad, no con cantidad.

| Grupo | Ejemplos | Página destino |
|---|---|---|
| Marca + modelo + precio | `honda cg 150 precio paraguay`, `yamaha ybr 125 precio` | Marca+modelo |
| Financiación | `motos en cuotas asunción`, `moto sin entrega paraguay`, `cuanto sale una moto en cuotas` | `/motos/en-cuotas`, `/financiacion` |
| Compra local | `motos usadas asuncion`, `motos baratas ciudad del este` | Ciudad |
| Trámite | `transferencia de chapa moto paraguay`, `papeles para transferir una moto` | Guías |
| Comparación | `mejor moto 150 para trabajar`, `scooter o naked` | Guías |
| Categoría | `scooter automatica paraguay`, `moto de carga triciclo` | Categoría |

**Nota honesta para quien planifique contenido:** el volumen de búsqueda en español paraguayo es chico y las herramientas lo miden mal. Una consulta con 30 búsquedas al mes que termina en la compra de una moto de Gs. 20.000.000 vale más que 3.000 búsquedas informativas. No perseguir volumen.

**Anti-canibalización:** una consulta, una página. Antes de crear una guía nueva, verificar que no compita con una página de listado existente. Si compite, se enlaza a la de listado en vez de duplicarla.

---

## 12. Checklist de verificación (por PR que toque páginas públicas)

- [ ] Toda página nueva tiene title y description únicos generados desde datos reales
- [ ] Toda página programática aplica la regla de umbral de §2.2
- [ ] Ninguna URL con filtro es indexable
- [ ] El canonical apunta a donde dice §3
- [ ] JSON-LD válido en el validador de Google, sin `Review` ni `AggregateRating`
- [ ] Todo dato del JSON-LD está visible en la página
- [ ] La página no aparece en el sitemap si es `noindex`
- [ ] Migas de pan presentes y correctas
- [ ] Sin enlaces internos masivos a páginas `noindex`
- [ ] Imágenes con `width`, `height` y `alt` real
