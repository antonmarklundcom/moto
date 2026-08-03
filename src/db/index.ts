import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// Pool con connectionLimit: 8 — Hostinger limita conexiones concurrentes por
// usuario (DATABASE_SCHEMA.md §4.6). timezone: "Z" guarda todo en UTC; la
// presentación convierte a America/Asuncion.
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 8,
  timezone: "Z",
});

export const db = drizzle(pool, { schema, mode: "default" });
