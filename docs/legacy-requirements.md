# Legacy requirements

Recovered from the Price Ranger prototype in this repo. The last commit is 7 May 2025 (`46f3017`). The package was named `hover_crm`. Treat this as a record of what the prototype was trying to be, not as a spec for the rebuild.

## What was kept

The owner likes the Price Ranger ranger. The bust used inside the badge lives in `scripts/ranger-bust.svg`. The old square lockups (`price_ranger_logo.png`, `logo-full`, `logo-mark`, and the shield and round emblems) are not served. The app mark is the park badge under `public/brand/`.

The useful product idea underneath the prototype is also kept, and restated in `docs/PLAN.md`: a simple tool for pricing a home-improvement job and presenting a few options to a customer.

## What was discarded

Most of the prototype is disposable.

- Application code under `app/`, `components/`, and `lib/`. State lived in `localStorage`. Types were duplicated. `next.config.js` set `ignoreBuildErrors` and `ignoreDuringBuilds`.
- `public/brand/`. This is a Hover corporate kit: wordmark, Hover Diatype, a large icon set, letterhead, invoice, email signature, a voice-and-tone PDF, and employee headshots. It is not Price Ranger identity. `lib/brand.ts` only pointed at those folders and left the colors as black and white placeholders. The headshots are not republished.
- Demo photos: house exteriors, garage and floor-plan images, design-idea images, before/after images, and manufacturer product PNGs (Timberline HDZ, Grand Sequoia, Timberline American Harvest). They were props for the guided estimate and the presentation screens.
- `.env.production`. It pointed at Supabase project ref `whiwvlhjspyrunijzvtz`. That project is paused and not recoverable. The anon key was not copied forward.
- `app/.cursor/mcp.json`. It contained a Supabase personal access token. The file was removed. Revoke unused personal access tokens in the Supabase account settings. The token is not repeated in this document.

## Product copy that described the intent

Login and signup, April 2025:

> A simple and flexible tool for pricing home improvement projects

Terms of Service, dated 10 April 2024 in the page and describing `priceranger.app`:

> a home improvement price presentation tool that allows users to create, manage, and share pricing information for home improvement projects

The service was offered "as is" and "as available". Accounts were supposed to require accurate information and a password. User content stayed owned by the user, with a broad license to the service. Privacy said the app collected email, an encrypted password, preferences, and usage data.

The Connect Hover screen described the integration the prototype wanted:

- Use Hover to accurately scope projects
- Automatically import material and labor costs scoped in Hover to calculate customer-facing pricing in Price Ranger
- Upload before and after designs created in Hover to Price Ranger proposals

That screen never called an API. The button opened `https://hover.to/auth/signin` in a new tab. A comment said `TODO: Implement actual Hover API integration`.

The guided estimate hardcoded three materials as if they were a real takeoff:

- GAF Timberline HDZ Shingles, 30 squares, $350 each, $10,500
- James Hardie Artisan Siding, 2,400 sq ft, $9.50, $22,800
- Weather Barrier, 2,600 sq ft, $0.65, $1,690

Material packages were named Premium, Standard, and Value. The price calculator on that screen defaulted to $35,000 material, $25,000 labor, $5,000 other, and a 75% profit margin.

## Features that actually existed in the UI

The home screen was a kanban of "opportunities" with default columns Drafts, Presented, and Approved. Users could rename columns, add columns, and drag cards. Under 640px the board switched to a grid. That was the only mobile accommodation.

An opportunity held a title, a list of options, AND/OR operators between options, a column, a last-updated time, optional package names, one promotion, and one financing option.

An option held a title, description, price, images (before, after, and other), materials, sections, completion and approval flags, a promotion, financing settings, and a calculated cost breakdown. Several of these shapes were declared more than once (`app/types.ts`, `app/types/index.ts`, and inline in the pages) and they did not match.

Other behavior wired to `localStorage`:

