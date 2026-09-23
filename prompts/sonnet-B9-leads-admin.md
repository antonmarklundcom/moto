# Phase B9 — Leads inbox, monetization, health, config, activity. OPUS session (filename prefix is historical, `BUILD_PLAN.md` §5.1). Lane 2 (parallel).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §2.2 (G-13), §2.3 (G-24), §4, §5.1, §5.2 (B9), §13,
`docs/log/A0.md`, `A1.md`, `A4.md`, `ADMIN_SPEC.md` §2, §7–§8, §11–§12, `MONETIZATION.md` §9, `DECISIONS.md` ADR-22,
ADR-26. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/admin/leads/**`, `src/app/admin/monetizacion/**`, `src/app/admin/salud/**`, `src/app/admin/config/**`,
`src/app/admin/actividad/**`, `src/lib/cron/jobs/expire-featured.ts` (+ its registry line), `src/components/admin/ops/**`,
unit/integration tests, `docs/log/B9.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B9` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn (§4.13).

Do:
1. Leads inbox (T-116, `ADMIN_SPEC.md` §7): filters, CRM status, **red alarm for exhausted retries**, manual retry
   through A4's sender (never a new payload shape), CSV export. Dealer role sees only its motos' leads (tested).
2. Monetization (§8): manual featured purchases (real amount, method, reference), dealer plans with 30/7-day
   alerts, `ad_placements` CRUD, monthly income = sum of recorded charges only. `expire-featured` job via A1's
   cron framework turns off `listings.is_featured`. No payment gateway (ADR-13).
3. `/admin/salud` (G-24): last run and status of every job (`job_runs`), CRM failures, oldest item in moderation,
   uploads disk usage, live listing count. All from real queries.
4. `/admin/config` (G-13, ADR-22): read-only. `siteIndexingMode()` with the live listing and dealer counts next to
   it, the hPanel steps (env var + rebuild), whether the CRM env vars are set (never their values).
5. `/admin/actividad` (`ADMIN_SPEC.md` §12): `activity_log` filterable by entity, user, action, date, with the diff.

Exit: integration tests: manual retry reuses the same idempotency key; exhausted retries show the alarm; config
page never renders a secret (test greps the HTML); wrong-role POST → 403; verify green; PR `B9: leads inbox,
monetization, health` merged per `prompts/_handoff.md`.

## After this phase
Spawn nothing (lane 2). End with the phase report.
