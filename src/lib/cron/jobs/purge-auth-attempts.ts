// Purga de `auth_attempts` de más de 30 días (DATABASE_SCHEMA.md §2.16).
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { authAttempts } from "@/db/schema";
import type { JobFn } from "../runner";

export const AUTH_ATTEMPTS_RETENTION_DAYS = 30;

export const purgeAuthAttempts: JobFn = async ({ now }) => {
  const cutoff = new Date(now.getTime() - AUTH_ATTEMPTS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const [res] = await db.delete(authAttempts).where(lt(authAttempts.createdAt, cutoff));
  return { deleted: res.affectedRows, cutoff: cutoff.toISOString() };
};
