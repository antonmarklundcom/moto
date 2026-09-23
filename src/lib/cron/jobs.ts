// Registro de jobs de POST /api/cron/[job] (ADR-19). Un job nuevo (retry-leads
// en A4, fin de destacados…) se agrega acá y en el cron de hPanel (docs/log).
import type { JobFn } from "./runner";
import { expireFeatured } from "./jobs/expire-featured";
import { expireListings } from "./jobs/expire-listings";
import { purgeAuthAttempts } from "./jobs/purge-auth-attempts";
import { purgeRemovedPhotos } from "./jobs/purge-removed-photos";
import { purgeUploads } from "./jobs/purge-uploads";
import { retryLeads } from "./jobs/retry-leads";

export const CRON_JOBS: Readonly<Record<string, JobFn>> = {
  "expire-featured": expireFeatured,
  "expire-listings": expireListings,
  "purge-auth-attempts": purgeAuthAttempts,
  "purge-removed-photos": purgeRemovedPhotos,
  "purge-uploads": purgeUploads,
  "retry-leads": retryLeads,
};

export function getCronJob(name: string): JobFn | null {
  return Object.hasOwn(CRON_JOBS, name) ? CRON_JOBS[name] : null;
}
