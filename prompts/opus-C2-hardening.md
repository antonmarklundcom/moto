# Phase C2 — Hardening, E2E, closing report. OPUS session. Sequential, after C1. Last phase.

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §3, §4, §5, §6, §9, §13, every `docs/log/*.md` "Known issues",
`KNOWN-ISSUES.md`, `TEST_PLAN.md` §4, §7–§10, `IMPLEMENTATION_PHASES.md` (Phase 1 exit criteria),
`SEO_ARCHITECTURE.md` §10, §12. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `tests/**`, perf/a11y/security fixes anywhere (each file listed in the log with the reason), `playwright.config.ts`,
`docs/log/C2.md`, `docs/closing-report.md`, `BUILD_PLAN.md` §13.

Branch `phase/C2` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Skills: `nextjs-deploy-hostinger` for the deploy checklist (the owner deploys, H-1).

Do:
1. Full `TEST_PLAN.md` §4 E2E suite (Playwright, mobile viewport, `/opt/pw-browsers`, never `playwright install`),
   saved under `tests/e2e/`, on a production build with fixtures.
2. §7 Lighthouse on 4 pages (home, listing, model, detail) mobile; §8 axe on the same pages + admin login;
   fix what fails, re-measure once.
3. §9 security: `VENDERCRM_API_KEY` bundle scan = 0 hits in `.next/static`; headers check (CSP, HSTS, frame,
   referrer, permissions, no `x-powered-by`) against `next start`; wrong-role POST sweep over every mutation
   route; `EXPLAIN` of the public queries on 10k rows.
4. Measure TTFB/LCP with a throttled 4G profile (data for Q10, Cloudflare; no decision).
5. `docs/closing-report.md`: every `IMPLEMENTATION_PHASES.md` Phase 1 exit criterion as met / not met /
   needs owner (with the H-n step), open Codex reviews, open `docs/decisions-needed.md` entries, the owner's
   next 5 actions (`BUILD_PLAN.md` §6–§9). Real numbers only.
6. Delete the watcher Routine (`list_triggers` → `moto build watcher` → `delete_trigger`).

Exit: E2E, Lighthouse, axe and security checks green or each failure logged with its reason; closing report
committed; watcher deleted; verify green; PR `C2: hardening + closing report` merged per `prompts/_handoff.md`.
Log "Codex review due (owner, full surface, `BUILD_PLAN.md` §8)".

## After this phase
Spawn nothing. The build is done. End with the closing report's summary: met / not met / needs owner.
