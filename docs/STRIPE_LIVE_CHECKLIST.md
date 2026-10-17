# Stripe live-mode checklist

Test mode is the default. Live mode starts only when `STRIPE_SECRET_KEY` is an `sk_live_` secret in the server environment. This checklist is the owner's runbook. It does not switch keys, call Stripe, or change Vercel or Supabase settings.

Do not paste secret keys, webhook secrets, or price ids into git, issues, or logs.

## Account activation

Stripe live mode needs the account owner's own legal name, identity document, and bank account. Those details stay in the Stripe dashboard. This repository does not collect them, store them, or send them anywhere.

Until that activation is finished in the owner's own Stripe account, Checkout in live mode cannot pay out. Leave production on an `sk_test_` key until then.

## Environment variables for Vercel production

Set these in the Vercel project **price-ranger**, Production environment, when the owner is ready. Do not set them from this repository. Preview deployments should keep test keys.

| Variable | What to put there |
| --- | --- |
| `STRIPE_SECRET_KEY` | The live secret key (`sk_live_…`). This is the only switch into live mode. |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of the **live** webhook endpoint (`whsec_…`). It is not the test-mode secret. |
| `STRIPE_PRICE_PASS` | Live price id for the 30-day pass. |
| `STRIPE_PRICE_PLUS_MONTH` | Live price id for Plus monthly. |
| `STRIPE_PRICE_PLUS_YEAR` | Live price id for Plus yearly. |
| `STRIPE_PRICE_PRO_MONTH` | Live price id for Pro monthly. |
| `STRIPE_AUTOMATIC_TAX` | `true` only after Stripe Tax is set up. Leave it unset until then. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already required for plan updates. The webhook writer uses it. Never prefix it with `NEXT_PUBLIC_`. |

The app reads every Stripe secret and price id from the environment. There is no hard-coded price id and no hard-coded test key. A publishable key is not used: Checkout is created on the server and the browser is redirected to Stripe.

`SUPABASE_SERVICE_ROLE_KEY` and the Stripe secrets stay server-side.

## Webhook endpoint and events

Endpoint:

`https://www.priceranger.app/api/stripe/webhook`

Method: `POST`.

Create that endpoint in the **live** Stripe dashboard (Developers → Webhooks), not the test workbench, and subscribe it to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The route checks `Stripe-Signature` with HMAC-SHA256 over `timestamp.rawBody`, using `STRIPE_WEBHOOK_SECRET`. Signatures older than five minutes are rejected. A bad signature returns HTTP 400 and does not change the plan.

Each event id is stored before the plan is updated. A second delivery of the same id returns HTTP 200 and does not apply again. If applying the event throws, the stored id is removed so Stripe can retry. On Supabase that store is `public.stripe_webhook_events` (service role only, row-level security on, no policies for anon or authenticated). Locally it is `data/stripe-webhook-events.json`, which is gitignored.

Apply this SQL yourself when you are ready. This change does not run it against production:

`supabase/migrations/20261017000000_stripe_webhook_events.sql`

An event is applied only when its `livemode` flag matches the key: test events with an `sk_test_` key, live events with an `sk_live_` key. The other mode is ignored and logged as ignored. The log line is `Stripe mode: test (webhook).` or `Stripe mode: live (webhook).` It does not include the key.

## Live products and prices

Create these in the live Stripe account. Copy each price id into the matching Vercel variable. Do not commit the ids.

| Product | Charge | Env variable |
| --- | --- | --- |
| Price Ranger 30-day pass | $2.99 once | `STRIPE_PRICE_PASS` |
| Price Ranger Plus | $4.99 every month | `STRIPE_PRICE_PLUS_MONTH` |
| Price Ranger Plus yearly | $39 every year | `STRIPE_PRICE_PLUS_YEAR` |
| Price Ranger Pro | $12 every month | `STRIPE_PRICE_PRO_MONTH` |

Amounts come from `lib/plans.ts`. In test mode, if a price variable is unset, Checkout uses those amounts inline so a test key still works. In live mode, Checkout refuses to start until the matching variable is set, so a live charge cannot invent an ad-hoc price.

The Plans page and the Billing page show `Stripe test mode.`, `Stripe live mode.`, or a line that Stripe is off. That label is the mode indicator. The same mode is written to the server log the first time Checkout or the webhook runs in a process.

## Tax

Leave Stripe Tax off until the owner decides the product is taxable and turns it on in the Stripe dashboard (registrations, product tax code, and inclusive vs exclusive).

The app sends `automatic_tax[enabled]=true` on Checkout only when `STRIPE_AUTOMATIC_TAX` is exactly `true`. The default is off.

## Receipts

Checkout already sends `customer_email`. One-time pass payments also set `payment_intent_data[receipt_email]` to that address.

In the Stripe dashboard, under Settings → Customer emails, turn on successful-payment receipts and invoice emails for the live account. The Billing page lists recent invoices and links to the hosted invoice when Stripe returns one. The app does not generate its own receipt PDF.

## Refund policy

Canceling from Settings → Billing stops a subscription and returns the account to Free. It does not refund a charge that already succeeded. The 30-day pass does not renew. There is no refund API in this app. A refund is issued by the owner from the Stripe dashboard.

The published terms and privacy pages do not state a refund window. Both pages are drafts marked pending legal review:

- Terms: https://www.priceranger.app/terms
- Privacy: https://www.priceranger.app/privacy

Do not take live payments until the owner writes the refund policy and publishes it on the terms page (or a page those terms link to).

## Live-mode smoke test

Run this only after the owner has activated the Stripe account, set the live env vars in Vercel, and applied the webhook migration. Do it with the owner's own card. Do not record the card, the keys, or the webhook secret.

1. Confirm the production function log says `Stripe mode: live` and that the Plans page reads `Stripe live mode.`
2. Buy the 30-day pass. Stripe should open Checkout for $2.99 using `STRIPE_PRICE_PASS`, not an inline price.
3. Confirm the webhook delivery is HTTP 200, the account plan is Pass, and a receipt email arrives if customer emails are on.
4. Send the same webhook event again from the Stripe dashboard. The second delivery should be HTTP 200 and should not change the plan a second time.
5. Open Settings → Billing. The invoice should be listed. Cancel is a no-op for the pass because it does not renew.
6. Refund the $2.99 charge from the Stripe dashboard. Confirm the refund is visible on the invoice.
7. In a separate test customer, start Plus monthly, then cancel it in Billing. The account should return to Free after `customer.subscription.deleted`.
8. Point a test-mode event at the live endpoint. The signature should fail if you used the test secret, or the event should be ignored if the live secret somehow verified a test payload. The plan must not change.

Until those steps pass, keep `STRIPE_SECRET_KEY` as an `sk_test_` key.

## Blocking gaps

These are still open. This change does not close them.

- The Stripe account is not activated here. Activation needs the owner's bank account and identity, which this repository must not hold.
- No live keys, webhook secret, or price ids are set in Vercel by this change. Production stays on whatever is already configured.
- The webhook idempotency table is not applied to the production Supabase project by this change.
- Terms and privacy are drafts, and neither page states a refund policy.
- Stripe Tax is off until the owner configures it and sets `STRIPE_AUTOMATIC_TAX=true`.
- Customer receipt email is a Stripe dashboard setting. The app only supplies the address.
