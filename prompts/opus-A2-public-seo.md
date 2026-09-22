# Phase A2 — Public skeleton + SEO core. OPUS session. Lane 1 (after A1).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (A2), §13, `docs/log/A0.md`, `docs/log/A1.md`,
`SEO_ARCHITECTURE.md` §1–§3, §6, §9, §12, `PRODUCT_SPEC.md` §4–§5, `ANALYTICS_AND_KPIS.md` §2.1,
`DECISIONS.md` ADR-26. Execute under the autonomy protocol `BUILD_PLAN.md` §4. Build nothing outside the plan.

Owns: `src/lib/listings/query.ts`, `src/lib/listings/filters.ts`, `src/lib/seo/**`, `src/lib/events.ts`,
`src/components/public/**`, `src/app/(public)/layout.tsx`, `src/app/layout.tsx`, one stub page to prove the
shell (`src/app/(public)/como-funciona/page.tsx` placeholder, B10 replaces it), tests, `docs/log/A2.md`.

Branch `phase/A2` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.

Do:
1. Faceted query (T-101): filters → one parametrised Drizzle query, live = `SEO_ARCHITECTURE.md` §2.1 definition,
   `deleted_at IS NULL`, stable pagination. Free text: FULLTEXT for ≥ 3-char terms, `LIKE` on title/model below
   that (F-11). `npm run fixtures`, then scale to ~10k rows in `moto_dev` and commit the `EXPLAIN` of the 5
   main queries to the log.
2. Indexability (T-102): `isIndexable(pageType, liveCount, editorialWords)` at the exact §2.1 edges, combined
   with `globalIndexingAllows()` from `src/lib/env.ts` (ADR-26). Tests at every edge (N-1, N) per page type.
3. **Route contract** `src/lib/seo/routes.ts`: the only place public URLs are built (listing
   `/aviso/<slug>-<ref>` with `publicRef` lowercased, brand, model, city, category, combos, en-cuotas, pages).
   Canonical + robots builder: filters → `noindex,follow` + clean canonical; `?page=N` self-canonical; §2.3
   forbidden combos → `notFound()`. Reserved slugs from `src/lib/slug.ts` (G-15).
4. JSON-LD builders (§6) with a test that fails if `Review` or `AggregateRating` ever appears.
5. `src/lib/events.ts`: record `listing_events` with session hash, HMAC IP hash, UA hash, bot heuristic
   (`ANALYTICS_AND_KPIS.md` §2.1). Never throws into the page.
6. Public shell: header, footer, breadcrumbs (+ JSON-LD), skip link; shared `ListingCard`, `Price`
   (`formatGuaranies`), `FinancingLine` ("informado por el comercio"), `EmptyState` (ADR-21 CTA via
   `/ir/wa/general`). Semantic HTML, one `h1`, focus visible, 44 px targets, AA contrast (`CLAUDE.md` §5).
7. Root layout keeps ADR-26 behaviour; content pages get `robots` from `globalIndexingAllows("content")`.
   Consider making inventory pages dynamic so a `SITE_NOINDEX` change needs no rebuild; log the choice.

Exit: unit + integration green; the stub page renders with one `h1`, correct canonical and robots in all three
`SITE_NOINDEX` modes (test); `EXPLAIN` in the log; verify green; PR `A2: public skeleton + SEO core` merged
per `prompts/_handoff.md`.

## After this phase
Follow `prompts/_handoff.md`. Next: `prompts/opus-A3-media.md`, model Opus (`claude-opus-5-5`).
