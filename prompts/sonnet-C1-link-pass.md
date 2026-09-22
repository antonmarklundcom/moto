# Phase C1 — Link pass, sitemaps, robots, nav, known issues. SONNET session. Sequential, after all of lane 2.

Read ONLY: this file, `CLAUDE.md`, `BUILD_PLAN.md` §1, §4, §5.1, §5.2 (C1), §13, `docs/log/A2.md`, and from every
`docs/log/B*.md` only its "Link-pass wishes" and "Known issues" sections. Specs: `SEO_ARCHITECTURE.md` §3.4, §7–§8,
§12, `DECISIONS.md` ADR-26. Execute under the protocol `BUILD_PLAN.md` §4.

Owns: `src/app/sitemap.xml/**`, `src/app/sitemaps/**`, `src/app/robots.txt/**`, `src/components/public/nav*`,
`KNOWN-ISSUES.md`, the exact cross-link edits listed under "Link-pass wishes" in the B logs (one small edit each,
in the file the wish names), `docs/log/C1.md`.

Same limits as lane 2 (`BUILD_PLAN.md` §4.7): no schema, auth, state machine, URL/indexation rule or CRM change. A
wish that needs one of those goes to `KNOWN-ISSUES.md`, not into code.

Branch `phase/C1` off latest `main` (or the branch the harness assigned). WIP commit every 30 min. Re-runnable.
Budget: one session, ≤ 90 min.

Do:
1. Sitemaps (T-112, `SEO_ARCHITECTURE.md` §7): index + segmented children, ≤ 5,000 URLs each, real `lastmod` from
   `updated_at`, no priority/changefreq. **Every URL passes A2's `isIndexable()` and `globalIndexingAllows()`**:
   with `SITE_NOINDEX=true` the sitemap is empty or absent; with `content` only `content.xml` has URLs. A test
   asserts no `noindex` URL ever appears, in all three modes.
2. `robots.txt` exactly per §3.4, with `Sitemap:` built from `SITE_URL`.
3. Nav and cross-links per §8: never link a below-threshold page from the main nav (only from contextual filters).
   Apply the lane 2 wishes; skip and log any that conflict with §8.
4. `KNOWN-ISSUES.md`: promote the still-open, cross-phase items from the phase logs. One line each, owner-facing.

Exit: sitemap tests green in the three modes; XML validates; `robots.txt` matches §3.4; nav contains no
below-threshold link with fixtures loaded; verify green; PR `C1: link pass + sitemaps` merged per
`prompts/_handoff.md`.

## After this phase
Follow `prompts/_handoff.md`. Next: `prompts/opus-C2-hardening.md`, model Opus (`claude-opus-5-5`).
