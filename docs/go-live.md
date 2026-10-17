# Go live: release/rc-2

This is the owner's runbook for shipping rc-2 to production with real Stripe payments. Nothing here is done by the release branch: no Vercel env vars, Stripe settings, or hosted Supabase changes were made. Jamie sets env vars and Stripe objects. Toby applies migrations with Jamie's go.

Never paste a key, webhook secret, or price id into git, issues, chat, or logs. This file lists names only.

## 1. Order of operations

1. Toby applies the pending migrations (section 2) to the production Supabase project.
2. Jamie creates the live Stripe products, prices, webhook endpoint, and customer portal settings (section 4).
3. Jamie sets the Vercel Production env vars (section 3), then redeploys Production so the new values are read.
4. Merge rc-2 to main and let Production deploy.
5. Run the post-deploy smoke checklist (section 5).

Steps 1 and 2 can run in either order. Step 3 must come after 2, because it needs the live price ids and webhook signing secret.

## 2. Supabase migrations (apply in this order)

Everything up to and including `20261015160000_feedback_triage.sql` is assumed to be on production already. Apply these five, in filename order, in the Supabase SQL editor or with `supabase db push`:

| # | File | What it does | Data safety |
| --- | --- | --- | --- |
| 1 | `supabase/migrations/20261017000000_stripe_webhook_events.sql` | Webhook idempotency table (service role only, RLS on, no anon/auth policies). | New table only. |
| 2 | `supabase/migrations/20261017120000_quote_builder.sql` | Adds nullable `guide_quotes.sheet jsonb`. The app keeps storing the sheet in `sources` and never writes this column yet. | Additive column. |
| 3 | `supabase/migrations/20261017200000_generic_trades_catalog.sql` | Generic, handyman-first shared catalog. Upserts by id; old maker brand rows are deleted only when nothing references them. | Shared catalog tables only. Every existing sku id is kept, so `library_items.sku_id` still resolves. |
| 4 | `supabase/migrations/20261017203000_pmf_events.sql` | PMF columns on `funnel_events`, extended event-name check, anon share-event insert policy, `pmf_excluded_users`, `pmf_*` views (`security_invoker`). | Additive. The new name check is a superset of the old one. |
| 5 | `supabase/migrations/20261017210000_quote_trade.sql` | `guide_quotes.trade`, `trade_category` and an index. | Additive, nullable. |

`pmf_events` was renamed from `20261017200000` to `20261017203000` in rc-2 so it no longer shares a timestamp with `generic_trades_catalog`. If anyone applied it under the old name on a non-prod database, the content is identical and re-running it is safe.

Every file uses `if not exists` / `on conflict` / `drop ... if exists` and can be re-run.

Verified locally with `scripts/migrations/check.sh` on Postgres 16 with Supabase auth/storage stubs:

- Fresh database: the whole chain applied twice with no errors.
- Existing data: the chain up to `20261015160000`, then prod-like rows (users, every pre-release funnel event name, quotes, guide quotes, library items pointing at old catalog skus), then the five pending files applied twice. Row counts were unchanged and no library item lost its sku.

Until migrations 3 to 5 run, the app still works: trade filing falls back to keywords, PMF `track()` fails quietly, and the Handyman catalog card imports 0 items.

## 3. Vercel Production env vars (names only)

Set these in the Vercel project **price-ranger**, Production environment. Keep Preview on test keys.

### Stripe (new or changed for live)

| Name | Value to use |
| --- | --- |
| `STRIPE_SECRET_KEY` | Live secret key (`sk_live_…`). This is the only switch into live mode. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the **live** webhook endpoint in section 4. Not the test one. |
| `STRIPE_PRICE_PASS` | Live price id: 30-day pass. |
| `STRIPE_PRICE_PLUS_MONTH` | Live price id: Plus monthly. |
| `STRIPE_PRICE_PLUS_YEAR` | Live price id: Plus yearly. |
| `STRIPE_PRICE_PRO_MONTH` | Live price id: Pro monthly. |
| `STRIPE_AUTOMATIC_TAX` | Optional. Set to `true` only after Stripe Tax is configured. Leave unset otherwise. |

In live mode, Checkout refuses to start for a plan whose price variable is unset (no inline prices in live). The webhook returns HTTP 503 in live mode if `STRIPE_WEBHOOK_SECRET` is missing, so Stripe retries and the dashboard shows the failure.

There is no publishable key (`pk_…`) to set. Checkout is created on the server.

### Must already be set (confirm they exist in Production)

| Name | Why |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook plan updates, idempotency table, share-page owner lookup, video upload URLs. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | `https://www.priceranger.app` (no trailing slash). Used for auth links and as the Checkout return origin fallback. |
| `ASSISTANT_SEAL_SECRET` | Signs assistant state. If it and `LOCAL_AUTH_SECRET` are both unset, the code falls back to a built-in string, so set a long random value. |
| `OWNER_EMAIL` | Owner-only pages (`/admin/feedback`, `/admin/pmf`) and PMF internal-user exclusion. |

### Optional, unchanged by rc-2

`OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (assistant, photo naming, Add context AI reader; without one, Add context uses the line-by-line reader), `OPENAI_CONTEXT_MODEL`, `ANTHROPIC_CONTEXT_MODEL`, `OPENAI_ASK_MODEL`, `OPENAI_AGENT_MODEL`, `ANTHROPIC_ASK_MODEL`, `ANTHROPIC_AGENT_MODEL`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `SUPPORT_FROM_EMAIL`, `GITHUB_FEEDBACK_TOKEN` (feature requests and feedback open public issues when set), `PMF_EXCLUDE_EMAILS`, `TRIAL_DAYS`, `FREE_QUOTE_LIMIT`, `EXPERIMENT_TRIAL_EXTRA_DAYS`, `EXPERIMENT_EXTRA_FREE_QUOTES`, `NEXT_PUBLIC_AUTH_GOOGLE`, `NEXT_PUBLIC_AUTH_FACEBOOK`, `NEXT_PUBLIC_AUTH_AZURE`.

### Removed

`QUOTE_BUILDER` no longer does anything. The inline quote builder is always on. Delete the variable if it exists.

## 4. Stripe live objects

Create these in the **live** dashboard (toggle off "Test mode"/sandbox first).

### Products and prices

Amounts match `lib/plans.ts` and the Plans page.

| Product | Price | Type | Env var |
| --- | --- | --- | --- |
| Price Ranger 30-day pass | $2.99 USD | One-time | `STRIPE_PRICE_PASS` |
| Price Ranger Plus | $4.99 USD / month | Recurring | `STRIPE_PRICE_PLUS_MONTH` |
| Price Ranger Plus yearly | $39 USD / year | Recurring | `STRIPE_PRICE_PLUS_YEAR` |
| Price Ranger Pro | $12 USD / month | Recurring | `STRIPE_PRICE_PRO_MONTH` |

### Webhook endpoint

- URL: `https://www.priceranger.app/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

The handler verifies `Stripe-Signature` (HMAC-SHA256, 5-minute tolerance), stores the event id in `stripe_webhook_events` before applying it (a redelivery returns 200 and is not applied twice), applies only events whose `livemode` matches the key, and reads the renewal date from either the subscription or its first item, so any current API version works.

### Customer portal

Settings → Billing → Customer portal, in live mode (portal settings are separate per mode). Turn on: update payment method, view invoice history, cancel subscription. Optionally allow switching between Plus monthly, Plus yearly, and Pro: a switch made in the portal now updates the account's plan through `customer.subscription.updated` by matching the new price id to the env vars above. The portal returns to `/settings/billing`.

### Account settings

- Settings → Customer emails: turn on successful-payment receipts and invoice emails.
- Stripe Tax stays off unless Jamie decides otherwise (then set `STRIPE_AUTOMATIC_TAX=true`).
- The account must be activated (identity and bank) before live charges pay out.

## 5. Post-deploy smoke checklist (Production)

Use Jamie's own card. Don't record card numbers, keys, or secrets.

1. Open `/upgrade` signed in. No "Stripe test mode" badge shows. Prices read $2.99 / $4.99 / $39 / $12 with the beta price line.
2. Vercel function log shows `Stripe mode: live (api)` after the first Checkout.
3. Buy the 30-day pass. Checkout shows $2.99 from the live price (not an ad-hoc line item). Return lands on `/upgrade/done`, plan reads Pass.
4. Stripe dashboard → webhook endpoint: the `checkout.session.completed` delivery is 200. `stripe_webhook_events` has one row for it.
5. Resend that event from the dashboard. It returns 200 with `duplicate: true` and the plan doesn't change again.
6. Settings → Billing: invoice listed. "Manage billing" opens the live customer portal.
7. Start Plus monthly on a second account. In the portal, switch to Plus yearly (if switching is on): plan stays Plus, renewal date updates. Cancel: after `customer.subscription.deleted` the account is Free.
8. Refund the test purchases from the Stripe dashboard.
9. App smoke at phone and desktop widths: sign in, New price (Add photo, + Add context), quote builder add row/column and a formula, Send, open the share link signed out (header goes to `https://www.priceranger.app/?ref=share&utm_source=share&utm_medium=quote_header` and logs `share_header_click`, carousel shows), beta pill opens the sheet, Request a feature sends, phone tab bar works, version footer reads `Version: Lookout (v2.3.0)`.
10. `/admin/pmf` loads for the owner and shows today's events (needs migration 4).

## 6. TODO: beta price lock (not built)

The beta copy promises: "Join during beta and you'll keep your current price for an extra year after beta ends." Plans says "Beta price – locked for 1 year after beta for early members".

Nothing in billing records or enforces this yet. Before any price goes up:

- Record who subscribed during beta (for example a `beta_joined_at` on the profile, set from the first paid `checkout.session.completed` before the beta end date).
- Keep beta subscribers on their existing Stripe price ids for one year after beta ends (don't migrate their subscriptions when new prices are created), and give new prices new env vars rather than editing these.
- Decide what happens for pass buyers (one-time) who later subscribe.

## 7. Known risks at launch

- Migrations are verified on local Postgres with Supabase stubs, not on a Supabase branch. Take a backup (or point-in-time restore marker) before applying.
- Add context's AI reader hasn't been run against a live model key; the fallback reader is unit-tested.
- Video uploads go to the private `feedback` bucket with a 50 MB client cap. If the bucket's size limit is lower, longer clips fail with a "shorter clip" message.
- See price speedups (#151) were measured against a local store with added latency, not real Supabase. Re-time on Production.
- Terms and privacy are drafts and don't state a refund policy (see `docs/STRIPE_LIVE_CHECKLIST.md`).
