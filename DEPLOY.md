# Notas de despliegue — Hostinger (T-005)

Slot de Node.js gestionado de Hostinger (ADR-04). Esta nota documenta los
pasos; **no sustituye el acceso real al panel de Hostinger**, que esta sesión
no tiene. La verificación de "sitio desplegado" de T-005 quedó pendiente por
esa razón — ver la sección "Qué no se verificó" al final.

## 1. Antes del primer despliegue

1. Crear la base de datos MySQL en el panel de Hostinger (Bases de datos →
   MySQL) y anotar host, usuario, clave y nombre. Compilar `DATABASE_URL` con
   esos datos (ver `.env.example`).
2. Habilitar Remote MySQL si las migraciones se corren desde fuera del
   servidor; si no, correrlas por SSH en el propio slot.
3. Crear el directorio de subida de imágenes fuera del control de versiones,
   con permisos de escritura para el usuario del slot, y apuntarle
   `STORAGE_LOCAL_PATH` (ADR-16). Por ejemplo: `/home/<usuario>/uploads`.
4. Generar `IP_HASH_SALT` y `SESSION_SECRET` una única vez (cadenas
   aleatorias largas) y guardarlas sólo en el panel de variables de entorno
   del slot — nunca en el repositorio.
5. Confirmar `SITE_NOINDEX=true` en las variables de entorno del slot. Se
   apaga recién cuando se supere el umbral de `DATA_SEEDING.md` §3 (150
   publicaciones vivas de ≥ 5 comercios), y es una decisión del propietario,
   no de una sesión de implementación (`CLAUDE.md` §3.4).

## 2. Variables de entorno en el panel de Hostinger

Cargar cada clave de `.env.example` en el panel de "Node.js App" → "Variables
de entorno" del slot. El `.env` del repositorio nunca se sube (`.gitignore`).

## 3. Build y arranque

Hostinger detecta `package.json` y corre:

```
npm install
npm run build
npm run start
```

`npm run start` sirve con `next start` en el puerto que exponga el slot
(Hostinger lo inyecta vía `PORT`; Next.js lo respeta automáticamente).

## 4. Migraciones

Correr `npx drizzle-kit migrate` con el `DATABASE_URL` de producción **antes**
de apuntar el dominio al slot nuevo, para que la primera visita ya encuentre
el esquema aplicado. Re-correr en cada despliegue que agregue una migración
nueva (`/drizzle`).

## 5. Verificación post-despliegue

```
curl -s https://<dominio> | grep -o 'name="robots"[^>]*'
```

Debe imprimir `name="robots" content="noindex"` mientras `SITE_NOINDEX=true`.
Si no imprime nada, la variable no llegó al proceso del slot (revisar el
panel, no el `.env` local).

## Qué no se verificó en esta tarea

Esta sesión no tiene credenciales de Hostinger ni acceso al dominio de
producción. Lo que sí se verificó, contra un build de producción local
(`npm run build && npm run start`) con MySQL local:

- El HTML servido contiene `<meta name="robots" content="noindex">` con
  `SITE_NOINDEX=true`.
- La página de inicio consulta la base real (cuenta de ciudades y marcas
  activas cargadas por el seed de T-003) y la muestra — no hay datos
  fabricados.

**Pendiente, y debe verificarlo quien tenga acceso al panel de Hostinger:**
el despliegue real al slot, `curl` contra el dominio de producción, y que las
variables de entorno del panel coincidan con `.env.example`.
