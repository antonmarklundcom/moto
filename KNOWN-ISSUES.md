# Known issues

Promoted from the phase logs by C1 (2026-09-23). One line each, owner-facing. Fixed items are removed, not struck through.

## Needs the owner
- **Hostinger proxy and `X-Forwarded-For`.** Every per-IP limit reads the value the proxy adds (`TRUSTED_PROXY_HOPS=1`). Once deployed, check the chain with `curl -H "X-Forwarded-For: 1.2.3.4" https://moto.com.py/…` and read the logged IP. If Cloudflare goes in front, set `TRUSTED_PROXY_HOPS=2`.
- **Env vars and restarts/builds.** `SITE_NOINDEX` is read per request: change it in hPanel, then **restart** the app. `VENDERCRM_URL` also feeds the security headers (CSP), which are computed at **build**: set it before the build, and rebuild if it changes.
- **`db:migrate` runs through `tsx` (a devDependency).** Either install devDependencies on Hostinger, or run migrations from your PC against Remote MySQL.
- **Cron jobs (H-2).** Add in hPanel: `retry-leads` every 5 min, `purge-uploads` daily, `expire-featured` daily, and listing expiry daily. Each one is `curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://moto.com.py/api/cron/<job>`.
- **`/terminos` and `/privacidad`** are placeholders marked `noindex`. The texts have to come from a lawyer (`LEGAL_AND_COMPLIANCE.md` §10).
- **Guides and editorial texts** (`content/guias/`, `content/seo/`) are drafts with `[VERIFICAR]`. Nothing publishes until you resolve them and a reviewer is recorded.
- **Session invalidation on password reset** needs a new column: open question in `docs/decisions-needed.md`.

## Product and code (backlog)
- Photos of deleted or rejected listings are still reachable by URL for 30 days; then the daily `purge-removed-photos` job deletes the files. The rows stay, since moderation uses their hash to spot repeated photos. Blocking them in `/media` right away would need an index on `listing_images.storage_path` (schema change). Admin pages show those old photos as broken images.
- The client can pick its own draft token (≥ 32 chars). Impact is tiny; switch to server-issued tokens when touching uploads again.
- Anyone can lock the owner's account for 15 min with 5 bad passwords. Recover with `npm run create-admin -- --reset`.
- `/api/telefono` and `/api/leads` compare `Origin` with `SITE_URL`, so they fail if the site runs on another host or port (staging with a wrong `SITE_URL`). Keep `SITE_URL` exact per slot.
- The model selector on `/motos` without JS doesn't update when the brand changes.
- The admin can delete, reorder and pick the cover photo, but not upload new photos. Photos come from /publicar, /mi-aviso or /admin/importar.
- There is no expiry reminder to private sellers. `/como-funciona` doesn't promise one.
- Duplicate-photo detection always fires with local fixtures, because they share placeholder images. This does not affect real data.
- `topFinancedModels` and the moderation-queue signals are computed on every request. Cache them when volume grows.
- Blocking a phone number in moderation needs a table and the lawyer's answer (T&S §9).
- Guides are not yet linked from the listing pages' "Antes de pagar" block. Add the link once the guide is published, so it doesn't point to a 404.
- On mobile, the `/motos` filter form fills the first screen. The design pass (E1) should make the filters collapsible.
