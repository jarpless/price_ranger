# Price Ranger plan

Price Ranger is a phone-first app for one person quoting a high-ticket job. Home improvement is the first industry. The catalog is shaped so other industries can be added later without a new product.

It is a personal tool. It does not measure buildings, run a CRM, or sign into Hover. Someone who already has a takeoff can type the quantities and present the price.

## Who it is for

A downmarket, one-off user who found an app and wants to price a job today. They will not read a manual, sit through a setup wizard, or learn a pipeline. The first screen after sign-in is a list of quotes and one obvious action.

The customer never gets an account. They look at the phone during the visit.

## Phase 1, built in this change

- Email magic-link sign-in. No password.
- A canonical catalog: brands, products, SKUs, variation, unit, sample price, and free-form attributes. Seeded with public home-improvement product names.
- A catalogs screen. Connecting one copies sample line items into the user's library. Each connector says, in the product, what is actually available.
- Custom line items for labor and anything the catalog does not have.
- Groups of line items. Each group has a customer-facing description. It is written automatically from the items and can be edited.
- Quotes made of one or more options (a single price, or Good / Better / Best). An option is a set of groups.
- Presentation mode. Large type, option name, total, and the group descriptions. Unit prices stay on the builder's side.
- Presenting saves a copy. Editing a group later does not change the copy until the user presents again.
- Supabase schema, row-level security, and a SQL migration. With no Supabase env vars, local development uses a file database and shows the sign-in link on screen.

## Out of scope

- Hover login, measurements, 3D, photo capture, or importing a Hover estimate.
- Sales pipeline, teams, organizations, and permissions beyond "this user owns their rows".
- Live retailer prices, scraping, or affiliate applications. See Connectors below.
- Tax, margin, and cost build-up. The user enters the price they want to charge.
- Financing, promotions, e-sign, and PDF. The old prototype had versions of these. They are later, and they are not required to present a price.
- A public share link. Phase 1 presentation is in person, on the signed-in phone.

## How a visit goes

1. Sign in with email. In local development, tap the link on the next screen. In production, Supabase sends it.
2. Add prices. Type one, search the small catalog, or add a sample catalog from the Catalogs tab.
3. Make a group. Name it the way you would say it ("Architectural roof"). The description fills in. Fix it if you want.
4. New quote. Customer name and job. Add the group to an option, or make Good / Better / Best and put a different group on each.
5. Present. Hand the phone over. Swipe between options. Done returns to the quote.

## Data model

```text
auth.users
  profiles (display name and business name, unused in the phase 1 UI)

brands
  products
    skus (variation, unit, sample list price, attributes, connector slug)

connector_connections   user ↔ catalog slug

library_items           the user's prices (custom, catalog, or connector)
  group_items           copied name, unit, and price, plus quantity
line_item_groups        name, summary, summary_edited

quotes
  quote_tiers           name, note, recommended, sort
    quote_tier_groups   which groups are on this option
  presented_snapshot    frozen customer view
```

Money is integer cents. Quantities are decimals. A group line copies the library price at the moment it is added, so changing the library later does not rewrite old groups. Changing a group does change every draft quote that includes it. Presentation freezes the descriptions and totals into `presented_snapshot`.

`skus.attributes` is JSON for color, size, and whatever the next industry needs. Phase 1 does not edit it in the UI. `industry` on brands and products is `home_improvement` in the seed so a later pack can add rows without a migration.

The migration is `supabase/migrations/20261012000000_init.sql`. Regenerate the seed section with `npm run migration` after editing `lib/catalog.ts`. Row-level security:

- Catalog tables are readable by any signed-in user and not writable from the client.
- Every user-owned table is limited to `auth.uid()`.
- A profile row is created by a trigger when a user signs up.

## Architecture

Next.js App Router, TypeScript, Tailwind. One phone-width column (`max-w-md`) so a desktop browser and a phone show the same layout.

| Path | What it is |
| --- | --- |
| `app/login` | Email form, then "check your email" |
| `app/auth/verify` | Local magic-link consumer |
| `app/auth/callback` | Supabase code / token exchange |
| `app/(app)` | Quotes, prices, groups, catalogs. Bottom nav. |
| `app/(plain)/quotes/[id]/present` | Customer presentation, no nav |
| `lib/store/local.ts` | File database for development |
| `lib/store/supabase.ts` | Same operations against Supabase, using the signed-in user |
| `lib/summary.ts` | Automatic group description |

