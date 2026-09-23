import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { parsePublicRef } from "@/lib/slug";

/** `?aviso=<ref>` desde la ficha: el título de una publicación publicada, para precargar "moto de interés". */
export async function listingInterest(ref: string | undefined): Promise<{ ref: string; title: string } | null> {
  const parsed = ref ? parsePublicRef(ref) : null;
  if (!parsed) return null;
  const [row] = await db
    .select({ title: listings.title })
    .from(listings)
    .where(and(eq(listings.publicRef, parsed), eq(listings.status, "published"), isNull(listings.deletedAt)))
    .limit(1);
  return row ? { ref: parsed.toLowerCase(), title: row.title } : null;
}
