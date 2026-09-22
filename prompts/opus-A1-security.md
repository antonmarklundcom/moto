# Phase A1 — Security core. OPUS session. Lane 1 (after A0).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (A1), §13, `docs/log/A0.md`,
`ADMIN_SPEC.md` §1–§2, `DATABASE_SCHEMA.md` §2.1, §2.13, §2.16, §2.17, §3, `TEST_PLAN.md` §2.6, §3, §9.
Execute under the autonomy protocol `BUILD_PLAN.md` §4. Build nothing outside the plan.

Owns: `src/lib/auth/**`, `src/lib/listings/state.ts`, `src/lib/activity.ts`, `src/lib/rate-limit.ts`,
`src/lib/manage-token.ts`, `src/lib/cron/**`, `src/app/api/cron/**`, `src/app/admin/{layout,page}.tsx`,
`src/app/admin/login/**`, one stub `src/app/admin/<section>/page.tsx` per section ("En construcción"),
`src/middleware.ts`, `scripts/create-admin.ts`, `package.json` (deps), tests beside the code, `docs/log/A1.md`.

Branch `phase/A1` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.

Do:
1. iron-session cookie per `ADMIN_SPEC.md` §1 (`env.sessionSecret()`), bcrypt 12, lockout via `auth_attempts`
   (5 failures per IP hash and per email hash; pick the window, log it). Hashes via `hashWithSalt`.
2. `requireRole(...roles)` + row-scope helper (`dealer` → own `dealerId`, `seller` → own `ownerId`).
   The dealer/seller branches exist and are tested now, with no such users yet.
3. `src/lib/listings/state.ts`: the whole `DATABASE_SCHEMA.md` §3 matrix as data + `transition()` checking actor
   and the §3 hard rules, writing `activity_log` in the same transaction. **A negative test per forbidden
   transition × role.**
4. `manage-token.ts` (G-1): 32 random bytes base64url shown once, SHA-256 in `listings.manage_token_hash`,
   verify (constant time), rotate.
5. Cron (ADR-19): `POST /api/cron/[job]`, bearer `CRON_SECRET` (unset → 503), lock via `job_runs.lock_key`
   (release stale > 30 min), `detail_json`. Jobs: `expire-listings` (`dealers.listing_ttl_days`, NULL → 60;
   `activity_log`), `purge-auth-attempts` (30 d). Put the hPanel `curl` lines in the log (H-2).
6. Admin shell: layout + nav + stubs for moderacion, denuncias, publicaciones, comercios, catalogo, importar,
   leads, monetizacion, salud, config, contenido, actividad — so lane 2 phases own disjoint dirs.
   `middleware.ts` redirects anonymous `/admin/**` to login; every action/route still calls `requireRole`.
7. `scripts/create-admin.ts` (dotenv first; password from a no-echo prompt or stdin, never argv).

Exit: `TEST_PLAN.md` §9 auth items pass; direct POST with the wrong role → 403 (integration test); expire job
integration test (changes only what it should, writes `activity_log`); verify green; PR `A1: security core`
merged per `prompts/_handoff.md`. Log "Codex review due (owner, `BUILD_PLAN.md` §8)".

## After this phase
Follow `prompts/_handoff.md`. Next: `prompts/opus-A2-public-seo.md`, model Opus (`claude-opus-5-5`).
