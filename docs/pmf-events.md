# PMF events

Product events for activation and repeat use (#55). They go to the existing first-party `funnel_events` table through one server helper, `track()` in `lib/analytics/track.ts`. There is no third-party analytics.

## Recording an event

```ts
import { track } from "@/lib/analytics/track";

await track("quote_shared", { channel: "link" });
```

`track()` never throws. It reads the session user, the anonymous id cookie, the session cookie, and the platform cookie, then adds `plan`, `trade`, and `guest` to the props. A failed insert is logged once every five minutes and the caller carries on.

Browsers can only send the events in `CLIENT_EVENTS` (share-page view and clicks, session start) through `POST /api/track`. Everything else is recorded on the server.

## Identity and privacy

| Field | What it is |
| --- | --- |
| `user_id` | Supabase auth user id. Null for a share-page visitor with no account. |
| `anon_id` | Random id in the `pr_aid` cookie (httpOnly, one year). Joins a visitor's share-page events to the account they create. |
| `session_id` | Random id in the `pr_sid` cookie. Rolls over after 30 minutes without a request. |
| `platform` | `web` or `pwa` (standalone display mode). |
| `props` | Short flat strings. At most 12 keys of 120 characters each. Keys that look like personal data (email, name, phone, address, message, note, description, ip, token) are dropped. |

No email, IP address, user agent, item description, or share token is stored. Share events record nothing about the sheet beyond the event itself.

Test accounts are left out of every `pmf_` view and the admin page:
- the owner (`OWNER_EMAIL`), `+test` addresses, `@priceranger.app` and `@example.com` addresses, and any address in `PMF_EXCLUDE_EMAILS` are flagged `props.internal = "true"` when the event is recorded;
- support can add any account id to `public.pmf_excluded_users`.

## Events

Events that existed before #55 keep their names. The spec name is shown where it differs.

| Event | Spec name | Fired when | Props |
| --- | --- | --- | --- |
| `landing` | | First visit to the welcome page | `variant` |
| `signup` | `signup_completed` | Account created (once) | `variant` |
| `terms_accepted` | | Terms accepted (once) | `version`, `variant` |
| `path_chosen` | | Item, job, or check picked | `path`, `variant` |
| `session_started` | return visit | First request of a new 30-minute session | `returning` |
| `price_started` | `price_started` | A price is requested | `input` (camera, text, sample) |
| `first_price_generated` | | First price ever (once) | `path`, `variant` |
| `price_result_shown` | `price_result_shown` | Every price result | `path`, `confidence`, `sample` |
| `price_adjusted` | `price_adjusted` | Price edited or an adjustment applied | `kind` |
| `first_share` | | First quote sent (once) | `path`, `variant` |
| `quote_shared` | `quote_shared` | Every quote sent or presented | `channel` |
| `share_viewed` | share-page view | Recipient opens `/p/[token]` | |
| `share_header_click` | share-header click | Recipient taps the Price Ranger header | |
| `share_signup_click` | share signup CTA click | Recipient taps the sign-up card | `action` |
| `pdf_downloaded` | `pdf_downloaded` | A share-link PDF is generated (seller or recipient) | |
| `first_mark_sold` | | First item marked sold (once) | `path`, `variant` |
| `item_marked_sold` | `item_marked_sold` | Every mark sold | `outcome` |
| `assistant_message` | `assistant_message` | A message sent to the assistant | `mode` |
| `upgrade_viewed` | `plan_viewed` | Upgrade page or checkout opened (once a day) | `source`, `variant` |
| `checkout_started` | `checkout_started` | Checkout button pressed | `plan` |
| `checkout_completed` | `purchase_completed` | Checkout finished (once) | `plan`, `variant` |
| `feedback_submitted` | `feedback_submitted` | Feedback note sent | `type` |
| `trial_expiry` | | Trial ran out | `variant` |
| `beta_survey_completed` | | Beta survey sent (#53) | `tagline_choice`, `tagline_order`, `persona`, `trade`, `ellis` |
| `tagline_other_submitted` | | "Something else?" filled in (#53) | |

`beta_survey_completed` and `tagline_other_submitted` are accepted by the table and the views but are fired by the survey work in #53.

## Metrics

| Metric | Definition | Where |
| --- | --- | --- |
| Activation | Signups whose first price came within 24 hours of signup | `pmf_activation_funnel.activated_24h`, `/admin/pmf` |
| Repeat D1 | Activated accounts with another price 24–48 hours after their first | `pmf_repeat_cohorts.repeat_price_d1` |
| Repeat D7 | Activated accounts with another price on days 1–7 after their first | `pmf_repeat_cohorts.repeat_price_d7` |
| Repeat D30 | Activated accounts with another price on days 8–30 | `pmf_repeat_cohorts.repeat_price_d30` |
| Return D1 / D7 | Signups with a new session on day 1 / days 1–7 after signup | `pmf_repeat_cohorts.returned_d1`, `returned_d7` |
| Weekly returning pricers | Accounts pricing in week N that also priced in an earlier week | `pmf_weekly_returning_pricers` |
| Share loop | Distinct share-page viewers, header clickers, sign-up clickers per week | `pmf_share_loop` |
| Paid funnel | Accounts that viewed plans, started checkout, purchased | `pmf_paid_funnel` |
| Messaging test | Survey line choice by persona, trade, and shown position | `pmf_messaging_test` |

"A price" is `price_result_shown`, or `first_price_generated` for events recorded before `price_result_shown` existed.

## SQL views

`supabase/migrations/20261017203000_pmf_events.sql` adds the columns, the extended name list, the anonymous insert policy for share-page events, and the views. The views use `security_invoker`, so row-level security still applies: a support account (`public.is_support()`) sees every row and anyone else sees only their own. Query them from the Supabase SQL editor or point Metabase at them.

The migration is in the repository and is not applied to production. Until it runs, `track()` calls for new event names fail quietly and the existing funnel events keep working.

## Admin view

`/admin/pmf` (owner only) shows the activation funnel, D1/D7/D30 repeat by weekly cohort, the share loop, and the paid funnel, computed from the same rows. It reads every account when `SUPABASE_SERVICE_ROLE_KEY` is set on the server, or when the signed-in owner is a support account.
