# Phase B7 — Admin CRUD: listings, dealers, catalog. SONNET session. Lane 2 (parallel with the other B phases).

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §2.2 (G-15), §4, §5.1, §5.2 (B7), §13, `docs/log/A0.md`, `A1.md`,
`ADMIN_SPEC.md` §2, §4–§6, `DATA_SEEDING.md` §5, `DATABASE_SCHEMA.md` §2.2–§2.6, §3. Execute under `BUILD_PLAN.md` §4.

Owns: `src/app/admin/publicaciones/**`, `src/app/admin/comercios/**` **except** `comercios/[id]/reporte/**` (B8's),
`src/app/admin/catalogo/**`, `src/components/admin/crud/**`, unit/integration tests, `docs/log/B7.md`.

**Lane 2 hard limits (§4.7):** no schema, no auth, no state machine, no URL/indexation rule, no CRM payload
changes. Mutations go through A1's `requireRole` + `transition()`; URLs through A2's `src/lib/seo/routes.ts`;
shared UI from `src/components/public/**` (don't edit it). Anything you need outside Owns → "Link-pass wishes" or
"Backlog" in your log, never an edit.

Branch `phase/B7` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min. When the exit criteria pass, open the PR that turn (§4.13).

Do:
1. Listings (T-115, `ADMIN_SPEC.md` §4): filterable table, search by `public_ref`/title/phone, bulk pause /
   expire / extend / CSV export, admin edit form (price change logged, photo/description change of a private
   listing → `pending_review`), timeline view (events, changes, leads, reports). State changes via `transition()`.
2. Dealers (§5): CRUD incl. `listing_ttl_days` (G-6; 30 for new dealers), **authorization block required before
   any of its stock can publish** (`DATA_SEEDING.md` §5 text, date, channel), `free_until` alert, "Baja de todo el
   stock" with confirmation. Link to B8's `/admin/comercios/[id]/reporte` for numbers; don't rebuild them.
3. Catalog (§6): brands / models / categories / cities CRUD with `is_active`, `sort_order`; slug locked after the
   first live listing (disabled field + explanation); **reserved slugs rejected** via `isReservedSlug()` (G-15);
   `[VERIFICAR]` badge. `intro_html` is edited in B10's content admin: link there, don't duplicate.
4. `model_suggestions` queue: map / create / reject; each resolution updates the affected listings.
5. Permissions per `ADMIN_SPEC.md` §2 (moderator: dealers read-only, catalog "proponer"), tested by direct POST.

Exit: integration tests: reserved slug rejected; a dealer without authorization can't get a listing to
`published`; slug immutable after publish; wrong-role POST → 403; verify green; PR `B7: admin CRUD & catalog`
merged per `prompts/_handoff.md`.

## After this phase
Spawn nothing (lane 2). End with the phase report.
