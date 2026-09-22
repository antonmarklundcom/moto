# Phase A4 — Leads, CRM, tracking. OPUS session. Lane 1 (after A3). Last lane 1 phase.

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5, §13, `docs/log/A0.md`, `docs/log/A1.md`,
`docs/log/A2.md`, `INTEGRATIONS.md` §1–§2, `TEST_PLAN.md` §2.3–§2.4, §2.8, §5, `LEGAL_AND_COMPLIANCE.md` §3,
`ANALYTICS_AND_KPIS.md` §1–§2.1. Execute under the autonomy protocol `BUILD_PLAN.md` §4.

Owns: `src/lib/crm/**`, `src/lib/leads/**`, `src/app/api/leads/**`, `src/app/ir/**`, `src/app/api/telefono/**`,
`src/lib/cron/jobs/retry-leads.ts` (+ its registry line), tests, `docs/log/A4.md`.

Branch `phase/A4` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Skills: load `vendercrm-lead-capture` before step 1.

Do:
1. Lead handler (`INTEGRATIONS.md` §2 in full): validate → honeypot → normalize phone → `leadIdempotencyKey()`
   (ADR-25, `src/lib/hash.ts`) → **insert into `leads` first** (UNIQUE collision = same lead, answer success)
   → respond → post to VenderCRM with a 10 s timeout, `lead_deliveries` row per attempt, every response code
   of §2.6 (`200 duplicate:true` = success). Never `pipeline/stage/owner/tag`; omit empty optionals.
   `consent_text_version` in `payload_json`. `vc_attr` cookie read server-side into utm/gclid/fbclid.
2. No `VENDERCRM_URL`/key (S-6): lead saved with `crm_status = pending`, structured log line, no error to the
   visitor. The key never reaches the client (`src/lib/env.ts` is `server-only`).
3. Retry job (T-110) on A1's cron framework: backoff, stops at 5 attempts, never duplicates.
4. `/ir/wa/[...]` (T-105, ADR-07): records `whatsapp_click` via `src/lib/events.ts`, 302 to `wa.me` with the
   §1.2 message (real data, escaped, max length); redirects even if recording fails. `general` target =
   `WHATSAPP_SITE_NUMBER` with an optional prefilled search (ADR-21). Listings with `contact_whatsapp=false`
   never get a WhatsApp link.
5. Phone reveal `POST /api/telefono/[ref]`: records `phone_reveal`, returns `formatPhoneDisplay()`; the number
   is never in the initial HTML. Rate-limited per IP.
6. Mock CRM server for tests (every §2.6 status, timeout, malformed body).

Exit: `TEST_PLAN.md` §2 items 3, 4, 8 and §5 items 6–7 pass against the mock; unit test that the client bundle
never contains `VENDERCRM_API_KEY` (grep `.next/static` after build); verify green; PR
`A4: leads, CRM, tracking` merged per `prompts/_handoff.md`. The real round-trip (§5 items 1–5) is owner
step H-4: write it as "needs owner" in the log. Log "Codex review due (owner, §8)".

## After this phase
Follow `prompts/_handoff.md`, then:
1. Create the watcher Routine exactly as `prompts/_watcher.md` §Setup says. Put its `trigger_id` in the log.
2. Spawn lane 2, first four in this order: `prompts/opus-B8-import.md` (Opus), `prompts/sonnet-B1-browse.md`,
   `prompts/sonnet-B3-detail.md`, `prompts/sonnet-B6-moderation.md` (Sonnet `claude-sonnet-5`). The watcher
   starts B2, B4, B5, B7, B9, B10 as slots free. Then end with the phase report.
