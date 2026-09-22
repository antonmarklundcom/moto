# AGENTS.md — reglas para agentes que no son Claude Code (Codex)

Codex lee este archivo en cada corrida. Las reglas del proyecto están en `CLAUDE.md`; este
archivo las resume para el worker y agrega las del proceso manager/worker. Si algo acá
contradice `CLAUDE.md` o `DECISIONS.md`, ganan ellos.

## Worker instructions

This repo is built under a manager/worker process. A Claude Code session plans and reviews;
you (Codex) implement what the dispatch prompt asks, or — for a review dispatch — write the
findings file it names and nothing else. The manager verifies by running the real thing, so
an honest report is worth more than a confident one.

- Follow the dispatch prompt exactly. Touch only the files it lists.
- Do not expand scope, refactor nearby code, or change unrelated behavior.
- If the definition of done cannot be met within the listed files, or the prompt is
  ambiguous, stop and say so. Do not guess and do not widen the change.
- Run every command the prompt lists before reporting. Do not skip, substitute, or narrow a
  step on your own judgment. A failing command is reported as FAIL with the error text.
- Never print, log, or write secrets, tokens, or API keys, including into reports,
  fixtures, or example files. If a step would require it, stop and say so.
- Report in this shape, under 30 lines: Files changed (path + one line) · Commands run
  (command + PASS/FAIL + one line) · Flagged or not done (or None). No diffs in the report.
- Do not claim completion while any definition-of-done line is unmet.

## Project rules the worker must not break (from CLAUDE.md)

1. **Nothing invented.** No fake data, counts, reviews, logos or stats in anything that can
   reach production. Never `AggregateRating`/`Review` in JSON-LD. Unknown fact →
   `[VERIFICAR: qué y dónde]`. Test data only via `npm run fixtures` (titles `[DEV]`).
2. **Visible text is Paraguayan Spanish** with voseo (*publicá*, *escribinos*), `Gs. 12.500.000`,
   phone shown `0981 123 456`, stored `+595981123456`. Main CTA: "Escribir por WhatsApp".
   Code identifiers and DB columns are English.
3. **Permissions are checked on the server.** Every mutation calls `requireRole` and scopes by
   `dealerId`/`ownerId`. Hiding a button is not a permission.
4. **Indexing rules are code.** Below-threshold programmatic pages are `noindex` and out of the
   sitemap. `SITE_NOINDEX` (`true | content | false`, ADR-26) is only changed by the owner.
5. **WhatsApp CTAs go through `/ir/wa/*`**, never straight to `wa.me`.
6. **VenderCRM:** the browser never talks to it; never send `pipeline`, `stage`, `owner`, `tag`;
   omit empty optionals; `idempotency_key` = `leadIdempotencyKey()` in `src/lib/hash.ts`
   (ADR-25); save the lead before calling the CRM.
7. **Stop instead of deciding** on anything in `PLAN.md` §4.3: new table/column, state or
   permission change, URL or indexing rule, CRM payload, price/plan, moderation or legal text,
   new external service. Legal text is never written or "improved" by an agent.
8. **Stack limits (ADR-04):** Next.js 15 + Drizzle + MySQL on a Hostinger Node slot. No
   Vercel-only features, edge/serverless assumptions, Redis, Algolia/Elasticsearch, S3, paid
   services or payment gateways. No GitHub Actions workflows (`.husky/pre-commit` blocks them).

## Commands

- `npm run verify` — typecheck + lint + unit + integration + build. Must be green before any
  report of "done". Integration tests need `TEST_DATABASE_URL` (a local MySQL database whose
  name contains `test`).
- `npm test` (unit), `npm run test:int` (integration), `npm run e2e` (Playwright, after a build).
- `npm run db:generate` only when the dispatch prompt explicitly allows a schema change.
