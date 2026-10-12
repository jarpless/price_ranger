# Price Ranger

A phone-first app for pricing a home-improvement job and presenting a few options.

Phase 1 is documented in [docs/PLAN.md](docs/PLAN.md). What the old prototype contained is in [docs/legacy-requirements.md](docs/legacy-requirements.md).

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Enter an email. This checkout has no Supabase project, so the next screen shows the sign-in link instead of sending mail. Quotes are stored in `data/local-db.json`.

## Production

Create a new Supabase project and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (for www.priceranger.app, `https://www.priceranger.app`)

Run `supabase/migrations/20261012000000_init.sql`, allow `https://www.priceranger.app/auth/callback` as a redirect URL, and enable email sign-in. The full checklist is in the plan.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
