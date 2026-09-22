# Phase B4 — Publish flow + seller link. OPUS session. Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §2.1 (G-1, G-2), §2.2 (G-12), §4, §5.1, §5.2 (B4), §13,
`docs/log/A0.md`, `A1.md`, `A3.md`, `PRODUCT_SPEC.md` §2.2, `DATABASE_SCHEMA.md` §2.6, §2.15, §3,
`TRUST_AND_SAFETY.md` §3, §8, `CONTENT_STRATEGY.md` §1.4. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/(public)/publicar/**`, `src/app/(public)/mi-aviso/**`, `src/components/publish/**`,
`tests/e2e/publish.spec.ts`, unit/integration tests beside the code, `docs/log/B4.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B4` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.

Do:
1. `/publicar` (T-107): 5 steps, photos first (A3 `POST /api/uploads` with a draft token kept in the browser),
   client-side compression, per-photo upload with retry, `localStorage` autosave, dependent brand → model
   selector from the active catalog, "no encuentro mi modelo" → `model_raw` + `model_suggestions`.
2. Fields per G-3/G-4: `contact_whatsapp` ("Solo llamadas" allows a landline via `normalizePhone(…,
   { allowLandline: true })`), `documentation_status` required for used bikes. Labels stay `[VALIDAR con un
   comercio]` in a code comment until H-9 confirms them.
3. Server submit: honeypot, 3 per IP per 24 h (counts `listings.submitted_ip`), server-side validation of every
   field, `claimUploads()`, `draft → pending_review` through `transition()`. **The final submit works without JS**
   (plain form POST; JS only enhances).
4. G-12: 0 km = one per dealer × model version; `year` optional for new bikes.
5. `/mi-aviso/<token>` (G-1, A1's `manage-token.ts`): mark sold, pause/resume, renew, edit. Photo or
   description edits → `pending_review`; price edits stay published but are logged. All server-side via
   `transition()`. `noindex`, `referrer: "no-referrer"` in its metadata (the token is in the URL), generic 404 on a bad token.

Exit: `publish.spec.ts` (mobile) publishes end to end with JS, and a no-JS submit test passes; integration tests
for the rate limit, the token actions and the re-moderation rule; verify green; PR `B4: publish flow + seller
link` merged per `prompts/_handoff.md`. Log "Codex review due (owner, §8)".

## After this phase
Spawn nothing (lane 2). End with the phase report.
