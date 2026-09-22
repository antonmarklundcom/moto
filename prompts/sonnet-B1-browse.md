# Phase B1 — Browse pages. SONNET session. Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (B1), §13, `docs/log/A0.md`, `docs/log/A2.md`,
`SEO_ARCHITECTURE.md` §1–§3, §8–§9, §12, `PRODUCT_SPEC.md` §3.2, §4. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/(public)/motos/page.tsx`, `motos/[brand]/page.tsx`, `motos/[brand]/ciudad/**`, `motos/tipo/**`,
`motos/ciudad/**`, `motos/nuevas/**`, `motos/usadas/**` (all under `src/app/(public)/`), `src/components/browse/**`,
`tests/e2e/browse.spec.ts`, unit tests beside the code, `docs/log/B1.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B1` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn (§4.13).

Do:
1. `/motos` listing with filters as query string (T-103): A2's faceted query, filters → `noindex,follow` + clean
   canonical, `?page=N` self-canonical, sort, honest empty state (ADR-21). Filter form works without JS.
2. The programmatic types (T-106, all but the model page): brand, brand × city, category (`tipo`), city, category
   × city, `nuevas`, `usadas`. They share ONE template in `src/components/browse/`. Build the brand page as the
   exemplar, verify it, then fan out the rest as parallel **Sonnet** subagents per `fable-directs-sonnet-builds`
   §Fan-out (never Fable). One verify, one PR.
3. Each page: live count from the DB, `intro_html` when present, A2's `isIndexable()` → robots meta, breadcrumbs,
   one `h1`. Forbidden combinations (`SEO_ARCHITECTURE.md` §2.3) and unknown or inactive slugs → 404.
4. No invented numbers: counts and price ranges come from queries; price range only with N ≥ 5.

Exit: with `npm run fixtures`, one page per type renders; a below-threshold page emits `noindex` and an
above-threshold one doesn't (with `SITE_NOINDEX=false` in the test); forbidden combo → 404; `browse.spec.ts`
(mobile) passes; one screenshot pass (≤ 5 pages × 2 widths, not committed); verify green; PR
`B1: browse pages` merged per `prompts/_handoff.md`.

## After this phase
Spawn nothing (lane 2). End with the phase report.
