# BUILD_PLAN.md — moto.com.py execution plan

**Status:** approved 2026-09-22. The owner merged PR #9 and said "build all these", which is read as **yes to every default in §1.2** (Q1–Q10). Next phase: **A0** (`prompts/opus-A0-foundation.md`).
**Date:** 2026-09-22
**What this file is:** the execution layer on top of the 18 spec documents. It does **not** replace `PLAN.md`, `DECISIONS.md` or any spec; it (1) audits them for gaps, (2) proposes the decisions that close those gaps, (3) turns the remaining work into phases that autonomous sessions can run in parallel, and (4) lists everything only the owner can do.

> Language note: this plan is in English because the owner reads it. Every visible string on the site stays in Paraguayan Spanish per `CLAUDE.md` §3.2. The file is named `BUILD_PLAN.md` (not `plan.md`) so it cannot collide with `PLAN.md` on a case-insensitive Windows checkout.

---

## 0. Where the project stands

| Area | State |
|---|---|
| Strategy, ADR-01…16, 18 spec docs | Done, high quality. Business thesis: dealer inventory + financing leads, not C2C (ADR-01). |
| Phase 0 code (T-001…T-005) | Merged: Next.js 15 scaffold, full schema + migration `0000`, catalog seeds, utils with tests, storage interface. |
| Phase 0 exit criterion "deployed on Hostinger with `SITE_NOINDEX=true`" | **Not met.** `DEPLOY.md` says so explicitly: no session had hPanel access. Technically Phase 1 is blocked by `IMPLEMENTATION_PHASES.md` rule 5 until this is done (§6, H-1). |
| Assumptions S-1…S-8 in `DECISIONS.md` | **Never confirmed by the owner.** Several change the build (§1.2). |
| Catalog | 6 active brands, 21 models, 16 cities, 11 categories. Almost certainly far short of what dealers actually stock (G-16). |
| Dev environment | No MySQL in the cloud container, no hooks, no `verify` script. Every autonomous phase would re-solve this (G-20). |
| Phase 1 (T-101…T-122) | Not started. |

**The real critical path is not code.** With autonomous sessions, Phase 1 code is days of wall-clock time. Dealer agreements, the lawyer review, and the VenderCRM tenant are weeks. They have to start now, in parallel (§7).

---

## 1. Decisions

### 1.1 Already made: do not re-litigate

Everything in `DECISIONS.md` ADR-01…ADR-16 and `PLAN.md` §1–§6. Build sessions read them and never reopen them. New decisions become new ADRs (ADR-17+) appended to `DECISIONS.md` **after** the owner approves them here.

### 1.2 Questions for the owner (answer by number; defaults are my recommendation)

The eight assumptions S-1…S-8 were taken without you. Confirm or correct:

| # | Question | Default if you just say "yes" | What changes if the answer differs |
|---|---|---|---|
| Q1 | S-1: any existing dealer relationships? | None; start from zero | A dealer who'll say yes this month becomes the demo stock and changes the order of lane 2 (B8 first) |
| Q2 | S-2: any financiera/aseguradora contact? | None | If yes, the lawyer review (§7 S-B) moves earlier and becomes blocking sooner |
| Q3 | S-5: who moderates and answers financing leads daily? | You, ~30 min/day | If it's someone else, a `moderator` user and an ops runbook handover are needed at launch |
| Q4 | S-6: is the VenderCRM tenant + key for this site ready? | Not yet; handler logs until it is | Nothing blocks. A4 ships with a no-URL fallback, but T-109 can't close without the real round-trip |
| Q5 | S-8: Paraguayan RUC/entity to invoice from? | Yes | If no, monetization (Phase 3) waits on it; Phase 1 does not |
| Q6 | Approve the schema delta ADR-17 (§2.1: 4 columns on `listings`, 1 on `dealers`, 3 small tables)? | Approve | Rejecting any item means the feature it enables is cut or redesigned. A0 writes the whole delta once |
| Q7 | Approve the process ADRs ADR-18…ADR-24 (§2.2–§2.4)? | Approve | Each one is independent; reject by number |
| Q8 | Staging slot: use a 2nd Hostinger Node slot at `staging.moto.com.py` (basic auth, own DB)? | Yes | Without it, the first deploy of every risky change is production |
| Q9 | Organic social channels (FB page, Instagram, WhatsApp Channel) as a growth track (ADR-23)? | Yes, owner-run, zero budget | If no, growth relies on SEO + direct sales only, which is slow in a small market |
| Q10 | Cloudflare free plan in front of Hostinger (CDN for images, DDoS, cache)? | Measure first in C2, decide with data | It's an external service (escalation rule), so it needs your explicit OK |

### 1.3 Owner answers (2026-09-22)

All defaults accepted: S-1…S-8 as assumed; ADR-17 (schema delta) and ADR-18…ADR-24 approved; staging slot yes (deploy later, owner-run); organic social yes; Cloudflare measured in C2. The owner deploys to the Hostinger Node.js slot himself later (H-1), so **no phase blocks on deployment**. Phases verify against local MySQL.

---

## 2.0 Re-audit of PRs #1–#8 (done 2026-09-22; don't take earlier work as truth)

Code from T-001…T-005 was re-read line by line; unit tests pass (33/33). These findings are **fixed in A0**:

