# Price Ranger

An app for pricing something you are selling and sharing that price. Phones and wide screens are both first-class. This checkout is v2.3 Lookout (`lib/version.ts`).

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

Run the SQL files in `supabase/migrations`, allow `https://www.priceranger.app/auth/callback` as a redirect URL, and enable email sign-in. Paste the templates in `supabase/templates/` into Confirm signup and Magic link. The steps are in `docs/supabase-email.md`.

Apple and Google buttons are always shown. They work after those providers are enabled in the Supabase dashboard. Facebook and Microsoft stay behind `NEXT_PUBLIC_AUTH_FACEBOOK` and `NEXT_PUBLIC_AUTH_AZURE`.

Enable anonymous sign-ins for guest drafts. Enable Passkeys in the dashboard before the passkey button can succeed.

Plan prices and assistant caps live in `lib/plans.ts`. Stripe checkout stays in test mode (`sk_test_` only). `SUPABASE_SERVICE_ROLE_KEY` stays on the server and is required to link a guest, update a plan, and delete an account.

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
