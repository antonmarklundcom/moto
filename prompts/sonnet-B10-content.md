# Phase B10 — Content admin, guides, static pages. OPUS session (filename prefix is historical, `BUILD_PLAN.md` §5.1). Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (B10), §13, `docs/log/A0.md`, `A1.md`, `A2.md`,
`CONTENT_STRATEGY.md` (all), `ADMIN_SPEC.md` §9, `PRODUCT_SPEC.md` §3.6–§3.7, `LEGAL_AND_COMPLIANCE.md` §8, §10,
`SEO_ARCHITECTURE.md` §2.1, §6, §12, `DECISIONS.md` ADR-26. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/(public)/guias/**`, `como-funciona/**` (replaces A2's stub), `terminos/**`, `privacidad/**` (all under
`src/app/(public)/`), `src/app/admin/contenido/**`, `content/**`, unit/integration tests, `docs/log/B10.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B10` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn (§4.13).

Do:
1. Content admin (`ADMIN_SPEC.md` §9): `posts` CRUD draft → review → published; **`reviewed_by` enforced
   server-side** (a direct POST publishing without a reviewer → 400, tested). `intro_html` editor for brands,
   models, categories, cities with the live count and a live **indexable / noindex** indicator from A2's
   `isIndexable()` (this is the only place `intro_html` is edited). HTML sanitised on save.
2. `/guias` + `/guias/:slug` from published posts only; `Article` JSON-LD via A2; robots via
   `globalIndexingAllows("content")` (ADR-26). `/como-funciona` honest copy per `PRODUCT_SPEC.md` §3.7.
3. **10 guide drafts** (`CONTENT_STRATEGY.md` §2.3) as `content/guias/<slug>.md` + an admin action that loads
   them as `posts` in `draft`. Write guide 1 yourself as the exemplar, then fan out the other 9 as parallel
   **Opus** subagents per `fable-directs-sonnet-builds` §Fan-out (never Fable). Every procedure, fee, office
   or legal fact is marked `[VERIFICAR: fuente]`; nothing invented; voseo. They stay drafts: publishing needs a human.
4. `/terminos` and `/privacidad`: placeholder page "Texto en revisión legal" + contact. **No legal text written**
   (`LEGAL_AND_COMPLIANCE.md` §10). `noindex` until the owner replaces them.

Exit: integration test for the `reviewed_by` rule; the 10 drafts exist with every factual claim sourced or
marked; indicator matches `isIndexable()` at a threshold edge (test); one screenshot pass; verify green; PR
`B10: content & static pages` merged per `prompts/_handoff.md`.

## After this phase
Spawn nothing (lane 2). End with the phase report.
