# Phase B6 — Moderation & reports admin. SONNET session. Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §2.2 (G-12), §4, §5.1, §5.2 (B6), §13, `docs/log/A0.md`, `A1.md`,
`A3.md`, `ADMIN_SPEC.md` §2–§3, §10, `TRUST_AND_SAFETY.md` §2–§5, `CONTENT_STRATEGY.md` §1.6.
Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/admin/moderacion/**`, `src/app/admin/denuncias/**`, `src/components/admin/moderation/**`,
unit/integration tests beside the code, `docs/log/B6.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B6` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn (§4.13).

Do:
1. Moderation queue (`ADMIN_SPEC.md` §3 in full): oldest first, keyboard-driven, the §3 checklist visible,
   duplicate signals (same `content_hash` in other listings, **ignoring `is_catalog_photo`**, G-12), same phone
   across listings, price outliers vs. the model's live listings.
2. Approve / reject with the reason codes of `TRUST_AND_SAFETY.md` §4 via `transition()`. Reject text from
   `CONTENT_STRATEGY.md` §1.6.
3. On approve for a private seller: create the manage token (A1 `manage-token.ts`) and show a pre-built WhatsApp
   message with the `/mi-aviso/<token>` link (G-1) + a copy button. The token is shown once, never stored.
4. Reports (`ADMIN_SPEC.md` §10): queue by status, dismiss / pause / take down (410), resolution note required,
   all to `activity_log`. **No "block phone"**: it needs a table and a lawyer answer (`TRUST_AND_SAFETY.md` §9) → Backlog.
5. `requireRole("admin","moderator")` on every page and action, tested with a direct POST as the wrong role.

Exit: integration tests for approve, reject, the token message and the wrong-role 403; duplicate detection
ignores catalog photos (test); verify green; PR `B6: moderation & reports admin` merged per
`prompts/_handoff.md`.

## After this phase
Spawn nothing (lane 2). End with the phase report.
