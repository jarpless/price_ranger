# Price Ranger plan

## Standing requirement

Desktop and mobile are both first-class. A phone visit and a laptop at a desk must each feel finished: bottom tabs and a single column on a phone, a sidebar and wider layouts on a wide screen. Do not ship a desktop-only or phone-only screen. Test at 1440×900 and 390×844.

Price Ranger is an estimating app for one person quoting a high-ticket job. Home improvement is the first industry. The catalog is shaped so other industries can be added later without a new product.

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

1. Continue without an account, or sign in with email, a code, a password, or a provider that is turned on. The next question is what you are pricing.
2. Add prices. Type one, search the small catalog, or add a sample catalog from the Catalogs tab. A new account also gets a few starter prices.
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

The catalog migration is `supabase/migrations/20261012000000_init.sql`. Basecamp adds `supabase/migrations/20261012010000_basecamp.sql` for feedback, tours, and the storage bucket. Regenerate the seed section with `npm run migration` after editing `lib/catalog.ts`. Row-level security:

- Catalog tables are readable by any signed-in user and not writable from the client.
- Every user-owned table is limited to `auth.uid()`.
- A profile row is created by a trigger when a user signs up.

## v2.1 Basecamp

Shipped on top of Trailhead. The version and codename live only in `lib/version.ts`. The on-screen stamp is `v2.1 Basecamp`, the short git sha (`VERCEL_GIT_COMMIT_SHA`, or `dev` locally), and the env (`prod`, `preview`, or `local` from `VERCEL_ENV`).

- Wide screens: left sidebar (Quotes, Prices, Catalog, Groups, Settings). Phones keep those same destinations as bottom tabs.
- Quote builder on a wide screen is three panes: prices and groups, the selected group, and live Good / Better / Best totals. Drag a price onto a group, or a group onto an option.
- Prices and Catalog are tables with sort, search, filters, inline edit, and CSV import. The shared catalog stays read-only. "Your price" writes the user's library row.
- Presentation is full screen. Phones swipe. Wide screens show up to three options side by side. Arrow keys move between them.
- `N` starts a quote. `/` focuses search. Both are ignored while presenting and while typing in a field.
- Owner feedback mode, off until Settings turns it on. Drag a region, then say what is wrong or what you expected, and mark Bug or Feature. The note stores the route, version stamp, viewport, user agent, and recent console errors. Rows go to `feedback` and screenshots to the private `feedback` storage bucket. With no Supabase project, both fall back to `data/basecamp.json` and `data/feedback/`. If `GITHUB_FEEDBACK_TOKEN` is set, the same note opens a GitHub issue on `jarpless/price_ranger` labeled `feedback` and `bug` or `feature`.
- The assistant launcher sits on every screen. Ask mode answers from the signed-in user's own rows and links to them. Agent mode calls a fixed list of in-app actions, navigates step by step, and spotlights the control it is using. Each run can be replayed as a guided tour that does not write again. Stop is always on screen during a run. Deletes and anything that would leave the app wait for one tap. With no model key, a short on-device planner can still add a price, a group, or a quote, and the panel says the model is not configured.

### Feedback agent loop

The inbox is the source of truth. An external agent consumes it like this:

1. Read `public.feedback` where `status = 'new'`, oldest first. The same report may also be a GitHub issue when `github_issue_url` is set. Labels are `feedback` plus `bug` or `feature`.
2. Download `screenshot_path` from the private `feedback` bucket. The path is `{user_id}/{feedback_id}.png`. Locally the file is `data/feedback/{user_id}/{id}.png`.
3. Use the route, version stamp, viewport, user agent, and `console_errors` as the repro context. Do not treat sample catalog prices as live supplier data.
4. Claim the row by setting `status` to `in_progress` before editing code.
5. After the change ships, set `status` to `shipped` and `shipped_in` to the version label that contains the fix, for example `v2.2 Ridgeline`.
6. Allowed statuses are `new`, `planned`, `in_progress`, and `shipped`.

The app does not ship a service-role key. A loop outside the app can use the Supabase SQL editor, a restricted database role, or the owner's session. Row-level security limits the owner's JWT to their own rows. The GitHub issue is a mirror, not a second inbox.

### Assistant boundary

`OPENAI_API_KEY` is used when it is set. Otherwise `ANTHROPIC_API_KEY`. Optional model names are `OPENAI_MODEL` and `ANTHROPIC_MODEL`. The route runs on the server. Context is the current path plus that user's quotes, prices, groups, and connected catalogs, loaded through the same store as the pages, so Supabase row-level security still applies. Names, emails, phones, and street addresses are replaced with tokens before the request. The tokens are restored only for the signed-in user's own screen. If neither key is set, nothing is sent off the machine.

## Architecture

