# Known issues

Promoted from the phase logs by C1 (2026-09-23). One line each, owner-facing. Fixed items are removed, not struck through.

## Needs the owner
- **Hostinger proxy and `X-Forwarded-For`.** Every per-IP limit reads the value the proxy adds (`TRUSTED_PROXY_HOPS=1`). Once deployed, check the chain with `curl -H "X-Forwarded-For: 1.2.3.4" https://moto.com.py/…` and read the logged IP. If Cloudflare goes in front, set `TRUSTED_PROXY_HOPS=2`.
- **`SITE_NOINDEX`, `VENDERCRM_URL` and other env vars** are read when the app starts. Changing them in hPanel needs an app **restart**; public pages render per request, so no rebuild. `DEPLOY.md` should say so.
- **`db:migrate` runs through `tsx` (a devDependency).** Either install devDependencies on Hostinger, or run migrations from your PC against Remote MySQL.
- **Cron jobs (H-2).** Add in hPanel: `retry-leads` every 5 min, `purge-uploads` daily, `expire-featured` daily, and listing expiry daily. Each one is `curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://moto.com.py/api/cron/<job>`.
- **`/terminos` and `/privacidad`** are placeholders marked `noindex`. The texts have to come from a lawyer (`LEGAL_AND_COMPLIANCE.md` §10).
- **Guides and editorial texts** (`content/guias/`, `content/seo/`) are drafts with `[VERIFICAR]`. Nothing publishes until you resolve them and a reviewer is recorded.
- **Session invalidation on password reset** needs a new column: open question in `docs/decisions-needed.md`.

## Product and code (backlog)
- A deleted or rejected listing keeps its photo files on disk, and they stay reachable if someone has the URL. There is no orphan-file job yet. Photos a seller removes via `/mi-aviso` are deleted.
- WhatsApp click counts can be inflated by a script that fakes a browser and a Referer. Dedupe clicks per session and listing before showing numbers to dealers.
- The client can pick its own draft token (≥ 32 chars). Impact is tiny; switch to server-issued tokens when touching uploads again.
- Anyone can lock the owner's account for 15 min with 5 bad passwords. Recover with `npm run create-admin -- --reset`.
- `/api/telefono` and `/api/leads` compare `Origin` with `SITE_URL`, so they fail if the site runs on another host or port (staging with a wrong `SITE_URL`). Keep `SITE_URL` exact per slot.
- The no-JS lead form keeps the error but loses the typed values after a validation error.
- The model selector on `/motos` without JS doesn't update when the brand changes.
- There is no photo editing (upload/reorder/delete) in the admin.
- There is no expiry reminder to private sellers. `/como-funciona` doesn't promise one.
- Duplicate-photo detection always fires with local fixtures, because they share placeholder images. This does not affect real data.
- `topFinancedModels` and the moderation-queue signals are computed on every request. Cache them when volume grows.
- Blocking a phone number in moderation needs a table and the lawyer's answer (T&S §9).
- Guides are not yet linked from the listing pages' "Antes de pagar" block. Add the link once the guide is published, so it doesn't point to a 404.
- On mobile, the `/motos` filter form fills the first screen. The design pass (E1) should make the filters collapsible.
