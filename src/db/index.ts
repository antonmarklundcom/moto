import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

type CoreConnection = {
  query(sql: string, callback: (error: Error | null) => void): void;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida. Copiá .env.example a .env y completala.");
}

/**
 * Convierte DATABASE_URL en opciones de pool. mysql2 no acepta `uri` junto con
 * opciones de pool, así que se parsea a mano. Se respetan `?ssl=` y
 * `?charset=` si vienen en la URL (F-2); el resto de parámetros se ignora.
 */
export function poolOptionsFromUrl(databaseUrl: string): mysql.PoolOptions {
  const url = new URL(databaseUrl);
  const options: mysql.PoolOptions = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    // Hostinger limita conexiones concurrentes por usuario (DATABASE_SCHEMA.md §4.6).
    connectionLimit: 8,
    // Conversión de Date en mysql2: todo en UTC. La presentación convierte a
    // America/Asuncion.
    timezone: "Z",
  };

  const charset = url.searchParams.get("charset");
  if (charset) {
    options.charset = charset;
  }

  const ssl = url.searchParams.get("ssl");
  if (ssl && ssl !== "false" && ssl !== "0") {
    // `?ssl=true` usa la verificación por defecto de Node; `?ssl={"rejectUnauthorized":false}`
    // pasa el objeto tal cual.
    options.ssl = ssl.startsWith("{") ? JSON.parse(ssl) : {};
  }

  return options;
}

function createPool(): mysql.Pool {
  const pool = mysql.createPool(poolOptionsFromUrl(process.env.DATABASE_URL!));
  // F-1: `timezone: "Z"` sólo afecta cómo mysql2 convierte los Date de JS.
  // `DEFAULT CURRENT_TIMESTAMP` usa el time_zone de la sesión de MySQL, que por
  // defecto es el del servidor. Se fija UTC en cada conexión nueva para que las
  // fechas escritas por MySQL y por la app coincidan. mysql2 encola los
  // comandos por conexión, así que esto corre antes de cualquier consulta.
  // El evento entrega la conexión "core" (API de callbacks), aunque los tipos
  // de mysql2/promise digan otra cosa; por eso el cast.
  pool.on("connection", (connection) => {
    (connection as unknown as CoreConnection).query("SET time_zone = '+00:00'", (error: Error | null) => {
      if (error) {
        console.error(JSON.stringify({ level: "error", msg: "db: SET time_zone falló", error: error.message }));
      }
    });
  });
  return pool;
}

// F-2: un solo pool por proceso. En desarrollo el hot reload vuelve a evaluar
// este módulo; sin el singleton en globalThis cada recarga abre 8 conexiones
// más y agota el límite de Hostinger.
const globalForDb = globalThis as unknown as {
  motoPool?: mysql.Pool;
  motoDb?: MySql2Database<typeof schema>;
};

const pool = globalForDb.motoPool ?? createPool();
export const db = globalForDb.motoDb ?? drizzle(pool, { schema, mode: "default" });

globalForDb.motoPool = pool;
globalForDb.motoDb = db;

/** Cierra el pool. Para scripts y pruebas; la app nunca lo llama. */
export async function closeDb(): Promise<void> {
  if (globalForDb.motoPool) {
    const current = globalForDb.motoPool;
    globalForDb.motoPool = undefined;
    globalForDb.motoDb = undefined;
    await current.end();
  }
}
