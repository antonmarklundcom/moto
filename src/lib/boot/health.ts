// Diagnóstico de la instalación para el propietario (GET /api/health). Público
// y sin secretos: sólo "ok"/códigos de error y si cada variable está cargada,
// nunca valores ni mensajes de error (que pueden traer usuario o host).

/** Qué hacer ante cada código de error de la base, en palabras del propietario. */
export function dbHint(code: string): string {
  switch (code) {
    case "ER_ACCESS_DENIED_ERROR":
      return "Usuario o clave de DATABASE_URL incorrectos. Copiá la clave de hPanel → Bases de datos → MySQL, actualizá DATABASE_URL y volvé a desplegar (reiniciar no alcanza).";
    case "ER_DBACCESS_DENIED_ERROR":
      return "El usuario de DATABASE_URL no tiene permiso sobre esa base. En hPanel → Bases de datos, asociá el usuario a la base.";
    case "ER_BAD_DB_ERROR":
      return "La base de DATABASE_URL no existe. Revisá el nombre completo, con el prefijo (u123456789_…).";
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "ETIMEDOUT":
    case "EHOSTUNREACH":
    case "TIMEOUT":
      return "No se llega al servidor MySQL. En Hostinger el host de DATABASE_URL es localhost, puerto 3306 (si ya es localhost, probá 127.0.0.1). Después, volvé a desplegar.";
    case "ERR_INVALID_URL":
      return "DATABASE_URL está mal escrita. Formato: mysql://USUARIO:CLAVE@localhost:3306/BASE. En «Value» va sólo eso, sin «DATABASE_URL=».";
    case "ER_NO_SUCH_TABLE":
      return "Faltan las tablas: las migraciones no corrieron. Mirá el paso «migraciones» más abajo.";
    case "MISSING":
      return "Falta DATABASE_URL en las variables de entorno de hPanel.";
    default:
      return "Error de base de datos. Mirá los logs de la app (líneas que empiezan con «boot:»).";
  }
}

type Env = Record<string, string | undefined>;

/** Variables que la app necesita: sólo si están y tienen forma válida. */
export function envReport(env: Env): Record<string, boolean> {
  const long = (k: string, min: number) => (env[k]?.trim().length ?? 0) >= min;
  let dbUrl = false;
  try {
    dbUrl = new URL(env.DATABASE_URL ?? "").protocol === "mysql:";
  } catch {}
  let siteUrl = false;
  try {
    siteUrl = /^https?:$/.test(new URL(env.SITE_URL ?? "").protocol);
  } catch {}
  return {
    DATABASE_URL: dbUrl,
    SITE_URL: siteUrl,
    SESSION_SECRET: long("SESSION_SECRET", 32),
    IP_HASH_SALT: long("IP_HASH_SALT", 16),
    CRON_SECRET: long("CRON_SECRET", 16),
    WHATSAPP_SITE_NUMBER: /^\+595\d{8,9}$/.test(env.WHATSAPP_SITE_NUMBER?.trim() ?? ""),
    VENDERCRM: Boolean(env.VENDERCRM_URL?.trim() && env.VENDERCRM_API_KEY?.trim()),
  };
}
