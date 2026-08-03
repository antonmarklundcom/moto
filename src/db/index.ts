import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida. Copiá .env.example a .env y completala.");
}

// mysql2 no soporta la clave `uri` en createPool con un objeto de opciones
// (sólo en createConnection), así que la cadena se parsea a mano para poder
// combinarla con connectionLimit y timezone.
const url = new URL(process.env.DATABASE_URL);

// Pool con connectionLimit: 8 — Hostinger limita conexiones concurrentes por
// usuario (DATABASE_SCHEMA.md §4.6). timezone: "Z" guarda todo en UTC; la
// presentación convierte a America/Asuncion.
const pool = mysql.createPool({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  connectionLimit: 8,
  timezone: "Z",
});

export const db = drizzle(pool, { schema, mode: "default" });
