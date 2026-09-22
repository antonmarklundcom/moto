# Phase B2 — Model pages, en-cuotas, home. SONNET session. Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §2.2 (G-9, G-10), §4, §5.1, §5.2 (B2), §13, `docs/log/A0.md`,
`docs/log/A2.md`, `DECISIONS.md` ADR-20, ADR-21, `PRODUCT_SPEC.md` §3.1, §3.5, `SEO_ARCHITECTURE.md` §2, §6, §12,
`LEGAL_AND_COMPLIANCE.md` §3, `CONTENT_STRATEGY.md` §1.5. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/(public)/motos/[brand]/[model]/**`, `src/app/(public)/motos/en-cuotas/**`, `src/app/(public)/page.tsx`
+ delete `src/app/page.tsx` (the Phase 0 placeholder; two pages can't both own `/`), `src/components/financing-compare/**`, `tests/e2e/home-model.spec.ts`,
unit tests beside the code, `docs/log/B2.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B2` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn (§4.13).

Do:
1. **Financing comparison block (ADR-20, G-9):** one row per dealer offering the model: contado, entrega,
   cuotas × monto, link to the listing, "informado por el comercio" on every row. Real rows only; < 2 dealers →
   single-offer view, never padding. **No cuota computed by the site** (`LEGAL_AND_COMPLIANCE.md` §3.1).
2. Model page (`/motos/:brand/:model`, T-106 model part): listings, comparison block, price range only with
   N ≥ 5, indexability via A2, `Product`/`Offer` JSON-LD via A2's builders (never Review/AggregateRating).
3. `/motos/en-cuotas`: listings with installments, the comparison block per model, threshold 10 + 400 words.
4. Home (T-120, G-10): hero "¿Cuánto podés pagar por mes?" (cuota máxima + entrega máxima → `/motos?cuota_max=…`),
   brand/city search second, recent real listings, honest empty state. No counts that aren't queried.

Exit: with fixtures, a model with ≥ 2 dealers shows ≥ 2 rows and one with 1 dealer shows the single-offer view;
no computed cuota anywhere (test greps the component output); `home-model.spec.ts` passes; one screenshot pass;
verify green; PR `B2: model pages, en-cuotas, home` merged per `prompts/_handoff.md`.

## After this phase
Spawn nothing (lane 2). End with the phase report.
