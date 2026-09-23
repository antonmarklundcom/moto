# Texto editorial de páginas sin `intro_html` en la base

Decisión del propietario (2026-09-23, `docs/decisions-needed.md` A2 → A). Lo lee `src/lib/seo/editorial.ts`.

| Página | Archivo |
|---|---|
| `/motos/en-cuotas` | `en-cuotas.md` |
| `/motos/nuevas` | `condicion-nuevas.md` |
| `/motos/usadas` | `condicion-usadas.md` |
| `/motos/<marca>/ciudad/<ciudad>` | `marca-ciudad/<marca>-<ciudad>.md` |
| `/motos/tipo/<tipo>/ciudad/<ciudad>` | `tipo-ciudad/<tipo>-<ciudad>.md` |

Frontmatter:

```
---
status: draft | reviewed
reviewed_by: <quién lo revisó>
---
```

Sólo cuenta un archivo `status: reviewed`, con `reviewed_by` y **sin** ningún `[VERIFICAR…]`. Un borrador no se muestra
y no suma palabras: la página sigue `noindex` por regla (`SEO_ARCHITECTURE.md` §2.1). Los textos se leen una vez por
proceso: un cambio llega con el próximo deploy. Markdown permitido: `##`, `###`, párrafos, listas, `**negrita**`,
`*cursiva*`, `[texto](/ruta)` (sólo rutas internas).

Mínimo de palabras: en-cuotas 400, nuevas/usadas 300, cruces 200.
