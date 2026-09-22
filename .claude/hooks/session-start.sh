#!/bin/bash
# SessionStart hook (BUILD_PLAN.md G-20): deja MySQL local, .env, dependencias,
# migraciones y catálogo listos para que cualquier fase pueda correr
# `npm run verify` (incluidas las pruebas de integración) sin reinventar nada.
#
# Idempotente y silencioso: todo va a $LOG y sólo se imprime una línea de
# resumen. Corre sólo en sesiones remotas de Claude Code, salvo que se fuerce
# con MOTO_DEV_SETUP=1 en una máquina Linux con apt.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${MOTO_DEV_SETUP:-}" != "1" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$PROJECT_DIR"

LOG="${TMPDIR:-/tmp}/moto-session-start.log"
: > "$LOG"
START=$(date +%s)

fail() {
  echo "session-start: FALLÓ en '$1'. Detalle en $LOG" >&2
  tail -n 20 "$LOG" >&2 || true
  exit 1
}

DB_USER="moto"
DB_PASS="moto_local_dev"
DB_HOST="127.0.0.1"
DEV_URL="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:3306/moto_dev"
TEST_URL="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:3306/moto_test"

# 1. MySQL instalado. apt-get update puede fallar en PPAs de terceros que el
#    proxy bloquea; eso no impide instalar desde los repos de Ubuntu.
if ! command -v mysqld >/dev/null 2>&1; then
  apt-get update -q >>"$LOG" 2>&1 || true
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q mysql-server >>"$LOG" 2>&1 \
    || fail "apt-get install mysql-server"
fi

# 2. Configuración local. La zona horaria del servidor es a propósito distinta
#    de UTC (-03:00, como Paraguay) para que las pruebas de integración
#    detecten cualquier conexión que no fije time_zone='+00:00' (F-1).
CNF=/etc/mysql/mysql.conf.d/zz-moto.cnf
CNF_CONTENT="[mysqld]
default-time-zone='-03:00'
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
innodb_buffer_pool_size=128M
performance_schema=OFF"
RESTART=0
if [ ! -f "$CNF" ] || [ "$(cat "$CNF")" != "$CNF_CONTENT" ]; then
  printf '%s\n' "$CNF_CONTENT" > "$CNF"
  RESTART=1
fi

# 3. Servidor arriba (el contenedor no tiene systemd; el script de init sí anda).
if [ "$RESTART" = "1" ] && mysqladmin ping >/dev/null 2>&1; then
  service mysql restart >>"$LOG" 2>&1 || fail "service mysql restart"
elif ! mysqladmin ping >/dev/null 2>&1; then
  service mysql start >>"$LOG" 2>&1 || fail "service mysql start"
fi
for _ in $(seq 1 30); do
  mysqladmin ping >/dev/null 2>&1 && break
  sleep 1
done
mysqladmin ping >/dev/null 2>&1 || fail "mysqladmin ping"

# 4. Bases y usuario local (root entra por socket, sin clave).
mysql >>"$LOG" 2>&1 <<SQL || fail "crear bases y usuario"
CREATE DATABASE IF NOT EXISTS moto_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS moto_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`moto\\_%\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`moto\\_%\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# 5. .env local, sólo si falta. Valores de desarrollo; nunca se versiona.
if [ ! -f .env ]; then
  UPLOADS_DIR="${HOME}/moto-uploads-dev"
  mkdir -p "$UPLOADS_DIR"
  RAND() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  sed \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=${DEV_URL}|" \
    -e "s|^TEST_DATABASE_URL=.*|TEST_DATABASE_URL=${TEST_URL}|" \
    -e "s|^SITE_URL=.*|SITE_URL=http://localhost:3000|" \
    -e "s|^STORAGE_LOCAL_PATH=.*|STORAGE_LOCAL_PATH=${UPLOADS_DIR}|" \
    -e "s|^IP_HASH_SALT=.*|IP_HASH_SALT=$(RAND)|" \
    -e "s|^SESSION_SECRET=.*|SESSION_SECRET=$(RAND)|" \
    -e "s|^CRON_SECRET=.*|CRON_SECRET=$(RAND)|" \
    -e "s|^ALLOW_DEV_FIXTURES=.*|ALLOW_DEV_FIXTURES=1|" \
    .env.example > .env
fi

# 6. Dependencias: npm ci sólo si cambió el lockfile desde la última vez.
LOCK_HASH=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -f node_modules/.moto-lock-hash ] || [ "$(cat node_modules/.moto-lock-hash)" != "$LOCK_HASH" ]; then
  npm ci --no-audit --no-fund >>"$LOG" 2>&1 || fail "npm ci"
  echo "$LOCK_HASH" > node_modules/.moto-lock-hash
fi

# 7. Migraciones + catálogo en las dos bases (ambos son idempotentes).
for URL in "$DEV_URL" "$TEST_URL"; do
  DATABASE_URL="$URL" npx tsx scripts/migrate.ts >>"$LOG" 2>&1 || fail "migrate ${URL##*/}"
  DATABASE_URL="$URL" npx tsx scripts/seed-catalog.ts >>"$LOG" 2>&1 || fail "seed:catalog ${URL##*/}"
done

# 7b. moto_test.listings se reconstruye (está vacía: tarda milisegundos). Tras
# un apagado sucio de MySQL (el contenedor se recicla), el índice FULLTEXT de
# InnoDB puede dejar de ver filas nuevas y las pruebas de texto libre fallan
# (visto en A2). Reconstruir la tabla regenera el índice.
mysql moto_test -e "ALTER TABLE listings ENGINE=InnoDB" >>"$LOG" 2>&1 || fail "rebuild moto_test.listings"

# 8. Variables para la sesión (las pruebas de integración usan TEST_DATABASE_URL).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  grep -q TEST_DATABASE_URL "$CLAUDE_ENV_FILE" 2>/dev/null \
    || echo "export TEST_DATABASE_URL=${TEST_URL}" >> "$CLAUDE_ENV_FILE"
fi

echo "session-start: MySQL + moto_dev/moto_test migradas y con catálogo ($(( $(date +%s) - START ))s). Log: $LOG"
