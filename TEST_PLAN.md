# TEST_PLAN.md

Qué se verifica y cómo. **Regla general: no se declara terminado algo porque compila.** Las integraciones se verifican con el round-trip real, no con el código leído.

---

## 1. Estrategia

Sin cobertura por cobertura. Se testea lo que rompe silenciosamente o lo que es caro de descubrir tarde:

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Unitarias | Vitest | Formato de guaraníes, normalización de teléfono, slugify, cálculo de umbral de indexación, construcción del payload del CRM, `idempotency_key`, transiciones de estado |
| Integración | Vitest + MySQL de prueba | Queries de listado y facetas, alcance por fila, jobs de vencimiento, reintento de leads |
| E2E | Playwright | Publicar, contactar por WhatsApp, enviar lead de financiación, moderar |
| Manual | Checklist | SEO, rendimiento, accesibilidad, round-trip del CRM |

**No se testea:** estilos (el diseño es provisional, ADR-15), ni componentes triviales de presentación.

---

## 2. Lo que debe tener test unitario sí o sí

Son las funciones donde un error es invisible hasta que ya hizo daño:

1. **Formato de guaraníes** — `12500000 → "Gs. 12.500.000"`. Casos: cero, nulo, números de 4 y 10 dígitos.
2. **Normalización de teléfono** — `0981 123 456`, `0981123456`, `+595 981 123456`, `595981123456` → todos a `+595981123456`. Entradas inválidas → error, nunca un valor a medias.
3. **`idempotency_key`** — misma entrada y misma hora → misma clave; hora distinta → clave distinta; longitud entre 8 y 100.
4. **Payload del CRM** — que **nunca** incluya `pipeline`, `stage`, `owner` ni `tag`; que omita las claves opcionales vacías en vez de mandar `""`; que `phone` siempre esté presente.
5. **Umbral de indexación** — dado un conteo y un largo de contenido, decide indexable o `noindex`, en los bordes exactos de `SEO_ARCHITECTURE.md` §2.1.
6. **Transiciones de estado** — cada transición permitida por rol de la matriz de `DATABASE_SCHEMA.md` §3, y **pruebas negativas** de las prohibidas.
7. **Slug** — estable, sin acentos, con desambiguación al colisionar; y que **no cambie** al editar el título de una publicación publicada.
8. **Mensaje de WhatsApp** — se construye con datos reales, escapa correctamente y respeta el largo máximo.

---

## 3. Integración

- Listado con cada combinación de filtros devuelve sólo publicaciones vivas.
- Paginación: sin duplicados ni saltos entre páginas.
- **Alcance por fila (fase 2, crítico):** un `dealer` no lee ni escribe publicaciones de otro. Pruebas negativas explícitas por cada endpoint de mutación, incluyendo POST directo saltándose la interfaz.
- Job de vencimiento: cambia sólo lo que corresponde y escribe `activity_log`.
- Job de reintento de leads: reintenta `failed`, respeta el backoff, se detiene a los 5 intentos, no duplica.
- Índice único de `idempotency_key`: el segundo insert falla limpio.
- Seeds idempotentes: ejecutar dos veces no duplica catálogo.

---

## 4. E2E (Playwright, Chromium, viewport móvil)

1. **Publicar:** completar los 5 pasos, subir 2 imágenes, enviar → queda `pending_review` con los datos correctos.
2. **Autosave:** completar 3 pasos, recargar → los datos siguen ahí.
3. **Moderar:** aprobar desde el admin → la publicación es pública y aparece en el listado.
4. **Rechazar:** con motivo → no es pública y el motivo queda registrado.
5. **Contacto WhatsApp:** clic en el CTA → se registra `whatsapp_click` y responde 302 a `wa.me` con el texto correcto.
6. **Lead de financiación:** enviar → fila en `leads`, página de gracias visible **incluso con el CRM caído** (simular fallo).
7. **Honeypot:** enviar con el campo trampa lleno → página de gracias, **ninguna** fila en `leads`.
8. **Búsqueda vacía:** filtros sin resultados → estado vacío honesto, sin resultados inventados.
9. **Ficha vencida:** responde 200 con banner y `noindex`.
10. **Permisos:** un `moderator` no accede a cobros ni a configuración.

---

## 5. Verificación del CRM (obligatoria antes de cerrar fase 1)

No se marca la integración como hecha sin esto (`INTEGRATIONS.md` §2.9):

1. Enviar el formulario real con un teléfono real.
2. VenderCRM → **Contactos**: el contacto está, con el teléfono normalizado a `+595…`.
3. Si el sitio tiene etapa por defecto, **Pipeline** muestra el negocio.
4. **Sitios** cuenta el lead contra este sitio.
5. **Enviar el mismo formulario dos veces seguidas → no debe crear un segundo contacto.** Si lo crea, la `idempotency_key` no es estable.
6. Simular CRM caído (URL inválida) → el visitante ve la página de gracias, el lead queda en `failed` y el reintento lo recupera.
7. Verificar que `utm_*` llegan cuando se entra con parámetros de campaña y se convierte en otra página.

---

## 6. Checklist SEO por PR

Ejecutar el de `SEO_ARCHITECTURE.md` §12 y además:
- [ ] `SITE_NOINDEX=true` sigue produciendo `noindex` en producción hasta cumplir el criterio de salida
- [ ] Ninguna URL nueva con filtros es indexable
- [ ] Ninguna página `noindex` aparece en el sitemap
- [ ] JSON-LD valida y no contiene `Review` ni `AggregateRating`

## 7. Rendimiento

Antes de cerrar fase 1, con Lighthouse en móvil y throttling 4G, sobre `/`, `/motos`, una ficha y una página de marca:

| Métrica | Objetivo |
|---|---|
| LCP | < 2,5 s |
| INP | < 200 ms |
| CLS | < 0,1 |
| Peso de ficha con 5 imágenes | < 500 KB |

Además: `EXPLAIN` sobre la query de listado facetado con ≥ 10.000 filas; ningún escaneo completo de tabla.

## 8. Accesibilidad

axe sin violaciones críticas; navegación completa por teclado en el formulario de publicación y en la cola de moderación; foco visible; `alt` reales; un solo `h1` por página; formularios usables con lector de pantalla.

## 9. Seguridad

- Subida de archivos: rechazar un archivo renombrado a `.jpg` que no sea imagen; rechazar SVG; re-encodear todo.
- XSS: descripción con `<script>` se muestra escapada.
- Fuerza bruta en login: bloqueo tras 5 intentos.
- Rutas de admin sin sesión → redirección, y las de API → 401.
- Mutación con rol insuficiente → 403 aunque se llame directamente al endpoint.
- Sin secretos en el bundle del cliente: buscar `VENDERCRM_API_KEY` en el build de salida — **cero coincidencias**.

## 10. Antes de cada despliegue

- [ ] `npm run build` limpio
- [ ] Tests verdes
- [ ] Migraciones probadas contra copia de producción
- [ ] Variables de entorno presentes en Hostinger (especialmente `VENDERCRM_API_KEY` y `DATABASE_URL`)
- [ ] `SITE_NOINDEX` en el valor correcto para la fase
- [ ] Sin datos de prueba en producción (ADR-12)
- [ ] Plan de reversión: commit anterior identificado
