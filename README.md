# Price Ranger

An estimating app for pricing work, a sale, or a service and presenting a few options. Phones and wide screens are both first-class. This checkout is v2.1.1 Basecamp (`lib/version.ts`).

The plan is in [docs/PLAN.md](docs/PLAN.md). The changelog is [CHANGELOG.md](CHANGELOG.md). What the old prototype contained is in [docs/legacy-requirements.md](docs/legacy-requirements.md).

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. You can continue without an account, or enter an email. This checkout has no Supabase project, so the next screen shows the sign-in link and a 6-digit code instead of sending mail. Quotes are stored in `data/local-db.json`.

## Production

Create a new Supabase project and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (for www.priceranger.app, `https://www.priceranger.app`)

Run the SQL files in `supabase/migrations`, allow `https://www.priceranger.app/auth/callback` as a redirect URL, and enable email sign-in. Add `{{ .Token }}` to the magic-link email template so the 6-digit code is in the message.

Provider buttons stay hidden until you turn the provider on in Supabase and set the flag:

- Google: `NEXT_PUBLIC_AUTH_GOOGLE=true`
- Facebook: `NEXT_PUBLIC_AUTH_FACEBOOK=true`
- Microsoft (Azure): `NEXT_PUBLIC_AUTH_AZURE=true`
- Apple: `NEXT_PUBLIC_ENABLE_APPLE=true` (leave this off until the iOS app)

Enable anonymous sign-ins for guest drafts. Enable Passkeys in the dashboard, then Settings offers "Add a passkey" after sign-in. Passkeys are documented here; they need that dashboard switch before the button can succeed.

Plan prices and assistant caps live in `lib/plans.ts`. This version does not charge a card. Stripe and Apple in-app purchase are v2.2 and v2.4.

Optional, all server-side:

- `OWNER_EMAIL` for feedback mode
- `GITHUB_FEEDBACK_TOKEN` to mirror feedback into GitHub issues
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for the assistant

Vercel already provides `VERCEL_GIT_COMMIT_SHA` and `VERCEL_ENV` for the version stamp. The full checklist is in the plan.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
