# Phase R0 — Research: catalog, competitors, vocabulary. OPUS session (web) (filename prefix is historical, `BUILD_PLAN.md` §5.1). Lane 0, runs in parallel with lane 1.

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §2.0 (F-10), §2.2 (G-16, G-17), §4, §5.2 (R0), §13,
`DATABASE_SCHEMA.md` §2.4–§2.5, `CONTENT_STRATEGY.md` §1.2, `src/db/seed-data/*`. Nothing else.
Execute under the autonomy protocol `BUILD_PLAN.md` §4. No code outside seed data.

Owns: `docs/research/**`, `src/db/seed-data/**`, `docs/log/R0.md`. Nothing else, not even `scripts/`.

Branch `phase/R0` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.

Do:
1. **Catalog (G-16, F-10).** Re-verify every brand and model from sources you actually open: importer and
   official Paraguayan sites, dealer sites, Paraguayan press. Honda first: all its models are inactive because
   hondamotos.com.py blocked the earlier session. Try it again and cite what loads. Add brands and models the
   entry segment carries in Paraguay **only with a source**. Every addition gets a source comment (URL + access
   date 2026-09-xx); anything unconfirmed stays `isActive: false` with a `[VERIFICAR: …]` note. Keep slugs
   stable (never rename an existing slug), never use a reserved slug (`src/lib/slug.ts` `RESERVED_SLUGS`).
   Fill `engineCc` only from a source. Assigning `categoryId` needs a seed change in `scripts/` that you don't
   own: list the proposed model → category mapping in `docs/research/catalog.md` instead.
2. **`docs/research/competitors.md` (G-17):** who lists motos in Paraguay (general classifieds, importer and
   dealer sites, Facebook Marketplace/groups as observed from public pages). Per competitor: URL, access date,
   what it shows (cuotas? entrega? dealer comparison? photos? phone/WhatsApp?), page speed if you can measure
   it, whether its listings look indexed. **No traffic or market-share numbers unless publicly sourced.**
3. **`docs/research/vocabulary-check.md`:** the UI terms of `CONTENT_STRATEGY.md` §1.2, the category names (e.g.
   "Naked", "Cub" are unvalidated), and the G-4 documentation labels (`al_dia`, `transferencia_pendiente`,
   `no_declara`), each with the candidate wording and a checkbox, for the owner's first dealer call (H-9).
4. Run `npm run seed:catalog` twice on `moto_dev` and on `TEST_DATABASE_URL`: idempotent, no errors.
   Run `npm run verify`.

Exit: every active brand/model has a cited source; the three docs are committed; seeds re-run cleanly; verify
green; PR `R0: research` merged per `prompts/_handoff.md` (gates 1, 2 and 4; gate 3 = one re-read of the diff).

## After this phase
Spawn nothing. End with the phase report (what changed in the catalog, top 3 competitor facts, open [VERIFICAR]s).
