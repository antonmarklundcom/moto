# Phase B3 — Listing detail. OPUS session (filename prefix is historical, `BUILD_PLAN.md` §5.1). Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (B3), §13, `docs/log/A0.md`, `A2.md`, `A3.md`,
`A4.md`, `PRODUCT_SPEC.md` §2.1, §2.4, §3.3, `SEO_ARCHITECTURE.md` §4–§6, §12, `TRUST_AND_SAFETY.md` §5, §7,
`INTEGRATIONS.md` §1. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/(public)/aviso/**`, `src/app/api/reportes/**`, `src/components/listing/**`,
`tests/e2e/detail.spec.ts`, unit/integration tests beside the code, `docs/log/B3.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B3` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn (§4.13).

Do:
1. `/aviso/<slug>-<ref>` (T-104) in mobile order: photos (A3 loader, catalog photos labelled), title, price
   (`Price`/`FinancingLine`), key facts, documentation status (G-4), "Escribir por WhatsApp" via `/ir/wa/*`
   (A4), or "Llamar" + phone reveal when `contact_whatsapp=false`; the number never in the initial HTML.
2. States per `SEO_ARCHITECTURE.md` §4 exactly: sold (visible, marked, indexable 90 days), expired
   (`noindex,follow`), wrong slug with the right ref → 301 to the canonical URL, removed → 410.
3. Buyer-safety block (`TRUST_AND_SAFETY.md` §7), verbatim facts, no promises.
4. "Compartir por WhatsApp" records a `share` event (A2's events lib).
5. Report form + `POST /api/reportes` (T-118 public side): honeypot, reason codes of §5, 5 reports per IP hash
   per day; **3 `estafa`/`robada` reports auto-pause the listing via `transition()`** (system actor).
6. `view` event per page view (bots flagged, never counted in public numbers).

Exit: `detail.spec.ts` (mobile) covers published / sold / expired / 301 / 410 and the WhatsApp CTA going through
`/ir/wa`; integration test for the auto-pause rule and the report rate limit; one screenshot pass; verify green;
PR `B3: listing detail` merged per `prompts/_handoff.md`.

## After this phase
Spawn nothing (lane 2). End with the phase report.