`getData()` picks the store. Both stores implement `DataStore`, so pages do not branch.

Local mode writes `data/local-db.json` (gitignored). That file is not durable on Vercel. Production without the Supabase variables shows `/setup` instead of pretending the file database will work.

Automatic description examples:

- One item: "Includes 30 squares of GAF Timberline HDZ shingles."
- Two items: "Includes … and …."
- More than three: the first three, then "and N more."

If the user saves their own wording, `summary_edited` stays on until they tap "Use the automatic description".

## Auth

Magic link only.

Production: `signInWithOtp` through `@supabase/ssr`. The redirect URL is `${NEXT_PUBLIC_SITE_URL}/auth/callback`. Middleware refreshes the Supabase session cookie. The anon key is the only key the app uses. Do not ship a service-role key to the browser, and phase 1 does not need one on the server.

Local development, when both Supabase variables are unset: the server stores a hash of a single-use token for 15 minutes and the next screen renders the link. The session is an HMAC cookie (`pr_session`) lasting 30 days. The dev secret is fixed and is not used in production. Set `LOCAL_AUTH_SECRET` only if you want a private local secret.

Set both Supabase variables or neither. Setting only one is treated as not configured.

## Connectors

A connector is a named source that can copy SKUs into the user's library. The phase 1 list:

| Catalog | Status | Why |
| --- | --- | --- |
| Home Depot | Stub | No open contractor price book. Approved affiliates can license a product feed through Impact. The app does not scrape homedepot.com. |
| Lowe's | Stub | Same shape: affiliate product data exists, a public price API does not. The app does not scrape lowes.com. |
| GAF | Sample | Product names from the public shingle line. No free price API. |
| James Hardie | Sample | Product names from the public siding line. No free price API. |
| ABC Supply | Unavailable | Trade login. No public catalog to import. Shown so the list is honest. |

Sample prices are labeled in the library ("Home Depot sample") until the user edits them. They are placeholders, not shelf prices and not the user's cost.

A later connector implements the same `connectConnector(userId, slug)` path: resolve SKUs, skip ones already in the library, insert the rest. Live feeds belong behind that function only after there is a real contract and a key in the environment. Do not add a scraper.

## Later phases

Phase 2. A link the customer can open without an account. PDF. Optional monthly payment display, clearly labeled as an illustration. Snapshot the groups onto the quote at the moment they are added, so two quotes can diverge without a freeze step.

Phase 3. One real catalog feed, only if affiliate or manufacturer access is approved. CSV import for a public price list the user already has rights to. Keep the sample connectors for everything else.

Phase 4. Another industry as more `brands` / `products` / `skus` rows and another connector entry. No new tables if the attribute bag is enough.

Still later, and only if a real user asks: promotions, tax, and a cost build-up. Those were in the old prototype and made the screen harder. They are not the product.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | New Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Anon key. Public by design. Not the service-role key. |
| `NEXT_PUBLIC_SITE_URL` | Production | Magic-link redirect origin, no trailing slash. `https://www.priceranger.app` |
| `LOCAL_AUTH_SECRET` | No | Optional local cookie secret. Ignored once Supabase is configured. |

Local:

```bash
npm install
npm run dev
```

Open http://localhost:3000, enter any email, and use the on-screen sign-in link.

Production checklist for the owner:

1. Create a new Supabase project. Do not try to restore ref `whiwvlhjspyrunijzvtz`.
2. Run `supabase/migrations/20261012000000_init.sql` in the SQL editor.
3. Authentication → Email: enable email. Add `https://www.priceranger.app/auth/callback` and `http://localhost:3000/auth/callback` to the redirect allow list. Set the site URL to `https://www.priceranger.app`.
4. In the Vercel project `price-ranger`, set the three variables above. Remove any old variables that point at the paused project.
5. Confirm a magic link arrives, then sign in on a phone.
6. Revoke unused Supabase personal access tokens. One was committed in the old tree at `app/.cursor/mcp.json`.
7. Before charging anyone, have a lawyer replace the old boilerplate terms. Phase 1 does not ship those pages.
8. Catalogs stay on sample data until you have written permission for a feed. Home Depot and Lowe's mean an affiliate application, not a scraper.

## Deploy

The Vercel project `price-ranger` already serves www.priceranger.app from this repo. This app is a normal Next.js build. No extra Vercel config. The file database is dev-only, so the production env vars have to be set or visitors will see the setup screen.
