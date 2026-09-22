# Phase A3 — Media pipeline. OPUS session. Lane 1 (after A2).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (A3), §13, `docs/log/A0.md`, `docs/log/A1.md`,
`DATABASE_SCHEMA.md` §2.7, §2.15, `PRODUCT_SPEC.md` §2.2, `SEO_ARCHITECTURE.md` §10, `TEST_PLAN.md` §9,
`TRUST_AND_SAFETY.md` (photo rules only). Execute under the autonomy protocol `BUILD_PLAN.md` §4.

Owns: `src/lib/images/**`, `src/app/api/uploads/**`, `src/app/media/**`, `src/lib/image-loader.ts`,
`src/lib/cron/jobs/purge-uploads.ts` (+ its registration line in A1's job registry), `next.config.ts` (images
loader only), `package.json` (deps), tests, `docs/log/A3.md`.

Branch `phase/A3` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Skills: load `nextjs-deploy-hostinger` before choosing how `sharp` is installed (G-22 `[VERIFICAR]`).

Do:
1. Upload validation (T-108): sniff the content type from bytes (never the extension or the header), reject
   SVG and anything not JPEG/PNG/WebP/HEIC-if-sharp-supports-it, size limit, strip EXIF (GPS!), re-encode.
2. Variants with `sharp` at upload: 320/640/1024/1600 WebP, content-hashed immutable names, SHA-256 of the
   original in `content_hash`, width/height stored. All writes through `getStorage()` (ADR-16), never `fs`.
3. `POST /api/uploads` → `pending_uploads` keyed by `draft_token_hash` (the draft token lives in the seller's
   browser); per-IP rate limit via A1's helper. `claimUploads(draftToken, listingId)` moves rows into
   `listing_images` in one transaction and sets `claimed_listing_id`.
4. `GET /media/[...path]`: streams from storage, `Cache-Control: public, max-age=31536000, immutable`, correct
   type, path traversal rejected, 404 otherwise. `LocalStorage.url()` already returns `/media/...` (A0, F-9).
5. Custom `next/image` loader picking the nearest variant; catalog photos flagged (`is_catalog_photo`).
6. `purge-uploads` job: unclaimed rows + files older than 7 days, through `job_runs`.
7. Dev fixtures use PNG placeholders without variants (`docs/log/A0.md`): make the loader fall back to the
   original when no variant exists, or log how fixtures should be regenerated. Don't edit `scripts/`.

Exit: `TEST_PLAN.md` §9 upload items pass (renamed executable rejected, SVG rejected, EXIF stripped); a 5-image
listing page stays under the `SEO_ARCHITECTURE.md` §10 weight budget (measure, log the number); verify green;
PR `A3: media pipeline` merged per `prompts/_handoff.md`. Log "Codex review due (owner, §8)".

## After this phase
Follow `prompts/_handoff.md`. Next: `prompts/opus-A4-leads.md`, model Opus (`claude-opus-5-5`).
