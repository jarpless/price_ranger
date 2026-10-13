# Feedback score

Every ticket gets one integer score. The admin backlog sorts by that number, highest first. The same lines are shown on the ticket so a person can see why it ranked there. Nothing in the formula is hidden.

```
score = plan + revenue paid + activity + opportunity + duplicates + severity
```

| Factor | Points | Why this weight |
| --- | --- | --- |
| Plan | Free 0, Pass 10, Plus 20, Pro 30 | A paying plan is a stronger signal than a guess about the words in the note. Pro is the top because that is the plan built for people who price every day. |
| Revenue paid | 1 point per dollar recorded, cap 25 | `profiles.paid_cents` (or the local account) goes up when Plus checkout completes, by the Plus month price. A plan name alone is not treated as cash. $25 and above all score 25, so one large account cannot swamp the list. |
| Activity | 1 point per 2 events in the last 30 days, cap 15 | Events are funnel events plus screen events from this account. Someone who is in the product this month is more likely to still care about the fix. |
| Opportunity | Segment plus quote frequency, cap 20 | Trades 10, services 6, retail 4, yard 4. Each quote touched in the last 30 days adds 2, up to 10. Trades is the highest segment because a job quote is the sale this app is for. The cap keeps a busy free account from outranking a severe bug from a paying one by volume alone. |
| Duplicates | 4 points per other request for the same thing, cap 20 | The canonical ticket gains these points. A second note is stored and linked, and it does not open a second GitHub issue. |
| Severity | Low 5, medium 15, high 25 | High is a crash, lost work, or a broken sign-in or payment. Low is wording. Medium is everything else. |

The highest possible score is 30 + 25 + 15 + 20 + 20 + 25 = 135.

Classification picks bug or feature, writes the one-line summary, and chooses severity. When `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set, the model does that and may point at an existing open ticket. With no key, the same choice is made from the wording: crash and “can’t” language is a bug, a request to add something is a feature, and two notes that share at least half their words are the same request.

## What gets stored

Tickets stay in `feedback`, with summary, severity, score, the score lines, and a link when the note is a duplicate. Status changes are rows in `feedback_history`. Replies are rows in `feedback_messages`. Extra photos are rows in `feedback_images` and files in the private `feedback` bucket. Screen visits after the terms are accepted are rows in `app_events`, with a device id so the admin timeline can tell two phones apart.

The migration is `supabase/migrations/20261013140000_feedback_system.sql`. It only adds columns, tables, and policies.

## GitHub

When `GITHUB_FEEDBACK_TOKEN` is set, a new note opens an issue on `jarpless/price_ranger` labeled `feedback` and `bug` or `feature`. A bug that is not a duplicate, and that has a screenshot or a real description, also gets `agent-fix`. That label is only a signal that an agent may pick the issue up. The issue text says not to deploy. This app never calls a deploy API from feedback.

A duplicate adds a comment on the existing issue instead of opening another one. Replies in the app are copied to that issue when the token is set.

## Email

Receipt mail goes to the signed-in address when there is one. It says what we understood (the summary and bug or feature) and what happens next. A second mail goes out when the status changes. The sender is `support@priceranger.app`. Guests have no address, so they are skipped.

If `RESEND_API_KEY` is unset, both sends do nothing and the ticket is still saved.

### Domain setup

1. In Resend, add the domain `priceranger.app`.
2. Add the DNS records Resend shows for that domain. That is their SPF record and their DKIM records. Leave the existing mail records in place unless Resend tells you a record must replace one.
3. Wait until Resend marks the domain verified.
4. Set `RESEND_API_KEY` on the Vercel project for Preview and Production.
5. Set `SUPPORT_FROM_EMAIL` to `Price Ranger <support@priceranger.app>`. If you skip it, that address is still the default.
6. Set `EMAIL_PROVIDER=resend`. Any other value is treated as unset.

## Session history

The admin page for a customer lists funnel events and screen events, with the device id on each screen event. If that person has not accepted the terms, the page stays empty and says so. Screen events are not written before that acceptance.

## Env

| Name | Required | Role |
| --- | --- | --- |
| `GITHUB_FEEDBACK_TOKEN` | No | Mirror tickets to GitHub issues and add `agent-fix` on valid bugs. |
| `RESEND_API_KEY` | No | Send the receipt and the status mail. Unset means no mail is sent. |
| `EMAIL_PROVIDER` | No | `resend` when the key is set. |
| `SUPPORT_FROM_EMAIL` | No | Defaults to `Price Ranger <support@priceranger.app>`. |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | No | Classify and dedupe. Rules are used when both are unset. |
| `OWNER_EMAIL` | For the backlog on a hosted deploy | The admin backlog and customer timeline are limited to this address. In local development with it unset, the signed-in person is the owner. |

Do not set `SUPABASE_SERVICE_ROLE_KEY` on Vercel. After the migration, the first signed-in owner email is stored in `support_owners` so the backlog can read every ticket under row-level security.
