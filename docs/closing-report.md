# Closing report — Phase 1 build (C2, 2026-09-23)

The build phases (A0–A4, B1–B10, C1, C2) are merged. What's left to launch is mostly **owner work**: hosting, the CRM key, the lawyer and dealers. Every number below was measured in this session against a local production build (`next start`, local MySQL, `npm run fixtures` plus the 30-listing demo stock). None of it was measured on Hostinger.

## Phase 1 exit criteria (`IMPLEMENTATION_PHASES.md`)

| Criterion | Status | Evidence / next step |
|---|---|---|
| ≥ 150 real listings from ≥ 5 real dealers | **Needs owner** | Business track S-A (`BUILD_PLAN.md` §7). Import is ready: `/admin/importar` (B8). |
| VenderCRM round-trip incl. duplicate test (`INTEGRATIONS.md` §2.9) | **Needs owner (H-4)** | Verified against a mock CRM: lead saved → `sent`, `duplicate:true` = success, CRM down → lead kept `pending` and retried. Real tenant and key not yet available. |
| WhatsApp click recorded before the redirect | **Met** | Integration test (`contact.int.test.ts`) and E2E `test-plan.spec.ts` §4.5: 302 to `wa.me` via `/ir/wa`, event row written. |
| Sitemap only contains threshold-passing URLs | **Met** | C1: `sitemap.int.test.ts` loads every sitemap URL through its own page loader, in all three `SITE_NOINDEX` modes. |
| Listing page: valid rich results, no `AggregateRating` | **Met in code / needs owner for Google's tool** | The JSON-LD builder throws on Review/AggregateRating (unit tests). Run Google's Rich Results Test on a live URL after deploy. |
| Performance budget (`SEO_ARCHITECTURE.md` §10) on listing page and `/motos` | **Met locally** | Lighthouse mobile (simulated 4G): table below. Listing page with 5 photos: 225 KB of images + ~180 KB of page < 500 KB. Re-measure on Hostinger (TTFB is local here). |
| Legal pages published and reviewed | **Needs owner** | `/terminos` and `/privacidad` are `noindex` placeholders. Lawyer engagement S-B. |
| Phase 0: deployed on Hostinger with `SITE_NOINDEX=true` | **Needs owner (H-1)** | `DEPLOY.md`. |

## Measurements

**Lighthouse, mobile, simulated 4G, local build**

| Page | Perf | A11y | LCP | CLS | TBT |
|---|---|---|---|---|---|
| `/` | 98 | 100 | 1.8 s | 0 | 140 ms |
| `/motos` | 99 | 100 | 1.7 s | 0 | 80 ms |
| `/motos/honda` | 99 | 100 | 2.0 s | 0 | 80 ms |
| `/motos/honda/wave` | 99 | 100 | 1.7 s | 0 | 70 ms |
| listing page | 100 | 100 | 1.9 s | 0 | 40 ms |

Local TTFB is 20–30 ms, which says nothing about Hostinger. Measure it on the live slot before deciding about Cloudflare (Q10). Fixture photos are placeholders, so re-measure LCP with real dealer photos.

**Other checks**
- **axe** (WCAG 2.1 A/AA, critical + serious): 0 violations on 10 pages, including `/publicar`, `/admin/login` and a listing page (`tests/e2e/a11y.spec.ts`).
- **E2E:** 55/55 on the mobile viewport (`npm run e2e`).
  - One run had the planilla-download test time out. It passed on its own and in the next two full runs.
  - One run had lead-limit failures after three back-to-back full runs from the same local IP. That is the real 10-per-10-min limit; restarting the server clears it.
- **Security:** headers checked against `next start`: CSP with `frame-ancestors 'none'`, HSTS, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, no `x-powered-by`.
  - Every admin/cron POST without a session returns non-2xx (`tests/e2e/security.spec.ts`).
  - The bundle scan finds no secrets (`check:bundle`).
  - The full-surface review is in `docs/review/security-2026-09-23.md`: 0 critical, the 1 high is fixed.
- **EXPLAIN, 10,000 rows:** all public queries run in ≤ 11 ms.
  - With the fixtures' 75 % live rows, `/motos`, city pages and en-cuotas use a full scan. The optimizer is right here: most rows match.
  - In the steady state (≈ 7 % live) every query uses an index (`docs/log/A2-explain.md`). A covering index would be a schema change, so it's not done.

## Open items
- `docs/decisions-needed.md`: **1 open**, invalidate sessions on password reset (recommendation A).
- Codex per-phase reviews (`BUILD_PLAN.md` §8) were replaced by the full-surface review above. A Codex/Fable pre-launch audit is still due **before `SITE_NOINDEX=false`**.
- `KNOWN-ISSUES.md` lists everything else.

## Your next 5 actions
1. **H-1 deploy:** create the Hostinger Node slot and MySQL DB, create the uploads dir outside the app, set every env var from `.env.example` (`SITE_NOINDEX=true`), then run `npm run db:migrate`, `npm run seed:catalog` and `npm run create-admin`. Steps are in `DEPLOY.md`.
2. **H-2 cron:** add the 4 hPanel cron lines (`KNOWN-ISSUES.md`).
3. **H-4 VenderCRM:** create the tenant/key for moto.com.py, set `VENDERCRM_URL`/`VENDERCRM_API_KEY`, rebuild, and send one real lead with your phone (`TEST_PLAN.md` §5).
4. **S-B lawyer:** send `LEGAL_AND_COMPLIANCE.md` §1–§8 with the extra questions in `BUILD_PLAN.md` §7. That produces `/terminos`, `/privacidad` and the financing-referral answer.
5. **S-A dealers:** list 25, call 5, get the first written authorization, and import their stock with `/admin/importar`.