- Create an opportunity from scratch or from a saved template
- Duplicate an option, merge two opportunities, delete an opportunity or a column
- Search, and filter by price, approved/pending, last updated, and option count
- Guided estimate wizard: pick a fake Hover job, a model (house, garage, floors, basement), and a material package, then write the result back as an option
- Price calculator: material, labor, and other cost, a tax rate on each, and a profit margin
- Promotions as a percent or a flat amount, with a valid-until date, on an option or inherited from the opportunity
- Financing: name, APR, term. Monthly payment used the standard amortization formula, defaulting to 6.99% APR and 60 months when callers omitted them
- "As low as" price display
- Before/after image upload, with a toggle for whether line prices show
- Public compare page and public show page, plus a print contract with a signature line
- Team page: invite by email, first name, last name, phone, and role (`individual_contributor`), status `pending` or `active`

None of the public pages could share data across devices. They read the same browser's `localStorage`.

## Data model the prototype actually stored

There was no quote schema. The only SQL migration ever committed was `supabase/migrations/20240414000000_create_hover_tokens.sql`, and it was deleted on 16 April 2025. From the deleted auth code, the intended server tables were:

- `team_members`: organization id, user id, email, first name, last name, phone, role, status `pending` or `active`
- `hover_tokens`: user id, access token, refresh token, updated at
- Storage bucket `images`, folder `estimates`

The client model, collapsed from the conflicting TypeScript interfaces:

- Opportunity: id, title, options, operators (`and` or `or`), column, lastUpdated, packageNames, promotion, financingOption
- Option: id, title, content, description, price, finalPrice, isComplete, isApproved, afterImage / beforeImages / afterImages, materials, sections, showAsLowAsPrice, hasCalculations, promotion, details, calculatedPriceDetails
- calculatedPriceDetails: materialCost, laborCost, otherCost, materialTax, laborTax, otherTax, totalTax, profitMargin, totalPrice
- FinancingOption: name, apr, termLength
- Template: name plus a snapshot of an opportunity
- TeamMember: email, name, phone, role, status

There was no brand, product, SKU, supplier connector, or line-item group. Line items were a hardcoded array, then flattened into the option description as text.

## Auth, and why it did not work

April 2025: Supabase email/password auth, a middleware gate, an `/auth/callback` code exchange, and an invite route that called `auth.admin.createUser` and inserted `team_members`. Environment variables were `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Image upload used the anon client against the `images` bucket.

Hover OAuth was sketched and then deleted. It expected `NEXT_PUBLIC_HOVER_CLIENT_ID`, `HOVER_CLIENT_SECRET`, and `NEXT_PUBLIC_HOVER_REDIRECT_URI`, and talked to `https://hover.to/oauth/authorize` and `https://hover.to/oauth/token` with scope `read write`. Tokens would have been saved in `hover_tokens`. The final Connect Hover page does not use any of that.

16–17 April 2025: the callback, resend-verification flow, and then the real Supabase login were removed. Login and signup became a mock: any non-empty email and password were written to `localStorage` as `{ email }`.

7 May 2025: Supabase client, server client, middleware, invite route, and callback were deleted. The same day, the checks that sent a user to `/login` when no email was stored were commented out. The final app does not require an account.

## Boundary with Hover

The prototype was built next to Hover, the owner's employer. The package name, the bundled brand kit, the Connect Hover page, and the guided estimate (jobs, deliverables such as "Roof only", "Full exterior", "Interior floor plan", and 3D model names) all assume Hover is the system of record for measurement.

The rebuild does not compete with that. Price Ranger does not measure buildings, capture photos, run a sales pipeline, or sign into Hover. It prices a job and presents options. Someone who already uses Hover can type quantities in. That is the complementary edge, and it is not an integration.

## Gaps that matter for the rebuild

- No durable account, so a quote disappeared with the browser.
- No catalog. Product names appeared once, as sample strings.
- No supplier connection, and no honest note about what a public catalog API can and cannot do.
- Customer-facing presentation existed (compare carousel, show page, print contract) but was a desktop-first board with package math (AND/OR operators) that is too much for a one-off user on a phone.
- Financing, promotions, tax, and margin were internal pricing tools mixed into the customer view.
- Team and organization invites are a company product. The target is a person quoting one job.
