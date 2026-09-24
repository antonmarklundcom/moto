# Deploy moto.com.py on Hostinger — step by step

Everything technical runs by itself on the first start: tables, the catalog (brands, models, cities, types), your admin user, the photos folder and the background jobs. You do **not** need SSH, Remote MySQL, cron jobs, Cloudinary or any other paid service.

**What you need:** the Hostinger account with a free Node.js slot, the domain moto.com.py, and the GitHub repo `antonmarklundcom/moto`.

## 1. Create the database (5 min)

1. hPanel → **Databases → MySQL Databases**.
2. Create a database, a user and a password. **Use a password with only letters and numbers** (no `@ : / # ? ! %`), or the connection string breaks. If it already has symbols, write them encoded in `DATABASE_URL`: `!` → `%21`, `@` → `%40`, `#` → `%23`, `?` → `%3F`, `/` → `%2F`, `:` → `%3A`, `%` → `%25`.
3. Write down three things: database name, user, password. The host is `localhost` (the app runs on the same server).

You don't need Remote MySQL. It's only for connecting from your own PC, which is no longer necessary.

## 2. Create the Node.js app (5 min)

1. hPanel → **Websites → Add website → Node.js app → Import Git repository**.
2. Authorize GitHub and pick `antonmarklundcom/moto`, branch `main`.
3. Check the settings: build `npm run build`, start `npm start`, Node 20 or newer (22 recommended).
4. **Don't deploy yet.** Add the variables first (step 3).

## 3. Environment variables

In the app's **Environment variables** screen, add each one. The name goes in "Key" and **only the value** goes in "Value".

| Key | Value |
|---|---|
| `DATABASE_URL` | `mysql://USER:PASSWORD@localhost:3306/DATABASE` (the values from step 1) |
| `SITE_URL` | `https://moto.com.py` (use the temporary `…hostingersite.com` address first if the domain isn't connected yet) |
| `SITE_NOINDEX` | `false` = Google may index the site. The code still keeps thin pages out of Google automatically. |
| `SESSION_SECRET` | a random string, 40+ letters and numbers |
| `IP_HASH_SALT` | another random string, 40+ characters |
| `CRON_SECRET` | another random string, 40+ characters |
| `ADMIN_EMAIL` | your email (your login for /admin) |
| `ADMIN_PASSWORD` | your admin password, 12+ characters |
| `ADMIN_NAME` | your name |
| `WHATSAPP_SITE_NUMBER` | the site's WhatsApp number, e.g. `+595981123456` |
| `STORAGE_DRIVER` | `local` |
| `TRUSTED_PROXY_HOPS` | `1` |
| `VENDERCRM_URL` / `VENDERCRM_API_KEY` | when you have them. Until then, leads are saved and sent automatically later. |
| `GOOGLE_SITE_VERIFICATION` | optional, see step 7 |

Random strings: use a password generator (your browser or password manager). Letters and numbers only, 40 or more characters. Each secret should be different.

**Leave out:** `TEST_DATABASE_URL`, `ALLOW_DEV_FIXTURES`, `STORAGE_LOCAL_PATH` (photos go to `~/moto-uploads` by themselves) and the `SMTP_*` settings (not used).

## 4. Deploy

Click **Deploy**. On the first start the app:

1. creates all the tables,
2. loads the catalog,
3. creates your admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`,
4. creates the photos folder,
5. starts the background jobs. These resend leads to the CRM every 5 minutes, expire old listings, end featured listings and clean up abandoned uploads. This replaces the cron jobs, so you don't need to set up any.

Nothing is created twice when the app restarts.

## 5. Connect the domain

1. Point moto.com.py at the app (hPanel → the app → Domains; if DNS is elsewhere, add the A/CNAME record Hostinger shows you). SSL is automatic.
2. If you started with the temporary address, change `SITE_URL` to `https://moto.com.py` and **deploy again**. Some settings are fixed at build time.
3. `www.moto.com.py` redirects to `moto.com.py` by itself.

## 6. Check that it works (5 min)

1. Open **https://moto.com.py/api/health**. It should say `"ok": true`. If not, it says what's wrong in plain words (see "If something breaks").
2. Open https://moto.com.py. The home page loads.
3. Go to https://moto.com.py/admin/login and log in with your email and password.
4. **Salud del sitio:** after 1–2 minutes, the jobs show "succeeded".
5. **Configuración:** check that every variable shows "Cargada".
6. Security: after your first login you can delete `ADMIN_PASSWORD` from hPanel. Nothing depends on it anymore.

## 7. Get found on Google (10 min)

1. **Publish the guides:** /admin/contenido → **Cargar borradores de content/guias**. For each guide:
   - open it and read it,
   - set **Estado: Publicada** and **Revisada por: you**,
   - click **Guardar**.
   10 guides are ready. Two ("Cómo transferir una moto" and "Qué papeles tiene que tener una moto") still have `[VERIFICAR]` facts to confirm and can't be published until they're fixed.
2. **Google Search Console** (free): https://search.google.com/search-console
   - Add the property `moto.com.py`.
   - Verify it by DNS, or with the HTML tag: copy only the `content="…"` value into `GOOGLE_SITE_VERIFICATION` and deploy again.
   - Under **Sitemaps**, submit `https://moto.com.py/sitemap.xml`.
3. **Google Business Profile** (optional, free): helps with brand searches.

Brand, city and type pages get into Google automatically once they have enough real listings and text (`SEO_ARCHITECTURE.md` §2.1). The admin's **Contenido → Textos de páginas** screen shows which pages are indexable and what's missing.

## 8. After launch

- **VenderCRM:** add the URL and key, deploy again, then send one real lead with your phone from /financiacion.
- **Dealers:** import their stock at /admin/importar. Each dealer needs a written authorization.
- **Legal:** a lawyer writes /terminos and /privacidad (they're placeholders marked `noindex` until then).

## If something breaks

- **"Algo salió mal" / "Application error" page:** open **https://moto.com.py/api/health** first. It shows, without any passwords:
  - `database.ok` and, if false, a `code` and a `hint` with what to fix. `ER_ACCESS_DENIED_ERROR` = wrong user or password in `DATABASE_URL`; `ER_BAD_DB_ERROR` = wrong database name; `ECONNREFUSED` = wrong host (use `localhost`).
  - `boot.steps`: each setup step (migrations, catalog, admin) with `ok: true/false`. If the database wasn't ready, the app retries by itself (30 s, 1 min, 2 min… up to every 10 min). You don't need to redeploy for that.
  - `env`: which variables are set and look valid (`true`/`false`, never the values).
  More detail: hPanel → the app → **Runtime logs**, lines starting with `boot:`.
- **Tables, migrations and the guide texts are built into the app.** They don't depend on which folders Hostinger copies to the server.
- **Database errors:** usually a wrong password in `DATABASE_URL`. Fix it in hPanel and deploy again (a restart isn't enough).
- **Forgot the admin password, or the account is locked:** a lock lifts by itself after 15 minutes. To set a new password:
  1. In hPanel, set `ADMIN_EMAIL` (your email), `ADMIN_PASSWORD` (the new password) and `ADMIN_PASSWORD_RESET=true`.
  2. Deploy again and log in.
  3. Delete `ADMIN_PASSWORD_RESET` and `ADMIN_PASSWORD`.
- **To turn off the automatic setup or jobs:** `AUTO_SETUP=false` or `INTERNAL_CRON=false`. The old way still works: `POST /api/cron/<job>` with `Authorization: Bearer <CRON_SECRET>`.
