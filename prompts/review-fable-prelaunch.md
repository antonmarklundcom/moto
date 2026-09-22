# Fable pre-launch audit — paste into a Fable session YOU open (`BUILD_PLAN.md` §8, §9 gate G-index)

When: after C2, **before** `SITE_NOINDEX` becomes `content` or `false`. This is the irreversible step: Google's
first impression of the domain. Worth it: high. You need the live staging or production URL at hand.

---

Pre-launch audit of moto.com.py. Live URL: `<paste the staging or production URL>`. Repo:
`antonmarklundcom/moto` on latest `main`. Read `CLAUDE.md`, `PLAN.md` §5, `BUILD_PLAN.md` §3, §9,
`SEO_ARCHITECTURE.md` §2, §4, §6–§8, `LEGAL_AND_COMPLIANCE.md` §3, §8, `docs/closing-report.md`, `KNOWN-ISSUES.md`.

Check on the **live** site (fetch the pages; don't trust the code alone):
1. Anti-fabrication (`PLAN.md` §5): every number on screen comes from a query; no demo listings, no `[DEV]`
   titles, no invented dealers, logos, ratings or urgency; empty states honest.
2. Indexation actually enforced: sample 10 programmatic URLs on both sides of each §2.1 threshold, check robots
   meta, canonical, and presence in the sitemaps; a `noindex` URL must never be in a sitemap.
3. JSON-LD on home, listing, model, dealer, guide: valid, and never `Review` or `AggregateRating`.
4. Trust copy and the financing disclaimer: placement and wording vs. `LEGAL_AND_COMPLIANCE.md` §3; legal pages
   are the lawyer-approved text, not placeholders.
5. Sold/expired/410/301 behaviour on real examples; `/ir/wa` redirect works; phone never in initial HTML.
6. Performance: one mobile Lighthouse run on home and one listing.

Rules: read and fetch once, no polling, no spawning, no messages to running sessions. Output
`docs/review/prelaunch-fable.md`: a go / no-go with each blocker listed (file or URL + fix), committed on a
branch `review/prelaunch`, PR opened, end. The owner decides and changes `SITE_NOINDEX`.