Next.js App Router, TypeScript, Tailwind. Phones stay a single column with bottom tabs. At `lg` and up, a sidebar replaces the bottom tabs and the quote, table, and presentation layouts widen. The same routes serve both.

| Path | What it is |
| --- | --- |
| `app/login` | Email, code, password, and any provider buttons that are turned on |
| `app/start` | "What are you pricing?" |
| `app/auth/guest` | Starts a guest draft |
| `app/auth/verify` | Local magic-link consumer |
| `app/auth/callback` | Supabase code / token exchange |
| `app/p/[token]` | Public price sheet |
| `app/(app)` | Quotes, prices, groups, catalog, settings, feedback inbox. Bottom tabs on a phone, sidebar on a wide screen. |
| `app/(plain)/quotes/[id]/present` | Customer presentation, no nav. Swipe on a phone, side by side on a wide screen. |
| `app/api/assistant` | Ask and agent turns. Model keys stay on the server. |
| `app/api/feedback` | Owner feedback, screenshot, optional GitHub issue. |
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

A visitor can draft a quote before they have an account. The first screen does not assume a trade. Creating an account keeps that draft.

Production uses Supabase Auth. The redirect URL is `${NEXT_PUBLIC_SITE_URL}/auth/callback`. Middleware refreshes the session cookie. The anon key is the only key the app uses. Do not ship a service-role key.

Providers, each turned on in the Supabase dashboard and then with a public flag so the button appears:

| Button | Supabase provider | Flag |
| --- | --- | --- |
| Google | Google | `NEXT_PUBLIC_AUTH_GOOGLE=true` |
| Facebook | Facebook | `NEXT_PUBLIC_AUTH_FACEBOOK=true` |
| Microsoft | Azure | `NEXT_PUBLIC_AUTH_AZURE=true` |
| Apple | Apple | `NEXT_PUBLIC_ENABLE_APPLE=true` |

Apple stays hidden. v2.4 Outpost is where Sign in with Apple turns on, because an iOS app that offers other social logins has to offer it. Leave the flag unset until then.

Email can be a magic link or the 6-digit code from the same message. Add `{{ .Token }}` to the Supabase magic-link email template or the code is not in the message. Email and password are available from the same screen. Passkeys use Supabase's Passkey provider: turn it on in the dashboard, then the signed-in settings screen offers "Add a passkey". `signInWithPasskey` is on the sign-in screen when Supabase is configured.

Local development, when both Supabase variables are unset: the server stores a hash of a single-use token and a 6-digit code for 15 minutes and the next screen shows both. The session is an HMAC cookie (`pr_session`) lasting 30 days, plus `pr_kind` (`guest` or `user`). The dev secret is fixed and is not used in production. Set `LOCAL_AUTH_SECRET` only if you want a private local secret.

Set both Supabase variables or neither. Setting only one is treated as not configured.

Guests are an anonymous Supabase user, or a local user with `guest` set. Presenting or opening the price sheet asks them to create an account. The local draft moves onto that account. On Supabase, upgrading the anonymous user with `updateUser` or `linkIdentity` keeps the same id, so the rows stay put.

## Plans

`lib/plans.ts` is the only place plan numbers live. Basecamp enforces the assistant message cap from that file. It does not charge anyone. Quote limits, the Price Ranger tag, connector locks, and the agent-mode lock turn on with Ridgeline checkout. Until then, agent mode still runs and every new account is Free.

| Plan | Price | Active quotes | Assistant messages / month | Also included |
| --- | --- | --- | --- | --- |
| Free | $0 | 3 | 10 | Small Price Ranger tag on quotes |
| Pass | $2.99 once | Unlimited for 30 days | 1,000 (same heavy cap as Pro) | Everything, no subscription |
| Plus | $4.99/mo or $39/yr | Unlimited | 100 | Branding removed |
| Pro | $12/mo | Unlimited | 1,000 | Connectors and agent mode |

"Heavy" for Pro and the pass is 1,000 messages in the config, not a second number in the UI. Ask mode uses the cheaper model (`OPENAI_ASK_MODEL` or `ANTHROPIC_ASK_MODEL`). Agent mode uses the stronger model (`OPENAI_AGENT_MODEL` or `ANTHROPIC_AGENT_MODEL`). Each successful model call stores tokens and an estimated cost. Calls that stay on the machine, because no key is set, do not count.

Upgrade prompts at the limit are a sentence naming the plan. Stripe and Apple purchase flows are not in this version.

## Later releases

The names are fixed in `lib/version.ts` and `CHANGELOG.md`.

v2.2 Ridgeline. Live Supabase for a real account, the plan caps above (quotes, tag, connectors, agent mode), and Stripe checkout on the web. A link the customer can open, and a PDF, stay in this release. The yard-sale QR sheet in Basecamp is the local version of that link.

