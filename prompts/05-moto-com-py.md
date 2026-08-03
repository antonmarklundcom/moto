# PROMPT 5 — moto.com.py (improved, paste-ready)

> Paste everything between the `===` markers into a fresh Claude Opus 5 / Claude Code project.
> The "Improvements made" section at the bottom is for you, not for Claude — don't paste it.

===

You are Claude Opus 5 acting as **product architect, marketplace strategist, SEO strategist, monetization strategist, and principal engineer**. You are the *decision-maker* on this project. Sonnet 5 and Codex will implement later from the documents you produce, and they will not have your reasoning — only your files. Write for them.

## Project

- **Domain:** moto.com.py
- **Market:** Paraguay (national, with city-level SEO depth)
- **Language:** Spanish, Paraguayan register (voseo where natural, `Gs.` for currency, local vocabulary: *moto*, *cuotas*, *chapa*, *transferencia*, *taller*, *repuestos*, *seguro contra terceros*). Not neutral LatAm Spanish, not Spain Spanish.
- **Owner context:** I own a portfolio of `.com.py` domains and a CRM product (**VenderCRM**). Leads from this site must eventually land in VenderCRM. Hosting is Hostinger (managed Node.js slots, MySQL available); I have a proven Next.js 15 + Drizzle + MySQL stack running in production on it.
- **Business goal:** a motorcycle marketplace for Paraguay. Free listings first to build inventory, then monetize via featured listings, dealer subscriptions, direct ad placements, financing and insurance lead referral, and eventually selling my own motorcycles/parts.

## Hard rule: do not write application code in this session

This session produces **planning and specification documents only**. No components, no schema migrations, no route handlers, no `package.json`. Illustrative snippets are allowed **only** where prose would be ambiguous (a table definition, a URL pattern, a JSON payload shape) and must be clearly marked as illustrative. If you feel the urge to start building, that is the signal that a spec is still under-specified — go specify it.

## Step 0 — Ask before you decide

Before writing any document, ask me **up to 8 numbered questions** whose answers would change your architecture, MVP scope, or monetization plan. Prioritise questions where different answers lead to materially different builds (e.g. do I have dealer relationships already? do I have budget for paid traffic? do I want user accounts at all in v1?). Then **stop and wait for my answers.** Do not proceed on assumptions.

If I tell you to proceed anyway, state your assumptions explicitly in `DECISIONS.md` and continue.

## Step 1 — Critique before you commit

Open `PLAN.md` with an honest assessment, not a sales pitch. Cover:

1. **Is a motorcycle classifieds site in Paraguay actually a good business?** Argue the case *against* it first: Facebook Marketplace and WhatsApp groups own the informal C2C flow, incumbents already rank for generic queries, and classifieds are a cold-start problem — no listings means no traffic means no listings. Then say what the defensible wedge actually is, if there is one. If your honest conclusion is that the C2C consumer marketplace is the wrong entry point and the site should launch as a **dealer inventory + financing lead portal** instead, say so plainly and build the plan around that.
2. **Stack critique.** Compare Next.js 15 (App Router) + Drizzle + MySQL against PHP/MySQL for *this specific* product. Do not default to Node because it is fashionable. Justify it on concrete functions or reject it. Candidate justifications to evaluate: faceted search over structured inventory; image upload + transform pipeline; seller/dealer auth with row-scoped permissions; ISR / on-demand revalidation for thousands of DB-generated SEO pages; programmatic sitemap generation; server-side lead forwarding to VenderCRM; a moderation queue. Also name the cost: a Hostinger Node slot, build complexity, and a harder handoff than PHP. **State a single verdict and stop hedging.**
3. **Cold-start reality.** How does the site have inventory on day one *without fabricating it*? Options to evaluate: signed agreements with 5–15 dealers to publish their stock, importing dealer inventory with written permission, manual seeding of my own units, paying for the first 100 listings. Rank them by realism.

## Step 2 — Produce these documents

Create every file below in the repo root (or `/docs`, your call — state which and be consistent).

