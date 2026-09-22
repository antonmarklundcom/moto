# Phase B5 — Financing, insurance, dealers, contact. SONNET session. Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (B5), §13, `docs/log/A0.md`, `A2.md`, `A4.md`,
`PRODUCT_SPEC.md` §2.3, §3.4–§3.5, §3.7, §6, `LEGAL_AND_COMPLIANCE.md` §3, `TRUST_AND_SAFETY.md` §6,
`CONTENT_STRATEGY.md` §1.4–§1.5, `SEO_ARCHITECTURE.md` §6, §12. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/(public)/financiacion/**`, `seguros/**`, `gracias/**`, `comercios/**`, `contacto/**` (all under
`src/app/(public)/`), `src/components/lead-forms/**`, `tests/e2e/financing.spec.ts`, unit tests, `docs/log/B5.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B5` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn (§4.13).

Do:
1. `/financiacion` and `/seguros`: landing + form posting to A4's lead handler (types `financing`,
   `insurance`). The mandatory disclaimer of `LEGAL_AND_COMPLIANCE.md` §3 **verbatim**, next to the form. The
   site derives; it never approves, promises or computes credit. Honeypot, `label` on every input, errors in
   Spanish, works without JS.
2. `/gracias`: honest next step ("te escribimos por WhatsApp…" only if that is what happens), `noindex`.
3. `/comercios` index + `/comercios/:slug`: real dealers only (`status = active`), their live listings,
   `AutoDealer` JSON-LD via A2's builders. The verified badge shows only with `is_verified` and its literal
   explanation from `TRUST_AND_SAFETY.md` §6. No logo without authorization (ADR-12).
4. `/comercios` also carries the dealer-plan inquiry form (type `dealer_plan`) and `/contacto` the general and
   advertising ones (`general`, `advertising`), all through A4's handler.
5. Copy: voseo, "Escribir por WhatsApp", no "más de X", no "N°1" (`PLAN.md` §5).

Exit: `financing.spec.ts` (mobile) submits a financing lead against the mock CRM and lands on `/gracias`; the
disclaimer text matches the spec byte for byte (unit test); dealer page JSON-LD has no Review/AggregateRating;
one screenshot pass; verify green; PR `B5: financing, insurance, dealers` merged per `prompts/_handoff.md`.

## After this phase
Spawn nothing (lane 2). End with the phase report.
