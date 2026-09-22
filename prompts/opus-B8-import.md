# Phase B8 — Stock import & dealer ops. OPUS session. Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (B8), §13, `docs/log/A0.md`–`A4.md`,
`DATA_SEEDING.md` §2 (A, B), §4–§5, `TRUST_AND_SAFETY.md` §3–§4, `ANALYTICS_AND_KPIS.md` §7, `ADMIN_SPEC.md` §5.
Execute under the autonomy protocol `BUILD_PLAN.md` §4. Build nothing outside the plan.

Owns: `src/app/admin/importar/**`, `src/app/admin/comercios/[id]/reporte/**`, `src/lib/import/**`,
`scripts/import-dealer-stock.ts`, `docs/templates/stock-template.csv`, tests, `docs/log/B8.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
images through A3's pipeline. Anything else you need outside Owns → "Link-pass wishes" or "Backlog" in your log.

Branch `phase/B8` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.

Do:
1. G-18 CSV import: template with Spanish headers; upload (admin only) → **dry-run preview** listing what will
   be created / updated / rejected and why; confirm → apply. Idempotent upsert by `(dealer_id, external_ref)`.
   Catalog mapping (unknown model → `model_suggestions`, row not published). The same validation as the
   moderator checklist (`TRUST_AND_SAFETY.md` §3). Refuses a dealer without an authorization block (ADR-12).
2. Photo mapping: a zip or folder whose file names start with `external_ref`, through A3's validation/variants.
3. Every created/updated listing writes `activity_log`; imported stock follows the dealer's `auto_approve`.
4. G-6 "Reconfirmar stock" bulk action: sets `last_verified_at`, extends `expires_at` by the dealer TTL
   (`listing_ttl_days`, NULL → 60), plus a copyable WhatsApp message listing that dealer's live refs.
5. G-14 "Copiar reporte para WhatsApp": last 30 days of real views, WhatsApp clicks and financing leads from
   that dealer's motos (bots excluded), formatted per `ANALYTICS_AND_KPIS.md` §7. Real counts only.
6. `scripts/import-dealer-stock.ts`: the same core from the CLI (dotenv first, dry-run default, `--apply`).

Exit: integration tests: re-importing the same CSV creates 0 duplicates; a bad row is rejected with a reason;
an unknown model lands in `model_suggestions`; the dealer report counts match a fixture query; verify green;
PR `B8: stock import & dealer ops` merged per `prompts/_handoff.md`. Log "Codex review due (owner, §8)".

## After this phase
Spawn nothing (lane 2). End with the phase report.