| # | Where | Finding | Fix in A0 |
|---|---|---|---|
| F-1 | `src/db/index.ts` | `timezone: "Z"` only affects mysql2's JS Date conversion. MySQL `DEFAULT CURRENT_TIMESTAMP` uses the **session** `time_zone`, i.e. the server's zone, so DB-written `created_at` and app-written dates would disagree. | `SET time_zone = '+00:00'` on every new pool connection. Integration test: an insert's `created_at` is within seconds of `new Date()` in UTC. |
| F-2 | `src/db/index.ts` | A new pool is created on every dev hot reload, which exhausts Hostinger's connection cap during local dev. The manual URL parsing drops query params. | `globalThis` singleton; keep the parsing but pass through `?ssl`/`charset` if present. |
| F-3 | `CLAUDE.md` §4, `INTEGRATIONS.md` §2.4 | `idempotency_key = sha256(phone \| hour)` is **UNIQUE** in `leads`. A person who sends a financing lead and then an insurance lead in the same hour **loses the second one**, both in our DB and in the CRM. | **ADR-25:** key = `sha256(phone_e164 + "\|" + type + "\|" + YYYY-MM-DD-HH)`. Still 64 chars, still stable across retries. Update `CLAUDE.md`, `INTEGRATIONS.md`, `TEST_PLAN.md` §2.3. |
| F-4 | `src/app/layout.tsx` | The site description says "comprá, vendé y **financiá tu moto**", which implies the site grants credit (`LEGAL_AND_COMPLIANCE.md` §3.1 forbids it). No `metadataBase`, so OG URLs come out relative. | Neutral copy (e.g. "Motos nuevas y usadas en Paraguay, con precios en guaraníes y cuotas informadas por cada comercio."); `metadataBase` from `SITE_URL`. |
| F-5 | `src/lib/format.ts` | `toLocaleString("es-PY")` depends on the server's ICU data. Spanish CLDR can skip grouping on 4-digit numbers (`5000`). Correct here, but not guaranteed on the Hostinger Node build. | A deterministic dot-grouping formatter, with no ICU dependency. The same tests pass. |
| F-6 | `src/lib/hash.ts` | Plain `sha256(value\|salt)`. For IP hashing the correct primitive is keyed HMAC. | `createHmac("sha256", salt)`. No stored hashes exist yet, so there's no migration cost. |
| F-7 | `src/lib/phone.ts` | Only mobiles (`9XXXXXXXX`) are accepted. Dealers often have landlines (`021 …`), and G-3's "solo llamadas" needs them. | `normalizePhone(raw, { allowLandline })`: mobiles only by default; landlines allowed for `contact_whatsapp=false` and dealer contact. `isWhatsAppCapable()` helper. Tests. |
| F-8 | `src/lib/slug.ts` | No reserved slugs (G-15). `slugifyUnique` takes a sync callback, but DB checks are async. The diacritics regex uses literal combining chars (fragile in editors). | Reserved list + `slugifyUniqueAsync`, `\u0300-\u036f` escape, `publicRef()` generator (8 chars, no ambiguous `0/O/1/I/L`, stored uppercase, lowercase in URLs). |
| F-9 | `src/lib/storage/local.ts` | `url()` returns `/uploads/…` but nothing serves it (G-22). Writes are not atomic. | `url()` → `/media/…` (A3 builds the route); write to tmp + rename. |
| F-10 | `src/db/seed-data/models.ts` | **Every Honda model is inactive**: hondamotos.com.py blocked the earlier research session. Honda is very likely the largest brand in the entry segment `[VERIFICAR]`. Category names "Naked" and "Cub" are unvalidated English terms. | R0 (research) re-verifies Honda and the whole catalog from sources. The vocabulary goes on the owner's dealer-call checklist. |
| F-11 | `drizzle/0000_*.sql` | FULLTEXT index hand-added (fine). InnoDB's default `innodb_ft_min_token_size=3` means queries like "cg" never match. | Documented for A2: short tokens fall back to `LIKE` on title/model. |
| F-12 | Global `SITE_NOINDEX` | Also blocks guides and static pages, which could start earning trust while inventory grows (thin programmatic pages are already gated by thresholds). | **ADR-26 (owner decides later):** `SITE_NOINDEX` accepts `true \| content \| false`. `content` = guides + static pages indexable, everything else noindex. Default stays `true`. A0 implements the three modes. |
| F-13 | Repo | No `error.tsx` for route-level errors, no `engines`, no `typecheck`/`verify`/`db:migrate` scripts, no hooks, no MySQL in cloud sessions. | A0 per §5.2. |

