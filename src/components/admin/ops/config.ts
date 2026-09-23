import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dealers } from "@/db/schema";
import { assertRole, type SessionUser } from "@/lib/auth/roles";
import { siteIndexingMode } from "@/lib/env";
import { countLiveListings } from "@/lib/listings/query";
import type { ConfigSnapshot } from "./config-view";

const set = (name: string) => Boolean(process.env[name]?.trim());

/** Foto de la configuración: sólo si cada secreto está cargado, nunca su valor. */
export async function configSnapshot(user: SessionUser | null): Promise<ConfigSnapshot> {
  assertRole(user, ["admin"]);
  const [live, [d]] = await Promise.all([
    countLiveListings({}),
    db.select({ n: count() }).from(dealers).where(and(eq(dealers.status, "active"), isNull(dealers.deletedAt))),
  ]);
  return {
    mode: siteIndexingMode(),
    rawSiteNoindex: process.env.SITE_NOINDEX ?? null,
    liveListings: live,
    activeDealers: Number(d?.n ?? 0),
    whatsappSiteNumber: process.env.WHATSAPP_SITE_NUMBER?.trim() || null,
    crmUrlSet: set("VENDERCRM_URL"),
    crmKeySet: set("VENDERCRM_API_KEY"),
    cronSecretSet: set("CRON_SECRET"),
    sessionSecretSet: set("SESSION_SECRET"),
    ipSaltSet: set("IP_HASH_SALT"),
  };
}