**Core (from my original brief):**
- `PLAN.md` — critique, verdict, strategy, the one-paragraph "what this site is"
- `PRODUCT_SPEC.md` — user roles, flows, screen-by-screen behaviour, empty states, error states
- `SEO_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `ADMIN_SPEC.md`
- `MONETIZATION.md`
- `IMPLEMENTATION_PHASES.md`
- `CLAUDE_TASKS.md`

**Added — produce these too, they matter more than they sound:**
- `DECISIONS.md` — a numbered ADR log. Every non-obvious choice: decision, alternatives rejected, why, and what would make us revisit it. This is the single most valuable file for future sessions.
- `TRUST_AND_SAFETY.md` — vehicle classifieds attract fraud. Scam patterns (fake "estoy en el exterior, te envío la moto", stolen units, price-bait, duplicate listings), moderation policy, what is checked before publish, reporting flow, what we explicitly do *not* verify and how we say that honestly to users. Include how we handle a listing for a motorcycle with pending *chapa*/transfer issues.
- `DATA_SEEDING.md` — the cold-start plan, concretely. Who is contacted, what they get for free, what data is collected, what the permission wording is.
- `CONTENT_STRATEGY.md` — editorial plan and the Paraguayan Spanish style guide (tone, voseo usage, currency format `Gs. 12.500.000`, date format, how to write about financing without giving financial advice). Include the first 20 article briefs with target query, intent, and internal-link targets.
- `INTEGRATIONS.md` — WhatsApp deep links, VenderCRM, analytics, payments. Exact payload shapes.
- `ANALYTICS_AND_KPIS.md` — what a "lead" is, what events fire, what the weekly dashboard shows, and what number tells me to kill the project.
- `LEGAL_AND_COMPLIANCE.md` — terms of use, disclaimer that we are a listing platform and not party to any sale, personal-data handling under Paraguay's data protection law (Ley N° 6534/2020 — flag that this must be confirmed with a Paraguayan lawyer, do not assert legal conclusions), and rules for advertising financing/insurance products.
- `TEST_PLAN.md` — what must be verified before each phase ships, including the VenderCRM round-trip and the "does a WhatsApp click actually get counted" check.

## Step 3 — Requirements each document must satisfy

### SEO_ARCHITECTURE.md
- Full URL taxonomy with real example URLs. Spanish slugs.
- The programmatic surface: brand × model × year, brand × city, category (`scooter`, `enduro`, `naked`, `cub/110`, `motocarro/triciclo de carga`), price band. **Define which combinations get an indexable page and which are `noindex,follow`.** The failure mode here is 40,000 thin pages — give an explicit rule (e.g. minimum live listings on the page, minimum unique content) and an automatic de-indexing rule when a page falls below it.
- Canonical strategy for filtered/sorted/paginated views. Facet parameter handling.
- City list with justification, not a copy-paste: Asunción, Ciudad del Este, San Lorenzo, Luque, Capiatá, Lambaré, Fernando de la Mora, Encarnación, Pedro Juan Caballero, Coronel Oviedo — plus how a city page stays useful when it has 3 listings.
- JSON-LD: `Vehicle`/`Product` + `Offer` on listings, `ItemList` on category pages, `BreadcrumbList`, `Organization`, `FAQPage` on guides. **Never emit `AggregateRating` or `Review` markup we haven't genuinely collected.**
- Sitemap architecture (index + segmented children), `hreflang` not needed, `robots.txt` rules, internal linking model, expired-listing handling (410 vs 301 vs keep-with-`sold` state — decide and justify; expired listings are one of the biggest SEO assets and biggest liabilities in classifieds).
- What to do about the fact that a listing page's content is user-generated and often two lines long.

### DATABASE_SCHEMA.md
- MySQL, Drizzle-flavoured. Every table: columns, types, nullability, indexes, foreign keys, and *why* each index exists.
- Must include at minimum: `users` (with a `role` enum from day one — `admin | moderator | dealer | seller`), `dealers`, `listings`, `listing_images`, `brands`, `models`, `cities`, `categories`, `listing_events` (view / whatsapp_click / phone_reveal), `leads`, `featured_purchases`, `ad_placements`, `posts`, `activity_log`, `reports` (user-submitted abuse reports).
- Listing lifecycle as an explicit state machine: `draft → pending_review → published → paused → sold → expired → rejected`, with who can perform each transition.
- Decide now: how are brands/models normalised? Free-text model fields destroy faceted SEO. Specify the seeded brand/model catalogue (Honda, Yamaha, Suzuki, Kenton, Leopard, Star, Taiga, Chacomer-distributed marks, etc. — verify actual market presence rather than guessing, and mark anything you could not verify).
- Money: store `price_gs` as an integer in guaraníes (no decimals, no floats). Say so.
- Soft deletes, `created_at/updated_at/updated_by`, and slug uniqueness strategy.

### ADMIN_SPEC.md
- Every admin screen, the role that can see it, and the actions available.
- Moderation queue is the core screen — design it for speed (keyboard-driven approve/reject with reason codes).
- Manual monetization controls: mark a dealer as paid, set a plan expiry, feature a listing for N days, place an ad — because in Paraguay v1 payment will be bank transfer or Tigo Money confirmed by a human, not an automated gateway.
- Server-side permission enforcement on every mutation, not hidden buttons. Scoped access: a dealer edits only their own listings.
- Content management for posts, static pages, brand/city page intro copy.

### MONETIZATION.md
Be realistic about Paraguay and say the uncomfortable parts out loud:
- Rank each revenue line by **realism × effort × time-to-first-guaraní**: dealer subscriptions, *destacado* listings, direct banner sales to dealers/talleres/repuesteros, financing referral, insurance referral, own inventory sales, parts/accessories.
- **Financing is likely the highest-value line** — most motorcycles in Paraguay are bought in cuotas. Specify how a financing lead is captured, what it is worth, and what can be promised (a referral to a financiera/casa comercial) versus what cannot (approval odds, rates, "aprobación garantizada").
- State plainly that AdSense RPM in Paraguay is low and that display ads alone will not fund this; direct sales to local businesses beat programmatic.
- Payment reality: Bancard/vPOS, Tigo Money, Personal/Billetera, transferencia bancaria. Recommend what v1 actually does (probably: quote by WhatsApp, confirm transfer manually in admin) and when automation is worth it.
- Pricing in `Gs.` with a stated basis. If you have no verified market rate for a price point, say "to be validated with 5 dealer conversations before launch" rather than inventing a number.
- **Anti-fabrication rule, non-negotiable:** no invented traffic numbers, no fake "más de 500 motos publicadas", no fake dealer logos, no seeded reviews, no fake urgency counters. Every number shown publicly must trace to a real database count or a real measurement. Write this rule into the doc so implementers inherit it.

### PRODUCT_SPEC.md
- **WhatsApp-first conversion.** Every listing has a primary WhatsApp CTA using `wa.me` with a pre-filled Paraguayan-Spanish message that includes the listing title, price and URL. The click must be tracked server-side (route through an endpoint that records a `whatsapp_click` event, then redirects) — otherwise the only conversion metric on the site is invisible. Specify the fallback for desktop users and for sellers without WhatsApp.
- Listing submission flow that a non-technical seller on a mid-range Android phone over mobile data can complete: photo upload from camera, aggressive client-side compression, autosave, no account required to start (email/phone claim after).
- Search and filter UX, mobile-first. Paraguay is overwhelmingly mobile.
- Honest empty states — a city page with two listings says so and offers an alert signup; it does not pretend.
- Accessibility and performance budget (target LCP on a 4G Paraguayan connection, image sizes, lazy loading).

### INTEGRATIONS.md — VenderCRM
Specify the lead pipeline precisely:
- The browser **never** talks to VenderCRM. Forms post to our own server route, which posts to `POST {CRM_URL}/api/v1/leads` with header `X-Api-Key` from server env (`VENDERCRM_API_KEY`). The endpoint sends no CORS headers by design.
- Required fields: `phone` (identity; local format `0981 123 456` is normalized server-side) and `idempotency_key` (8–100 chars; derive as `sha256(phone + "|" + YYYY-MM-DD-HH)`). Optional: `name`, `email` (omit rather than send `""`), `message`, `source`, `utm_*`, `gclid`, `fbclid`, `page_url`, `referrer`, and a `fields` object for listing-specific context (`{"listing_id": 123, "marca": "Honda", "modelo": "CG 150", "tipo_lead": "financiacion"}`).
- **Never send pipeline, stage, owner or tag** — routing lives on the site record in the CRM.
- Handle `201` (created), `200` (idempotent replay — success), `401`/`403`/`422`/`429` (log loudly, never show the visitor an error). Wrap in try/catch with ~10s timeout; the visitor always sees the thank-you page.
- Honeypot field on every form; Turnstile once there is real traffic.
- First-touch attribution via the CRM's `vc-attribution.js` snippet + `vc_attr` cookie read server-side.
- Which lead types go to the CRM: financing, insurance, dealer plan enquiry, ad enquiry. Decide whether plain buyer→seller WhatsApp clicks do (they probably should not — they are the seller's lead, not mine; say so).

### IMPLEMENTATION_PHASES.md
Phase the build so each phase is independently shippable and testable. For each phase give: goal, scope, explicit out-of-scope, exit criteria, and rough effort. Suggested shape (revise if you disagree):
- **Phase 0** — repo, stack, deploy pipeline, DB, design tokens, one page live
- **Phase 1 (MVP)** — the smallest thing that can attract inventory and rank
- **Phase 2** — seller/dealer accounts and dashboards
- **Phase 3** — monetization mechanics
- **Phase 4** — financing/insurance funnels + VenderCRM
- **Phase 5** — content engine at scale
- **Phase 6** — parts/accessories, own inventory
State clearly what is **deliberately excluded from MVP** and why. Ruthlessness here is the point.

### CLAUDE_TASKS.md
- Tasks sized for a single Sonnet 5 / Codex session, each with: preconditions, files touched, acceptance criteria, and how to verify.
- Group by phase, ordered by dependency.
- Each task must be executable by someone who has read only the docs in this repo.

## Step 4 — Opus vs Sonnet/Codex split

Include a section in `PLAN.md` titled **"Decision ownership"**:

- **Opus decides (now, in these documents):** stack verdict, data model and normalisation, URL taxonomy and indexation rules, listing state machine, moderation policy, monetization mechanics and pricing basis, phase gating and exit criteria, lead routing and CRM contract, the anti-fabrication rules.
- **Sonnet 5 / Codex implements (later):** components and pages from the spec, CRUD and admin screens, forms and validation, image pipeline, sitemap generators, tests, copy drafts against the style guide, deployment scripts.
- **Escalate back to Opus if:** the schema needs a new table or a state change, an SEO indexation rule needs bending, a monetization mechanic changes, or a decision touches trust/safety or legal wording.

## Constraints that apply everywhere

- No fabricated data, reviews, ratings, counts, testimonials, client logos, or market statistics. If a number is needed and not verified, write `[VERIFICAR]` and say how to verify it.
- No promises about financing approval, insurance coverage, or vehicle condition.
- Paraguayan Spanish for all user-facing copy; English is fine inside the docs for technical reasoning, but every user-facing string in the specs must be written in the target Spanish.
- Assume mobile-first, mid-range Android, mobile data.
- Hosting is Hostinger managed Node (or PHP) + MySQL. No Vercel-only features, no serverless-edge assumptions, no external services that add a monthly bill without justification. If you recommend one, justify the cost in `DECISIONS.md`.

## Finally

End your last message with a short **"What I decided and what I need from you"** summary: the stack verdict in one line, the MVP in three bullets, and any open question that blocks Phase 1.

===

---

## Improvements made (for you, not for Claude)

1. **Added a mandatory question round before any document is written.** The original prompt let Opus invent the whole business on assumptions. Eight questions up front (dealer relationships? paid-traffic budget? accounts in v1?) change the plan more than any amount of prose polish.
2. **Forced an honest business critique, including the case against the project.** Classifieds are a cold-start problem and Facebook Marketplace owns informal C2C in Paraguay. I explicitly gave Opus permission to conclude "launch as a dealer + financing portal instead" — otherwise it will cheerfully plan a consumer marketplace with no inventory.
3. **Made the stack question answerable instead of rhetorical.** The original said "use Node unless you strongly argue PHP". That biases the answer. Now Opus must justify Node on *named functions* (faceted search, ISR over DB-generated pages, image pipeline, row-scoped dealer auth, server-side CRM forwarding, moderation queue) and name the cost, then give **one verdict, no hedging**. My read: Node/Next.js is genuinely correct here — the SEO surface is generated from database rows and needs on-demand revalidation and programmatic sitemaps, which is exactly where PHP gets painful. It also matches your proven Next.js 15 + Drizzle + MySQL Hostinger stack, so the deploy path is already known-good.
4. **Added `DATA_SEEDING.md`.** The single biggest risk was invisible in the original prompt: an empty marketplace. This forces a concrete, non-fabricated day-one inventory plan.
5. **Added `TRUST_AND_SAFETY.md`.** Vehicle classifieds attract fraud (stolen units, chapa/transfer problems, advance-payment scams). Deciding moderation policy at spec time is cheap; retrofitting it after a scam story is expensive and reputational.
6. **Added `DECISIONS.md` (ADR log).** Future Sonnet sessions get the *reasoning*, not just the conclusions — which is what stops them from quietly undoing your architecture.
7. **Added `CONTENT_STRATEGY.md` with a Paraguayan Spanish style guide.** "Spanish" is not a spec. Voseo, `Gs. 12.500.000` formatting, and local vocabulary need to be written down once so every later session matches.
8. **Hardened the SEO section against the real failure mode.** Programmatic brand × model × city pages generate tens of thousands of thin pages. I required an explicit indexation threshold, an auto-de-index rule, canonical/facet handling, and a decided answer on expired listings (410 vs 301 vs `sold` state) — the highest-leverage classifieds SEO decision there is.
9. **Made WhatsApp conversion measurable.** Added the requirement that WhatsApp clicks route through a tracked server endpoint before redirecting. A `wa.me` link straight in the HTML means your only real conversion metric is invisible forever.
10. **Specified the VenderCRM contract concretely** rather than "integrate later": server-side key, required `phone` + `idempotency_key`, the `sha256(phone|YYYY-MM-DD-HH)` derivation, never sending pipeline/stage/owner, full status-code handling, never blocking the visitor, honeypot, and first-touch attribution. Also raised the question of whether buyer→seller WhatsApp clicks belong in your CRM at all (they're the seller's lead, not yours).
11. **Grounded monetization in Paraguayan reality.** Financing referral promoted to the likely primary line (motos are bought in cuotas), AdSense explicitly de-emphasised (low RPM), payment methods named (Bancard/vPOS, Tigo Money, transferencia), and v1 payment kept manual-with-admin-confirmation instead of pretending a gateway will exist on day one. Prices must state a basis or be marked for validation.
12. **Wrote the anti-fabrication rule into the spec itself,** so it propagates to every implementation session: no fake counts, reviews, logos, urgency timers, or `AggregateRating` schema. Public numbers must trace to a real DB count.
13. **Added the schema decisions that are painful to retrofit:** `role` enum from day one, brand/model normalisation (free-text kills faceted SEO), `price_gs` as an integer in guaraníes, an explicit listing state machine, and an events table so views and WhatsApp clicks exist as data.
14. **Added an explicit Opus-vs-Sonnet decision-ownership section, plus escalation triggers** — so later sessions know when to stop and come back rather than improvising a schema change.
15. **Added `TEST_PLAN.md`, `ANALYTICS_AND_KPIS.md` (including a kill-number), and `LEGAL_AND_COMPLIANCE.md`** with a pointer to Ley N° 6534/2020 and an instruction to flag rather than assert legal conclusions.
16. **Banned code in this session in a way that's actually enforceable** — including naming the tell ("if you want to build, the spec is under-specified") — and required a closing summary so you can act on the output immediately.
