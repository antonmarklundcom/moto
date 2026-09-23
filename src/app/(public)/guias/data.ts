// Guías publicadas (posts.status = 'published'). Nada en borrador o revisión
// sale al sitio público.
import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { posts } from "@/db/schema";

const PUBLISHED = and(eq(posts.status, "published"), isNotNull(posts.publishedAt));

export async function publishedGuides() {
  return db
    .select({ slug: posts.slug, title: posts.title, excerpt: posts.excerpt, publishedAt: posts.publishedAt, updatedAt: posts.updatedAt })
    .from(posts)
    .where(PUBLISHED)
    .orderBy(desc(posts.publishedAt));
}

/** Slugs de las guías publicadas (para no enlazar borradores). */
export const publishedGuideSlugs = cache(async (): Promise<Set<string>> => {
  const rows = await db.select({ slug: posts.slug }).from(posts).where(PUBLISHED);
  return new Set(rows.map((r) => r.slug));
});

export const publishedGuide = cache(async (slug: string) => {
  const [row] = await db.select().from(posts).where(and(PUBLISHED, eq(posts.slug, slug))).limit(1);
  return row ?? null;
});

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "3 de agosto de 2026", en hora de Paraguay (UTC−3). */
export function longDatePy(date: Date): string {
  const d = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
