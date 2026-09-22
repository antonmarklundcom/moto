# A2 — EXPLAIN de las consultas de listado (moto_dev, 10.000 filas)

Generado con `npm run fixtures && npx tsx tests/perf/scale-listings.ts 10000 && npx tsx --conditions=react-server tests/perf/explain-listings.ts` (MySQL 8, 2026-09-22).
Las consultas salen de los mismos constructores que usa la app (`countQuery`, `pageIdsQuery`, `groupCountQuery`).

## Escenario A — distribución de las fixtures (75 % de las filas vivas)

```
listings: 10000 filas, 7550 published sin borrar

### 1a /motos — conteo
  listings type=ALL key=— rows=9833 extra=Using where
  ⚠ escaneo completo de listings · mediana 12.2 ms (7 corridas)

### 1b /motos — página 1 (recientes)
  listings type=ALL key=— rows=9833 extra=Using where; Using filesort
  ⚠ escaneo completo de listings · mediana 12.5 ms (7 corridas)

### 2a /motos/honda — conteo (umbral)
  listings type=ref key=listings_brand_model_status_idx rows=2250 extra=Using index condition; Using where
  ok: sin escaneo completo de listings · mediana 5.0 ms (7 corridas)

### 2b /motos/honda — página 1
  listings type=ref key=listings_brand_model_status_idx rows=2250 extra=Using index condition; Using where; Using filesort
  ok: sin escaneo completo de listings · mediana 4.7 ms (7 corridas)

### 3a /motos/ciudad/asuncion — conteo
  listings type=ALL key=— rows=9833 extra=Using where
  ⚠ escaneo completo de listings · mediana 9.8 ms (7 corridas)

### 3b /motos/ciudad/asuncion — página 1
  listings type=ALL key=— rows=9833 extra=Using where; Using filesort
  ⚠ escaneo completo de listings · mediana 10.7 ms (7 corridas)

### 4a /motos/honda/ciudad/asuncion — conteo (umbral)
  listings type=ref key=listings_brand_model_status_idx rows=2250 extra=Using index condition; Using where
  ok: sin escaneo completo de listings · mediana 4.5 ms (7 corridas)

### 4b sitemap — vivas por marca × ciudad
  listings type=ALL key=— rows=9833 extra=Using where; Using temporary
  ⚠ escaneo completo de listings · mediana 14.2 ms (7 corridas)

### 5a /motos/en-cuotas?cuota_max=700000&precio_max=15000000&orden=precio_asc — conteo
  listings type=ALL key=— rows=9833 extra=Using where
  ⚠ escaneo completo de listings · mediana 11.8 ms (7 corridas)

### 5b ídem — página 1
  listings type=ALL key=— rows=9833 extra=Using where; Using filesort
  ⚠ escaneo completo de listings · mediana 12.5 ms (7 corridas)

### extra /motos?q=honda cg — FULLTEXT + LIKE
  listings type=fulltext key=listings_title_description_fulltext rows=1 extra=Using where; Ft_hints: no_ranking; Using filesort
  models type=eq_ref key=PRIMARY rows=1 extra=Using where
  ok: sin escaneo completo de listings · mediana 14.1 ms (7 corridas)

```

Con 3 de cada 4 filas vivas, un recorrido completo es el plan correcto: ningún índice cubre `deleted_at`/`sold_at` y leer por índice + ir a la fila cuesta más. Mediana ≤ 15 ms.

## Escenario B — estado estable (90 % de las publicaciones [DEV] vencidas, 688 vivas)

```
listings: 10000 filas, 688 published sin borrar

### 1a /motos — conteo
  listings type=range key=listings_status_published_idx rows=1388 extra=Using index condition; Using where
  ok: sin escaneo completo de listings · mediana 3.6 ms (7 corridas)

### 1b /motos — página 1 (recientes)
  listings type=range key=listings_status_published_idx rows=1388 extra=Using index condition; Using where; Using filesort
  ok: sin escaneo completo de listings · mediana 3.8 ms (7 corridas)

### 2a /motos/honda — conteo (umbral)
  listings type=ref key=listings_brand_model_status_idx rows=2250 extra=Using index condition; Using where
  ok: sin escaneo completo de listings · mediana 1.7 ms (7 corridas)

### 2b /motos/honda — página 1
  listings type=ref key=listings_brand_model_status_idx rows=2250 extra=Using index condition; Using where; Using filesort
  ok: sin escaneo completo de listings · mediana 2.0 ms (7 corridas)

### 3a /motos/ciudad/asuncion — conteo
  listings type=range key=listings_city_status_idx rows=642 extra=Using index condition; Using where
  ok: sin escaneo completo de listings · mediana 2.1 ms (7 corridas)

### 3b /motos/ciudad/asuncion — página 1
  listings type=range key=listings_city_status_idx rows=642 extra=Using index condition; Using where; Using filesort
  ok: sin escaneo completo de listings · mediana 2.2 ms (7 corridas)

### 4a /motos/honda/ciudad/asuncion — conteo (umbral)
  listings type=range key=listings_city_status_idx rows=642 extra=Using index condition; Using where
  ok: sin escaneo completo de listings · mediana 2.0 ms (7 corridas)

### 4b sitemap — vivas por marca × ciudad
  listings type=range key=listings_status_published_idx rows=1388 extra=Using index condition; Using where; Using temporary
  ok: sin escaneo completo de listings · mediana 4.1 ms (7 corridas)

### 5a /motos/en-cuotas?cuota_max=700000&precio_max=15000000&orden=precio_asc — conteo
  listings type=range key=listings_status_price_idx rows=612 extra=Using index condition; Using where
  ok: sin escaneo completo de listings · mediana 2.0 ms (7 corridas)

### 5b ídem — página 1
  listings type=range key=listings_status_price_idx rows=612 extra=Using index condition; Using where; Using filesort
  ok: sin escaneo completo de listings · mediana 2.2 ms (7 corridas)

### extra /motos?q=honda cg — FULLTEXT + LIKE
  listings type=fulltext key=listings_title_description_fulltext rows=1 extra=Using where; Ft_hints: no_ranking; Using filesort
  models type=eq_ref key=PRIMARY rows=1 extra=Using where
  ok: sin escaneo completo de listings · mediana 9.7 ms (7 corridas)

```

Con el predicado selectivo, las 11 consultas usan índice (ninguna `type=ALL` sobre `listings`). Mediana ≤ 10 ms.
