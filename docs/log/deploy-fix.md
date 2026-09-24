# Deploy fix: el sitio en Hostinger muestra "Algo salió mal"

## Síntoma
moto.com.py responde con la página de error de ruta ("Algo salió mal", código 370252405). Es la que se ve cuando una consulta a la base falla en una página del servidor. Desde la sesión no se puede leer el sitio ni los logs de hPanel (egress bloqueado).

## Causas probables y qué se hizo
1. **Las migraciones se leían de `./drizzle` en disco** (`process.cwd()`). El preset de Next.js de Hostinger despliega la salida del build y el `cwd` puede ser otro, así que la carpeta puede no estar. Entonces el arranque registra `boot: migraciones falló`, no se crea ninguna tabla y toda página con base da error.
   → Las migraciones van dentro del bundle: `scripts/embed-files.mjs` (prebuild, Node puro) genera `src/generated/embedded.ts` y `src/db/migrate-embedded.ts` las aplica con el mismo migrador y la misma tabla `__drizzle_migrations`. Las bases ya migradas no cambian.
   → Lo mismo para `content/seo` y `content/guias`: se lee el disco y, si no está, la copia embebida.
2. **Credenciales de `DATABASE_URL`** (clave vieja, nombre de base mal escrito). No se puede verificar desde acá.
   → `GET /api/health` (público, sin secretos): estado de la base con código y pista, los pasos del arranque y qué variables están cargadas. `/api/` ya está en `Disallow` de robots.txt y responde `X-Robots-Tag: noindex`.
3. **La base no está lista al arrancar** → antes el setup no se reintentaba hasta el próximo deploy. Ahora se reintenta solo (30 s, 1 min, 2 min… techo 10 min).

## Verificado
- `next start` desde una copia **sin** `drizzle/` ni `content/`: migraciones embebidas OK, `/`, `/motos`, `/guias`, `/como-funciona`, `/motos/en-cuotas`, `/admin/login` → 200; `/api/health` → `ok: true`.
- Con una clave de base equivocada: el inicio da 500 con digest (el síntoma de producción), `/api/health` → 503 con `ER_ACCESS_DENIED_ERROR` y la pista, el arranque agenda un reintento a los 30 s.
- Unitarias: el archivo generado está al día con `drizzle/` y `content/`, y las migraciones embebidas son idénticas a `readMigrationFiles()` (sql, hash, fecha). Integración: `migrateEmbedded` es idempotente sobre la base de pruebas.

## Sin verificar
- El sitio real. Después del deploy, abrí `https://moto.com.py/api/health` (DEPLOY.md §6).
- No se pudo repetir el arranque contra una base **vacía** en esta sesión (crear bases locales estaba bloqueado). Las migraciones embebidas son byte a byte las mismas que ya se probaron sobre base vacía en launch-prep.
