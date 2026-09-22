# Phase A0 — Dev env + schema delta + PR #1–#8 fixes. OPUS session. Lane 1 (first phase).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §0, §1, §2.0, §2.1, §4, §5 (table + A0 detail),
and the spec sections you touch (`DATABASE_SCHEMA.md`, `INTEGRATIONS.md` §2.4, `TEST_PLAN.md` §2).
Execute under the autonomy protocol `BUILD_PLAN.md` §4. Build nothing outside the plan.
The owner approved every default (`BUILD_PLAN.md` §1.3): ADR-17…ADR-25 are decided, don't re-ask.

Branch: `phase/A0` off latest `main` (if the harness assigned you another branch, use that one).
Budget: one session. WIP commit every 30 min. Re-runnable: continue from the first unmet item.

Owns: `src/db/**` (schema delta only, index.ts fixes), `drizzle/0001_*` + meta, `src/lib/{format,hash,phone,slug,env}.ts`
+ tests, `src/lib/storage/**`, `src/app/layout.tsx`, `src/app/error.tsx`, `next.config.ts`, `package.json`,
`vitest*.config.*`, `playwright.config.ts`, `.husky/**`, `.claude/**`, `scripts/dev-fixtures.ts`, `AGENTS.md`,
`CLAUDE.md`, `DECISIONS.md`, `DATABASE_SCHEMA.md`, `INTEGRATIONS.md`, `TEST_PLAN.md`, `DATA_SEEDING.md`, `ADMIN_SPEC.md`,
`CLAUDE_TASKS.md` (header note only), `.env.example`, `docs/**`, `prompts/**`, `BUILD_PLAN.md` (§1.3, §13 only).

Do, in this order:
1. **Dev env first.** `.claude/hooks/session-start.sh` + `.claude/settings.json` SessionStart hook (load the
   `session-start-hook` skill): apt-install `mysql-server` if absent (it's available via apt, root, no sudo prompt),
   start it, create `moto_dev` + `moto_test` with a local user, write `.env` from `.env.example` with local values if
   missing, `npm ci`, run migrations + `seed:catalog` on both DBs. Idempotent, quiet, < 2 min on re-run.
   Verify by running it twice in this session.
2. **PR #1–#8 fixes F-1…F-9, F-12, F-13** exactly as `BUILD_PLAN.md` §2.0 says, each with a test.
3. **Schema delta ADR-17** (`BUILD_PLAN.md` §2.1 G-1…G-8): edit `schema.ts`, `drizzle-kit generate` → `0001_*`,
   apply on a DB that already has 0000 + seeds, and on a fresh DB. Sync `DATABASE_SCHEMA.md` (new columns/tables, why).
4. **Docs sync:** append ADR-17…ADR-26 to `DECISIONS.md` (ADR-26 = `SITE_NOINDEX` 3 modes, default `true`, flipping
   is the owner's call); mark S-1…S-8 confirmed 2026-09-22. Fix C-2 wording in `DATA_SEEDING.md` §3, ADR-22 in
   `ADMIN_SPEC.md` §11, ADR-25 key formula in `CLAUDE.md` §4 / `INTEGRATIONS.md` §2.4 / `TEST_PLAN.md` §2.3.
   Add to `CLAUDE.md` a short "Build process" section pointing to `BUILD_PLAN.md` §4 (it overrides `CLAUDE_TASKS.md`
   ordering for Phase 1; T-numbers stay as acceptance references). Add a one-line note at the top of `CLAUDE_TASKS.md`.
5. **Tooling:** scripts `typecheck`, `lint`, `test` (unit), `test:int` (integration, `*.int.test.ts`, uses
   `TEST_DATABASE_URL`), `e2e` (Playwright, chromium at `/opt/pw-browsers`; don't download browsers), `verify`
   (typecheck+lint+test+test:int+build), `db:generate`, `db:migrate`, `fixtures`. `engines.node >= 20.9`.
   Husky: pre-push runs `verify`; pre-commit blocks any `.github/workflows/` file. **No GitHub Actions** (§4.15).
6. `src/lib/env.ts` (typed server env + `siteIndexingMode()`), security headers + `poweredByHeader:false` in
   `next.config.ts` (CSP must allow `VENDERCRM_URL` origin for `vc-attribution.js`), timezone test (G-25),
   `scripts/dev-fixtures.ts` with the G-21 guard + unit test, `[DEV]`-prefixed titles, ~200 listings incl. financing-only
   and 0 km cases, covering several brands/cities so threshold pages flip both ways.
7. `AGENTS.md` (Codex worker rules adapted from `CLAUDE.md`), `docs/decisions-needed.md` (empty template),
   `docs/log/A0.md`.
8. **Write the remaining prompt files** from `BUILD_PLAN.md` §5 using the skeleton in the `phased-autonomous-build`
   skill (≤ 35 lines each, detail stays in the plan): `opus-A1-security.md`, `opus-A2-public-seo.md`, `opus-A3-media.md`,
   `opus-A4-leads.md`, `sonnet-R0-research.md`, `opus-B8-import.md`, `sonnet-B1-browse.md`, `sonnet-B2-model-home.md`,
   `sonnet-B3-detail.md`, `opus-B4-publish.md`, `sonnet-B5-financing-dealers.md`, `sonnet-B6-moderation.md`,
   `sonnet-B7-admin-crud.md`, `sonnet-B9-leads-admin.md`, `sonnet-B10-content.md`, `sonnet-C1-link-pass.md`,
   `opus-C2-hardening.md`, plus `_handoff.md` (gates + spawn call), `_watcher.md` (per `BUILD_PLAN.md` §4.10 and the
   skill's watcher rules; Sonnet; hourly; ≤ 4 lane-2 sessions; notifies the owner, never Fable), and
   `review-codex.md` + `review-fable-lane-boundary.md` + `review-fable-prelaunch.md` (paste-ready, per §8).
   Each phase prompt names its Owns, Depends on, exit criteria, skills to load, and next phase.

Exit: `npm run verify` green on a DB migrated 0000→0001; the hook works twice in a row; all prompt files exist;
`docs/log/A0.md` written; §13 index line added; PR `A0: dev env, schema delta 0001, PR #1–#8 fixes` merged green.

## After this phase
Follow `prompts/_handoff.md`. Next: `prompts/opus-A1-security.md`, model Opus (`claude-opus-5-5`).
Also spawn `prompts/sonnet-R0-research.md` on Sonnet (`claude-sonnet-5`) now; it runs in parallel (lane 0).
If `create_session` is unavailable (local CLI): stop and tell the owner the exact line to paste for A1 and R0.