Docs (PRs #1–#3) were already audited in §2 below. Beyond that list, their strategy holds up: dealer-first, financing wedge, threshold-gated programmatic SEO, and no fabrication are the right calls for this market.

---

## 2. Gap audit: what the 18 documents miss

Found by reading every spec against every other spec and against the code. Grouped by what each gap costs if it ships unresolved.

### 2.1 Schema gaps: must be decided before A0 (schema is written once)

Proposed as a single **ADR-17: schema delta 0001**. `DATABASE_SCHEMA.md` §4 rule 2 still applies: additive only, nothing dropped.

| # | Gap | Evidence | Proposal |
|---|---|---|---|
| G-1 | **Anonymous sellers cannot manage their listing.** The state machine lets a `seller` mark sold, pause, renew, and edit. Sellers have no accounts (ADR-05), so none of that is reachable. Expired listings show "CTA a renovar" that goes nowhere; stale "sold" motos stay live and kill trust. | `DATABASE_SCHEMA.md` §3; `SEO_ARCHITECTURE.md` §4; ADR-05 | `listings.manage_token_hash CHAR(64) NULL` + index. On approval the moderator's pre-built WhatsApp message includes a private link `/mi-aviso/<token>` (token shown once, stored hashed). The link can mark sold, pause/resume, renew, and edit (photo/description edits → `pending_review`, per §3). Rotatable by admin. |
| G-2 | **Photos are uploaded before the listing exists.** `/publicar` step 1 is photos, but `listing_images.listing_id` is NOT NULL and a draft `listings` row can't be inserted without brand/city/phone (all NOT NULL). | `PRODUCT_SPEC.md` §2.2 vs `DATABASE_SCHEMA.md` §2.6–2.7 | New table `pending_uploads` (`id`, `draft_token_hash`, `storage_path`, `width`, `height`, `bytes`, `content_hash`, `claimed_listing_id NULL`, `created_at`). On submit, rows move to `listing_images`. A daily job deletes unclaimed rows and files older than 7 days. |
| G-3 | **"Solo llamadas" has no column.** The spec switches the CTA to "Llamar" when the seller has no WhatsApp. | `PRODUCT_SPEC.md` §2.1 | `listings.contact_whatsapp BOOLEAN NOT NULL DEFAULT true`. |
| G-4 | **Mandatory "estado de documentación" has no column.** Trust & Safety depends on it (fraud pattern 5, rejection code `documentacion`). | `TRUST_AND_SAFETY.md` §2 #5 | `listings.documentation_status ENUM('al_dia','transferencia_pendiente','no_declara') NULL` (NULL only for 0 km). Labels `[VALIDAR con un comercio]` before the form ships. |
| G-5 | **Dealer stock can't be re-imported idempotently.** Without a dealer-side reference, every re-import duplicates. | `DATA_SEEDING.md` §2 A/B | `listings.external_ref VARCHAR(100) NULL` + `UNIQUE(dealer_id, external_ref)`. |
| G-6 | **"Expiry configurable per dealer" has no column.** Also, dealer stock older than 30 days unconfirmed must come down. | `DATABASE_SCHEMA.md` §3 last line; `DATA_SEEDING.md` §4 | `dealers.listing_ttl_days SMALLINT UNSIGNED NULL` (NULL → 60). Default for newly onboarded dealers: 30. |
| G-7 | **Login lockout has no storage.** "5 failures per IP and per account" needs persistence across restarts; no Redis (ADR-04). | `ADMIN_SPEC.md` §1 | Table `auth_attempts` (`id`, `email_hash`, `ip_hash`, `succeeded`, `created_at`, index on both hashes + time). Purged at 30 days. |
| G-8 | **No cron mechanism or job audit.** Five jobs are specced (expire, retry leads, featured expiry, sitemap regen, purge), with nothing deciding how they run on Hostinger or proving that they ran. | `IMPLEMENTATION_PHASES.md` F1; `INTEGRATIONS.md` §2.8 | Table `job_runs` (`id`, `job`, `started_at`, `finished_at`, `status`, `detail_json`) that doubles as a lock (no overlapping runs) and as the admin health signal. Mechanism in ADR-19. |

Other listing-publish and IP rate limits need **no** new storage. They count rows already written (`listings.submitted_ip`, `reports.reporter_ip_hash`).

### 2.2 Product gaps: the thesis is not yet fully in the spec

| # | Gap | Proposal |
|---|---|---|
| G-9 | **The core wedge is never specced as a screen.** `PLAN.md` §1.2 says the product is "motos filtrables por entrega y cuota, **comparables entre comercios**". The spec only has filters. There is no view that compares the same model across dealers. | **ADR-20: financing comparison block** on every model page (`/motos/:brand/:model`) and on `/motos/en-cuotas`: one row per dealer offering that model, with contado, entrega, cuotas × monto, and a link to the listing. Every row reads "informado por el comercio". Rows come from real listings only; with fewer than 2 dealers the block turns into a single-offer view, never padding. No calculated cuotas (`LEGAL_AND_COMPLIANCE.md` §3.1). No schema change. |
| G-10 | **The home page searches by brand/city/price, but buyers think in cuota.** | Home hero = "¿Cuánto podés pagar por mes?" (cuota máxima + entrega máxima → `/motos?cuota_max=…`), with brand/city as the secondary search. The spec already allows this; it's an emphasis change in T-120. |
| G-11 | **Empty-state "avisador" contradicts the MVP.** `DATA_SEEDING.md` §6 promises an email/WhatsApp alert; `PRODUCT_SPEC.md` §7 says alerts are not built; double opt-in needs sending infrastructure that doesn't exist. | **ADR-21:** in the MVP the empty state offers "Escribinos qué moto buscás" → `/ir/wa/general` with the search pre-filled in the message. That is a buyer-demand signal the owner can route to dealers by hand, with zero sending infrastructure and zero consent risk. `search_alerts` stays Phase 3. |
| G-12 | **0 km semantics are undefined.** Dealers sell 0 km per model, not per unit. Catalog photos are shared across dealers, so `content_hash` duplicate detection will flag every 0 km as a duplicate. | Rule (no schema): a 0 km listing = one per dealer × model version. Duplicate detection ignores `is_catalog_photo` images. `year` is optional for new bikes. |
| G-13 | **Admin "SITE_NOINDEX switch" is impossible as written.** It's an env var, so the admin can't flip it at runtime, and there is no settings table. | **ADR-22:** the env var stays the single source of truth. The admin shows it read-only next to the live count, with the exact steps to change it in hPanel. The same goes for the other §11 config items. Legal texts live in reviewed content files, not in an admin textarea. No `site_settings` table. |
| G-14 | **Dealers get no proof of value during the free year.** The renewal pitch (`MONETIZATION.md` §3.2) needs data they saw along the way. | Admin dealer panel gets a "Copiar reporte para WhatsApp" button: last-30-days real views, WhatsApp clicks, and financing leads from their motos, formatted for WhatsApp. Owner sends it monthly by hand. No schema. |
| G-15 | **Slug collisions with route keywords.** `/motos/:brand` coexists with `/motos/tipo`, `/motos/ciudad`, `/motos/nuevas`, `/motos/usadas` and `/motos/en-cuotas`, and `/motos/:brand/:model` coexists with `/motos/:brand/ciudad/…`. A brand or model slugged `nuevas` or `ciudad` breaks routing. | Reserved-slug list enforced in `src/lib/slug.ts` and the catalog admin: `tipo, ciudad, nuevas, usadas, en-cuotas, page`. Test included. |
| G-16 | **Catalog coverage.** 6 active brands and 21 models. The entry segment in Paraguay very likely includes brands not in the seed. Every unmatched model becomes a `model_suggestions` row and blocks publication (`model_id` must be non-null). `[VERIFICAR: which brands and models the first 5 target dealers stock]` | Research phase R0 (§5) expands the catalog **from cited sources and from the target dealers' real stock**, before any bulk import. |
| G-17 | **No competitive analysis anywhere in the docs.** "Best in Paraguay" is undefined without knowing who's there. `[VERIFICAR: current Paraguayan moto listing sites (e.g. general classifieds like Clasipar, dealer and importer sites, Facebook Marketplace/groups): their features, whether they show cuotas, speed, indexation]` | R0 produces `docs/research/competitors.md`: facts with URLs and dates, no invented numbers. |

### 2.3 Operations and infrastructure gaps

| # | Gap | Proposal |
|---|---|---|
| G-18 | **Bulk import of dealer stock has no task.** `DATA_SEEDING.md` promises "Lo cargo yo. Mandame la planilla". Entering 150 listings with photos one at a time through CRUD forms is the thing that stalls the launch. | Phase B8: CSV template + admin upload with a **dry-run preview** (what will be created/updated/rejected and why), catalog mapping, a photo-folder/zip mapping by `external_ref`, idempotent by `(dealer_id, external_ref)`. Same validation as the moderator's checklist. Pattern proven in propia (`import:csv`). |
| G-19 | **Cron on a Hostinger Node slot is undecided.** | **ADR-19:** jobs are plain functions exposed as `POST /api/cron/<job>`, protected by `CRON_SECRET`, locked and logged via `job_runs`. Trigger: hPanel cron with `curl` `[VERIFICAR: whether the owner's Hostinger plan offers cron jobs for a Node.js slot]`. Fallback: an in-process scheduler started from `instrumentation.ts`, which is safe because `job_runs` prevents overlap. Either way the jobs are identical and testable. |
| G-20 | **Autonomous sessions can't run integration tests.** There's no MySQL in the cloud container, so every phase would reinvent the setup or skip the tests. | A0 adds a SessionStart hook (`.claude/hooks/session-start.sh`) that installs and starts MySQL, creates `moto_test`, and runs migrations + catalog seed. Plus `npm run verify` = typecheck + lint + unit + integration + build. |
| G-21 | **No test fixtures policy.** Pages can't be built or tested without listings, and ADR-12 forbids demo data in production. | `scripts/dev-fixtures.ts` generates clearly fake listings **and refuses to run** unless `NODE_ENV !== 'production'`, `ALLOW_DEV_FIXTURES=1`, and `DATABASE_URL` is not the production host. Unit test for the guard. Fixture titles are prefixed `[DEV]`. |
| G-22 | **Serving uploaded images is unspecified.** Files live outside `public/` (ADR-16), so `next/image` can't read them. Runtime optimization would also burn CPU on a shared slot. | Variants (e.g. 320/640/1024/1600 WebP) are pre-generated with `sharp` at upload, with content-hashed immutable filenames. A `/media/[...path]` route streams them with `Cache-Control: public, max-age=31536000, immutable`. A custom `next/image` loader picks the variant. `[VERIFICAR: sharp prebuilt binary + memory limit on the Hostinger slot]` |
| G-23 | **Backups.** Neither the DB nor the uploads directory has a backup or restore plan. A redeploy must never touch uploads. | Uploads live **outside** the app directory. `[VERIFICAR: Hostinger's backup frequency on the owner's plan, and that git redeploys don't wipe sibling dirs]`. Weekly off-site copy (owner's PC or Drive, manual in Phase 1). **One restore drill before public opening.** |
| G-24 | **Observability.** Nothing says where errors go or how the owner learns the site is down. | Structured JSON logging (server console, readable in hPanel). An admin `/admin/salud` page shows last run of every job, CRM failures, oldest item in the moderation queue, uploads disk usage, and the live-listing count. External free uptime monitor = external service → owner OK (listed in §6). |
| G-25 | **Paraguay timezone.** Paraguay moved to permanent UTC-3 in 2024. An old ICU/tzdata in the server's Node would show times one hour off for half the year. | A0 adds a unit test asserting `America/Asuncion` renders as UTC-3 in July. `package.json` `engines` pins Node ≥ 20 `[VERIFICAR: Node version available on the slot]`. |
| G-26 | **Security headers are missing from the spec** (CSP, HSTS, frame, referrer, permissions). | A0 sets them in `next.config.ts` `headers()`, and C2 verifies them. CSP must allow the VenderCRM attribution script origin. |
| G-27 | **CI policy.** Per the owner's budgeted-runner policy, no GitHub Actions workflows. | Quality gate = husky pre-push (`npm run verify`) + each phase runs `verify` before opening its PR. Screenshots are taken in-session and **never committed**. |

### 2.4 Contradictions between documents

| # | Contradiction | Resolution |
|---|---|---|
| C-1 | `DATA_SEEDING.md` §2A needs "al menos 20 motos cargadas" **before** the first dealer call. The same doc §3 says the first 5 conversations are for learning, before inventory. ADR-12 forbids demo data. | **ADR-24:** no demo data anywhere, staging included. The first conversations show the working empty site on the phone; the first "yes" dealer's stock (loaded with their written authorization, ideally live via B8's import) becomes the demo for every later meeting. |
| C-2 | `DATA_SEEDING.md` §3: row "≥ 80 → se abre al público, `noindex` fuera", but the next row and `SEO_ARCHITECTURE.md` §2.4 keep `noindex` until 150. | Public (shared, linked) at 80 **with `noindex` still on**. `SITE_NOINDEX=false` only at ≥ 150 from ≥ 5 dealers **and** legal pages lawyer-approved. Fix the wording in `DATA_SEEDING.md` §3. |
| C-3 | `CLAUDE_TASKS.md`: "ante la duda, escalar, no elegir" + GitHub issue per escalation. Autonomous phases need "choose reasonably and log". | **ADR-18: phased autonomous build** (§4 and §5 replace the sequential one-task-one-PR flow for Phase 1). §4 rule 4: every item of `PLAN.md` §4.3's escalation checklist is a hard stop. Anything else, choose and log. Stops are written to `docs/decisions-needed.md` (the watcher notifies the owner). A GitHub issue is optional. |
| C-4 | Branch naming: `claude/f<fase>-<slug>` (CLAUDE_TASKS) vs one branch per phase. | `phase/<id>` for this build. The T-numbers survive as acceptance-criteria references inside phases. |
| C-5 | `ADMIN_SPEC.md` §11 lists "Textos legales" as admin-editable, but legal text must be lawyer-reviewed and never written by a session. | Legal texts are content files changed only by the owner after lawyer review (ADR-22). |
| C-6 | `PLAN.md` §4 names "Sonnet 5 / Codex" as implementers. | The model for every phase is fixed in the §5 table. Codex is used for review, and optionally as a local worker (§8). |

---

## 3. What "best moto site in Paraguay" means (checkable, nothing invented)

"Best" is measured against the things buyers actually suffer from, all verifiable from our own data or public tools:

1. **The only place that compares cuotas across dealers** for the same model (G-9). Checkable: model pages with ≥ 2 dealer offers.
2. **The freshest inventory.** Every dealer listing is reconfirmed ≤ 30 days ago (G-6), and sold motos come down fast (G-1). Checkable: % of live listings with `last_verified_at` ≤ 30 days (target ≥ 90 %).
3. **The fastest on a mid-range Android over 4G.** LCP < 2.5 s, listing page < 500 KB (`SEO_ARCHITECTURE.md` §10). Checkable: Lighthouse.
4. **The most trustworthy.** Pre-moderation < 24 h, verified-dealer badge that means something, no fabricated number anywhere, phone never scrapeable. Checkable: moderation median, audit.
5. **Owns the high-intent queries where it has stock:** `{marca} {modelo} precio paraguay`, `motos en cuotas {ciudad}`, the transfer/papers guides. Checkable: Search Console, once indexing is on.
6. **Best for dealers.** Free year, the owner loads their stock, and they get a monthly report with real numbers (G-14). Checkable: dealers retained at month 12.

Competitor facts come from R0 with sources. No "N°1", no "más grande" (`PLAN.md` §5.6).

---

## 4. Autonomy protocol (every phase prompt references this)

1. Work until every exit criterion passes. Never ask permission for in-plan work.
2. One PR per phase. Branch `phase/<id>` off latest `main`. Open it, verify, and merge it when `npm run verify` is green. A red build is always the session's own work. Lane 2 phases never wait for each other, only for lane 1.
3. Minor non-blocking issues go to `docs/log/<id>.md` "Known issues". The link pass promotes cross-phase items to `KNOWN-ISSUES.md`.
4. **Hard stop** only for: (a) any item of `PLAN.md` §4.3's escalation checklist, (b) a missing credential with no graceful fallback. "Stop" means: append the question with options A/B + recommendation to `docs/decisions-needed.md`, commit, push, end the session. Everything else: choose reasonably, log it, continue.
5. Missing env values never block: document them in `.env.example` and degrade gracefully (e.g. CRM URL unset → lead saved, `crm_status = pending`, logged).
6. Prompts are re-runnable. Check what exists on the branch and continue from the first unmet criterion. WIP commit at least every 30 min.
7. Lane 2 hard limits: no schema, no auth, no state machine, no URL/indexation rule, no CRM payload changes. Use a workaround and add a Backlog note instead.
8. **Model cost guardrail:** Fable is never used for phases, subagents, spawned sessions, watchers, or Routines. Phase models are only Opus or Sonnet as fixed in §5. Fable appears only in review sessions the owner opens himself (§8).
9. **File ownership:** a phase writes only its **Owns** paths, plus its own `docs/log/<id>.md`. On merge conflicts `main` wins; re-apply on top. Never edit outside Owns to resolve a conflict; log it and end.
10. Handoff: done = PR merged green + exit checklist + one re-run of `verify` on `main` + one adversarial re-read of the merged diff (fixes in ONE follow-up commit) + phase log. Lane 1 spawns the next lane 1 phase. A4 creates the watcher and spawns lane 2. The watcher spawns C1 when lane 2 is merged. C1 spawns C2. C2 deletes the watcher and writes the closing report.
11. Phase log ≤ 30 lines: Built / Decisions / Known issues / "Verification: verify green on <sha>".
12. Orientation read: the prompt file, `CLAUDE.md`, `BUILD_PLAN.md` §1 §4 §5, the spec sections named in the phase, and the logs of its **Depends on** phases. Nothing else.
13. Polish cap: one screenshot pass (≤ 5 pages × 2 widths, not committed), one Lighthouse run only if the exit criteria name a number, one scripted Playwright pass only for phases that ship client JS (script saved under `tests/e2e/`). The PR body is written once (≤ 25 lines).
14. Decisions travel by files, never by chat messages to a running session.
15. No GitHub Actions workflows (budgeted-runner policy). The gate is `npm run verify` locally + husky pre-push.

---

## 5. Phases

### 5.1 Phase table

Lane 0 runs any time. Lane 1 is sequential on Opus. Lane 2 runs in parallel on Sonnet (the watcher keeps ≤ 4 running, starting in the listed order). C runs sequentially after lane 2.

| Phase | Lane | Model | Covers | Depends on | Codex review |
|---|---|---|---|---|---|
| **R0** Research | 0 | Sonnet (web) | G-16, G-17, vocabulary check list | — | — |
| **A0** Dev env + schema delta | 1 | Opus | ADR-17, G-20, G-21, G-25, G-26, G-27 | owner Q6 | — |
| **A1** Security core | 1 | Opus | T-113, T-111, G-1 token lib, G-7, G-8/G-19, admin shell | A0 | **yes** |
| **A2** Public skeleton + SEO core | 1 | Opus | T-101, T-102, route contract, G-15, events lib, public shell | A0 | — |
| **A3** Media pipeline | 1 | Opus | T-108, G-2, G-22 | A1 | **yes** |
| **A4** Leads, CRM, tracking | 1 | Opus | T-109, T-110, T-105, phone reveal | A1, A2 | **yes** |
| **B8** Stock import & ops | 2 | Opus | G-18, G-6 workflow, G-14 | A1, A2, A3 | **yes** |
| **B1** Browse pages | 2 | Sonnet | T-103, T-106 (all but model page) | A2 | — |
| **B3** Listing detail | 2 | Sonnet | T-104, public side of T-118, share | A2, A3, A4 | — |
| **B6** Moderation & reports admin | 2 | Sonnet | T-114, admin side of T-118 | A1, A3 | — |
| **B2** Model pages, en-cuotas, home | 2 | Sonnet | G-9, G-10, T-120, model page of T-106 | A2 | — |
| **B4** Publish flow + seller link | 2 | Opus | T-107, G-1 UI, G-12 | A1, A3 | **yes** |
| **B5** Financing, insurance, dealers | 2 | Sonnet | `/financiacion`, `/seguros`, `/gracias`, `/comercios/**`, `/contacto` | A2, A4 | — |
| **B7** Admin CRUD & catalog | 2 | Sonnet | T-115, `model_suggestions`, G-15 in admin | A1 | — |
| **B9** Leads inbox, monetization, health | 2 | Sonnet | T-116, `ADMIN_SPEC.md` §8, G-24, G-13 view | A1, A4 | — |
| **B10** Content & static pages | 2 | Sonnet | T-117 content, T-119 (10 guide drafts via fan-out), legal placeholders | A1, A2 | — |
| **C1** Link pass + sitemaps | — | Sonnet | T-112, `SEO_ARCHITECTURE.md` §8, nav, KNOWN-ISSUES | all B | — |
| **C2** Hardening + E2E + closing | — | Opus | T-121, `TEST_PLAN.md` §4/§7/§8/§9, G-26 check, closing report | C1 | **yes (full surface)** |
| **E1** Design pass | — | owner-driven (Claude Design) | ADR-15 pass | C2 | — |
| **F1** Launch gates | — | owner | T-122, §9 gates | E1 + business | — |

Lane 2 start order is chosen for the **business** critical path: B8 (get dealer stock in) → B1 + B3 (show it) → B6 (moderate it) → the rest.

### 5.2 Phase detail and file ownership

**R0 — Research (Sonnet with web, docs + seed data only).** Owns `docs/research/**`, `src/db/seed-data/**`.
- Catalog expansion from cited sources (importer/dealer sites, dated). Every addition has a source comment; unconfirmed items stay `is_active=false` + `[VERIFICAR]`.
- `docs/research/competitors.md`: who lists motos in PY, what they show (cuotas? dealer comparison? speed?), with URLs and access dates. No traffic numbers unless publicly sourced.
- `docs/research/vocabulary-check.md`: the list of UI terms (`CONTENT_STRATEGY.md` §1.2, category names, documentation labels G-4) for the owner to confirm on the first dealer call.
- Exit: seeds re-run idempotently; every active brand/model has a source; docs committed.

**A0 — Dev env + schema delta.** Owns `src/db/schema.ts` (delta only), `drizzle/0001_*`, `DATABASE_SCHEMA.md` (sync the doc), `DECISIONS.md` (append approved ADR-17…24), `.claude/**`, `.husky/**`, `package.json`, `vitest*.config.*`, `playwright.config.ts`, `scripts/dev-fixtures.ts`, `src/lib/env.ts`, `src/lib/slug.ts` (reserved slugs), `next.config.ts`, `.env.example`, `AGENTS.md`, `docs/decisions-needed.md`, `docs/log/**` scaffold.
- Migration `0001` applies cleanly on top of `0000` on a fresh DB and on a DB with data.
- SessionStart hook: MySQL up, `moto_test` migrated + seeded, idempotent, < 2 min. Verified in a fresh session.
- `npm run verify` = `tsc --noEmit` + lint + unit + integration + build.
- `src/lib/env.ts`: typed env with defaults per §4.5; any server secret imported into a client bundle fails the build.
- The dev-fixtures guard is unit-tested (refuses in prod, and refuses without the flag).
- Timezone test (G-25), reserved-slug test (G-15), security headers (G-26).
- `AGENTS.md` (Codex worker rules, from the manager-worker-codex template, adapted to `CLAUDE.md`).
- Skills: `nodejs-mysql-hostinger-stack`, `session-start-hook`, `budgeted-runner-deploy`.

**A1 — Security core.** Owns `src/lib/auth/**`, `src/lib/listings/state.ts`, `src/lib/activity.ts`, `src/lib/rate-limit.ts`, `src/lib/manage-token.ts`, `src/lib/cron/**`, `src/app/api/cron/**`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/login/**`, `src/middleware.ts`, `scripts/create-admin.ts`.
- iron-session cookie auth, bcrypt 12, lockout via `auth_attempts`, `requireRole` + row-scope helper (the `dealer` branch exists and is tested now, even though there are no dealer users until Phase 2).
- State machine with the full permission matrix, **negative tests for every forbidden transition**, `activity_log` on every transition.
- Cron framework (ADR-19) + expire job + `job_runs` lock. Manage-token create/verify/rotate (hash-only storage).
- Admin shell: layout + nav with a stub page for **every** admin section, so lane 2 phases each own a disjoint directory.
- Exit: `TEST_PLAN.md` §9 auth items pass; direct POST with the wrong role → 403 (tested).

**A2 — Public skeleton + SEO core.** Owns `src/lib/listings/query.ts`, `src/lib/listings/filters.ts`, `src/lib/seo/**`, `src/lib/events.ts`, `src/components/public/**`, `src/app/(public)/layout.tsx`, `src/app/layout.tsx`.
- Faceted query (T-101), with `EXPLAIN` on 10k fixture rows committed in the log. Indexability function (T-102), tested at exact thresholds.
- **Route contract** `src/lib/seo/routes.ts`: the only place URLs are built, with canonical + robots-meta builder (filters → `noindex,follow` + clean canonical; `?page=N` self-canonical). JSON-LD builders, with a test that fails if `Review`/`AggregateRating` ever appear.
- Events lib: session hash, salted IP hash, bot heuristic (`ANALYTICS_AND_KPIS.md` §2.1).
- Public shell: header, footer, breadcrumbs, skip link. Shared `ListingCard`, `Price`, `FinancingLine`, `EmptyState`.
- Exit: unit + integration green; a stub page proves the shell renders with one `h1` and correct meta.

**A3 — Media pipeline.** Owns `src/lib/images/**`, `src/app/api/uploads/**`, `src/app/media/**`, `src/lib/image-loader.ts`, `src/lib/cron/jobs/purge-uploads.ts`.
- Content-sniffed type check, SVG rejected, size limit, re-encode, variants, SHA-256, dimensions (T-108). Uploads go to `pending_uploads` with the draft token, and a claim function moves them to `listing_images`.
- `/media` serving with immutable caching; custom loader; purge job.
- Exit: `TEST_PLAN.md` §9 upload items pass (renamed executable rejected, SVG rejected), and a 5-image listing stays under the §10 weight budget.

**A4 — Leads, CRM, tracking.** Owns `src/lib/crm/**`, `src/lib/leads/**`, `src/app/api/leads/**`, `src/app/ir/**`, `src/app/api/telefono/**`, `src/lib/cron/jobs/retry-leads.ts`.
- `INTEGRATIONS.md` §2 in full: save first, respond, then post; idempotency; every response code; `lead_deliveries`; honeypot; 10 s timeout; `vc_attr`; `consent_text_version` stored in `payload_json`. Retry job (T-110).
- `/ir/wa/*` (T-105) and phone-reveal endpoint (`phone_reveal` event; the number is never in the initial HTML).
- Exit: `TEST_PLAN.md` §2 items 3, 4, 8 and §5 items 6–7 pass with a mock CRM. **The real round-trip (§5 items 1–5) is a §6 owner step** once Q4 is resolved. Skill: `vendercrm-lead-capture`.
- **After merge:** create the watcher Routine and spawn lane 2.

**B1 — Browse pages.** Owns `src/app/(public)/motos/page.tsx`, `motos/[brand]/page.tsx`, `motos/[brand]/ciudad/**`, `motos/tipo/**`, `motos/ciudad/**`, `motos/nuevas/**`, `motos/usadas/**`, `src/components/browse/**`.
- T-103 + T-106 for these routes, using A2's route contract only. Forbidden combinations → 404.
- The programmatic types share one template. Build one exemplar, then fan the rest out as subagents (`fable-directs-sonnet-builds` §Fan-out, on Sonnet).

**B2 — Model pages, en-cuotas, home.** Owns `src/app/(public)/motos/[brand]/[model]/**`, `src/app/(public)/motos/en-cuotas/**`, `src/app/(public)/page.tsx`, `src/components/financing-compare/**`.
- G-9 comparison block (real rows only, "informado por el comercio", no computed cuota), price range only with N ≥ 5, G-10 cuota-first home, T-120.

**B3 — Listing detail.** Owns `src/app/(public)/aviso/**`, `src/app/api/reportes/**`, `src/components/listing/**`.
- T-104 in mobile order; sold/expired/301/410 per `SEO_ARCHITECTURE.md` §4; buyer-safety block; "Compartir por WhatsApp" (records `share`); report form + API with 5/IP/day and auto-pause at 3 `estafa`/`robada`.

**B4 — Publish flow + seller link.** Owns `src/app/(public)/publicar/**`, `src/app/(public)/mi-aviso/**`.
- T-107: 5 steps, photos first, `localStorage` autosave, client compression, per-photo upload + retry, dependent brand→model selector, `model_suggestions`, honeypot, 3/IP/24 h, final submit works without JS.
- `/mi-aviso/<token>`: mark sold, pause/resume, renew, edit (photo/description edits → `pending_review`). All server-side via A1's state machine.

**B5 — Financing, insurance, dealers.** Owns `src/app/(public)/financiacion/**`, `seguros/**`, `gracias/**`, `comercios/**`, `contacto/**`.
- Landing pages and forms on top of A4's handler, with the mandatory disclaimer verbatim. Dealer index + page with `AutoDealer` JSON-LD. The verified badge only shows with its literal explanation.

**B6 — Moderation & reports admin.** Owns `src/app/admin/moderacion/**`, `src/app/admin/denuncias/**`.
- `ADMIN_SPEC.md` §3 + §10 in full. On approve: pre-built WhatsApp message including the G-1 manage link + copy button. G-12 duplicate rule.

**B7 — Admin CRUD & catalog.** Owns `src/app/admin/publicaciones/**`, `src/app/admin/comercios/**`, `src/app/admin/catalogo/**`.
- T-115: authorization block required before a dealer's stock can publish; slug locked after publish; reserved slugs; `model_suggestions` queue; "baja de todo el stock".

**B8 — Stock import & ops (Opus).** Owns `src/app/admin/importar/**`, `src/app/admin/comercios/[id]/reporte/**`, `src/lib/import/**`, `scripts/import-dealer-stock.ts`, `docs/templates/stock-template.csv`.
- G-18 CSV import with dry-run, photo mapping, idempotent upsert, moderation-checklist validation, `activity_log`.
- G-6 "reconfirmar stock" bulk action (sets `last_verified_at`, extends `expires_at` by the dealer TTL) + a WhatsApp message listing that dealer's live refs.
- G-14 dealer report copy button.

**B9 — Leads inbox, monetization, health.** Owns `src/app/admin/leads/**`, `src/app/admin/monetizacion/**`, `src/app/admin/salud/**`, `src/app/admin/config/**`.
- T-116 (red alarm on exhausted retries, manual retry, CSV). Manual featured/plans/ads controls (`ADMIN_SPEC.md` §8) + featured-expiry job. G-24 health page. G-13 read-only config view.

**B10 — Content & static pages.** Owns `src/app/(public)/guias/**`, `src/app/(public)/como-funciona/**`, `terminos/**`, `privacidad/**`, `src/app/admin/contenido/**`, `content/**`.
- Posts CRUD with `reviewed_by` enforced server-side, and `intro_html` editing with a live indexability indicator.
- 10 guide **drafts** (fan-out), every procedure/fee fact marked `[VERIFICAR: fuente]`.
- Legal pages = placeholder + "en revisión", **no legal text written** (`LEGAL_AND_COMPLIANCE.md` §10).

**C1 — Link pass + sitemaps (Sonnet).** Owns `src/app/sitemap.xml/**`, `src/app/sitemaps/**`, `src/app/robots.txt/**`, `src/components/public/nav*`, `KNOWN-ISSUES.md`, plus cross-link edits listed in `docs/decisions-needed.md`.
- T-112, `SEO_ARCHITECTURE.md` §8 linking rules (never mass-link noindex pages), nav entries, promote known issues. Spawns C2.

**C2 — Hardening + E2E + closing (Opus).** Owns `tests/**`, perf/a11y fixes anywhere (logged file by file), `docs/log/C2.md`, `docs/closing-report.md`.
- Full `TEST_PLAN.md` §4 E2E suite (Playwright, mobile viewport), §7 Lighthouse on 4 pages, §8 axe, §9 security incl. `VENDERCRM_API_KEY` bundle scan = 0, headers check, `EXPLAIN`.
- Measure TTFB/LCP from a PY-like network → data for Q10.
- Closing report: every Phase 1 exit criterion as met / not met / needs-owner. Deletes the watcher.

**E1 — Design pass** (ADR-15). Owner-driven. It changes styles, not structure. Uses the component boundaries A2 set up. No AI images presented as real motos; any illustration is decorative and only made if the owner asks.

**F1 — Launch gates** (§9). Owner decisions with real numbers on screen.

---

## 6. Human inputs checklist (only the owner can do these)

| # | Item | Needed by |
|---|---|---|
| H-1 | **Hostinger Node slot for production** (+ a 2nd for staging if Q8 = yes), connected to the repo via hPanel Git import. MySQL DB created. Uploads dir created **outside** the app dir. All env vars from `.env.example` set (new: `CRON_SECRET`, `ALLOW_DEV_FIXTURES` absent in prod). Closes Phase 0's missing exit criterion. | Now (also closes T-005) |
| H-2 | Cron: confirm whether hPanel offers cron for this plan; if yes, add the `curl` lines A1 documents | After A1 |
| H-3 | Domain `moto.com.py` DNS → Hostinger, HTTPS, `www` → apex. SPF/DKIM/DMARC before the first email | Before public opening |
| H-4 | VenderCRM: create the tenant/site for moto.com.py, get its **own** key, set a default stage. Then run `TEST_PLAN.md` §5 items 1–5 with your real phone | Before C2 closes |
| H-5 | Google Search Console (+ Bing Webmaster) verified on day one, sitemaps submitted only after `SITE_NOINDEX=false` | Before public opening |
| H-6 | First admin user via `scripts/create-admin.ts` on the server | After A1 deploy |
| H-7 | Backup check + one restore drill (G-23) | Before public opening |
| H-8 | Approve external free services if wanted: uptime monitor, Cloudflare (Q10), Turnstile (only when spam appears) | C2 |
| H-9 | Confirm UI vocabulary + category names + documentation labels with one real dealer (`docs/research/vocabulary-check.md`) | Before B4 ships to prod |

## 7. Business track (parallel to the build, starts now)

The code is not the bottleneck. These are.

| # | Workstream | Next action | Gate it unblocks |
|---|---|---|---|
| S-A | **Dealer sales** (`DATA_SEEDING.md` §2A) | List 25 target dealers (name, city, phone, where they post today). First 5 calls are for learning. Offer: free 12 months, "yo cargo tu stock", monthly real report. Get the authorization text answered in writing. | 20 → 80 → 150 listings |
| S-B | **Lawyer (PY)**, one engagement, one consolidated question list | Send `LEGAL_AND_COMPLIANCE.md` §1–§8 + these extra questions: (a) whether the `vc_attr` 90-day attribution cookie needs a cookie notice; (b) whether the WhatsApp authorization text is sufficient; (c) platform liability; (d) financial/insurance lead referral (blocking before any financiera deal). Deliverable: `/terminos`, `/privacidad`, disclaimers. | `SITE_NOINDEX=false`; Phase 3 |
| S-C | **Contador** | `LEGAL_AND_COMPLIANCE.md` §4 | First charge |
| S-D | **Financiera/aseguradora conversations** | Only after S-B's referral answer. Define "lead cualificado" in writing. | Financing-lead revenue |
| S-E | **Organic social** (ADR-23, if Q9 = yes) | FB page + Instagram + WhatsApp Channel named moto.com.py. Post real new stock (with dealer permission) linking to the listing. Zero ad spend. `higgsfield-social-prompts` can write post/reel prompts; nothing is generated without the owner asking. | Early traffic before SEO matures |
| S-F | **Dealer perk (backlog)** | Offer Google Business Profile tuning to signed dealers (`gbp-optimizer`) as a relationship builder, not a product | Dealer retention |

## 8. Reviews: when Fable 5.1 or Codex (gpt-6-astra) should look

Per the Fable cost guardrail, **no build step ever spawns Fable**. Each Fable review is a session the owner opens, reads committed state once, writes decisions into files, and closes. Codex reviews run from the owner's local Claude session via `manager-worker-codex`, and only produce a findings file and fixes on the phase branch.

| When | Who | What to review | Worth it? |
|---|---|---|---|
| **Now**, after the owner answers §1.2 | Fable (optional) | `BUILD_PLAN.md` §2 + `DATABASE_SCHEMA.md`. **Only the schema delta ADR-17 and ADR-19/20/21.** The schema is the one thing that's expensive to change later. | **Medium.** Skip if short on Fable usage. This plan was written by Opus with the full spec in context. |
| After A1, A3, A4, B4, B8 merge | Codex `gpt-6-astra` **high**, review-only | Adversarial security review of that phase's diff: authz bypass (direct POST, wrong role, row scope), token handling, upload validation, CRM key leakage, idempotency races, SQL built from user input. Output: `docs/review/<phase>-codex.md`, then fixes. | **High.** Cheap, and a second model family catches different bugs on the exact surfaces where a bug is a breach. |
| **Lane boundary** (after A4, before or while lane 2 runs) | Fable (optional, one read) | The merged foundation: route contract, indexability, state machine, lead handler. Push any correction into the lane 2 prompt files. | **Medium-high.** Everything in lane 2 builds on these four modules. |
| After C2, **before `SITE_NOINDEX=false`** | Fable | Pre-launch audit of the **live** staging/prod site: anti-fabrication (`PLAN.md` §5), indexation rules actually enforced, JSON-LD, trust copy, financing-disclaimer placement, empty states. Owner + lawyer sign-off happen here too. | **High.** This is the irreversible step: Google's first impression of the domain. |

Paste-ready review prompts are written into `prompts/review-*.md` together with the phase prompts once §1.2 is answered.

## 9. Launch gates

| Gate | Condition | Action |
|---|---|---|
| G-demo | C2 closed; first dealer's authorized stock imported (≥ 20 real listings) | Show it in dealer meetings |
| G-open | ≥ 80 live real listings; legal pages lawyer-approved; restore drill done; health page green 7 days | Share the site publicly and start social. **`noindex` stays on.** |
| G-index | ≥ 150 live from ≥ 5 dealers; `IMPLEMENTATION_PHASES.md` Phase 1 exit criteria all evidenced; Fable pre-launch audit done | Owner sets `SITE_NOINDEX=false`, submits sitemaps |
| Kill/pivot check | `ANALYTICS_AND_KPIS.md` §6: < 20 financing leads/month after 6 months at 150+ listings, flat for 3 months | Follow its 3-step diagnosis before concluding anything |

## 10. After Phase 1 (unchanged from `IMPLEMENTATION_PHASES.md`, with triggers)

Phase 2 dealer accounts (trigger: > 2 h/week manual loading, or a dealer asks) · Phase 3 monetization + `search_alerts` + event aggregation/purge (trigger: lawyer §3 answered + first paying interest) · Phase 4 content at scale, driven by Search Console · Phase 5 recurrence (trigger: measured `favorite` demand) · Phase 6 own inventory/parts (separate business decision). Phase 2+ tasks are written only after F1, per `CLAUDE_TASKS.md`.

**Project skill:** once live and stable, write a `moto-dev` skill (schema, routes, known issues, do-not-touch list), like `propia-dev`.

## 11. Backlog (scope creep waits here)

Model spec sheets from importer data (needs columns + sourcing) · price history per listing (T&S §10 says not yet) · USD price column (ADR-06 path) · WhatsApp Business API · Turnstile · third-party analytics (none until needed; own events + Search Console cover the MVP and avoid a cookie banner) · comparador · favoritos · dealer GBP perk · per-city guides.

## 12. Cost and time, rough

A rough estimate from the conthtml benchmark (~$20 per Opus/Sonnet phase that ships code); treat it as an order of magnitude, not a quote. 5 lane-1 Opus phases + 10 lane-2 phases (2 Opus) + C1 + C2 + R0 ≈ **$250–400** in model usage. Codex reviews add a small amount. Fable reviews are the owner's own sessions. Wall-clock ≈ 1 day for lane 1 + ~1 day for lane 2 in parallel + ½ day for C. The business track sets the real launch date.

## 13. Build log index

| Phase | PR | Log |
|---|---|---|
| (empty until A0) | | |

PR for this audit + A0 prompt: see git history of `prompts/opus-A0-foundation.md`.