v2.3 Lookout. One real catalog feed, only if affiliate or manufacturer access is approved. CSV import of a price list the user already has rights to is in Basecamp for their own library. Live supplier prices are not.

v2.4 Outpost. The iPhone app via Capacitor. Face ID, camera, and the share sheet. Sign in with Apple turns on. Ship through TestFlight, then the App Store. Apple in-app purchase goes through RevenueCat so a subscription bought on the phone is the same entitlement as Stripe on the web.

v3.0 Summit. Another industry as more `brands` / `products` / `skus` rows and another connector entry. No new tables if the attribute bag is enough.

Still later, and only if a real user asks: promotions, tax, and a cost build-up. Those were in the old prototype and made the screen harder. They are not the product.

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

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | New Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Anon key. Public by design. Not the service-role key. |
| `NEXT_PUBLIC_SITE_URL` | Production | Magic-link redirect origin, no trailing slash. `https://www.priceranger.app` |
| `LOCAL_AUTH_SECRET` | No | Optional local cookie secret. Ignored once Supabase is configured. |
| `OWNER_EMAIL` | Production feedback | Only this email sees feedback mode. In local development with the variable unset, the signed-in user is the owner. |
| `GITHUB_FEEDBACK_TOKEN` | No | Repo-scoped token. When set, feedback also opens an issue on `jarpless/price_ranger`. |
| `OPENAI_API_KEY` | No | Server-side assistant. Used first if both model keys are set. |
| `ANTHROPIC_API_KEY` | No | Server-side assistant when OpenAI is unset. |
| `OPENAI_ASK_MODEL` | No | Cheap ask model. Defaults to `gpt-4o-mini`. `OPENAI_MODEL` is the older name for the same default. |
| `OPENAI_AGENT_MODEL` | No | Stronger agent model. Defaults to `gpt-4o`. |
| `ANTHROPIC_ASK_MODEL` | No | Cheap ask model. Defaults to `claude-3-5-haiku-latest`. `ANTHROPIC_MODEL` is the older name. |
| `ANTHROPIC_AGENT_MODEL` | No | Stronger agent model. Defaults to `claude-3-5-sonnet-latest`. |
| `NEXT_PUBLIC_AUTH_GOOGLE` | No | `true` shows Continue with Google. |
| `NEXT_PUBLIC_AUTH_FACEBOOK` | No | `true` shows Continue with Facebook. |
| `NEXT_PUBLIC_AUTH_AZURE` | No | `true` shows Continue with Microsoft. |
| `NEXT_PUBLIC_ENABLE_APPLE` | No | `true` shows Continue with Apple. Leave unset until the iOS app. |
| `ASSISTANT_SEAL_SECRET` | No | Signs the short-lived redaction map. Falls back to `LOCAL_AUTH_SECRET`. |
| `VERCEL_GIT_COMMIT_SHA` | Set by Vercel | Short sha on the stamp. Local stamp says `dev`. |
| `VERCEL_ENV` | Set by Vercel | `production` → prod, `preview` → preview, otherwise local. |

Local:

```bash
npm install
npm run dev
```

Open http://localhost:3000, enter any email, and use the on-screen sign-in link.

Production checklist for the owner:

1. Create a new Supabase project. Do not try to restore ref `whiwvlhjspyrunijzvtz`.
2. Run `supabase/migrations/20261012000000_init.sql`, then `supabase/migrations/20261012010000_basecamp.sql`, then `supabase/migrations/20261012020000_account.sql`, in the SQL editor. The second file adds feedback, guided tours, and the private `feedback` storage bucket. The third adds industry, plan, assistant usage, and the public price-sheet token.
3. Authentication → Providers. Enable Email. Add `{{ .Token }}` to the magic-link template so the 6-digit code is in the message. Enable Google, Facebook, and Azure only after each provider's client id and secret are saved, then set the matching `NEXT_PUBLIC_AUTH_*` flag. Leave Apple off. Enable Passkeys when you want the settings offer. Enable anonymous sign-ins so a guest draft can exist. Add `https://www.priceranger.app/auth/callback` and `http://localhost:3000/auth/callback` to the redirect allow list. Set the site URL to `https://www.priceranger.app`.
4. In the Vercel project `price-ranger`, set the three variables above. Remove any old variables that point at the paused project.
5. Confirm a magic link arrives, then sign in on a phone.
6. Revoke unused Supabase personal access tokens. One was committed in the old tree at `app/.cursor/mcp.json`.
7. Before charging anyone, have a lawyer replace the old boilerplate terms. Phase 1 does not ship those pages.
8. Catalogs stay on sample data until you have written permission for a feed. Home Depot and Lowe's mean an affiliate application, not a scraper.

## Deploy

The Vercel project `price-ranger` already serves www.priceranger.app from this repo. This app is a normal Next.js build. No extra Vercel config. The file database is dev-only, so the production env vars have to be set or visitors will see the setup screen.
