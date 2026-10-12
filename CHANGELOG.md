# Changelog

The version number and ranger codename live in `lib/version.ts`. This file records what shipped. The stamp on every screen reads from that module plus `VERCEL_GIT_COMMIT_SHA` and `VERCEL_ENV`.

## v2.1.0 Basecamp

Desktop and phone are both first-class. Wide screens get a sidebar, a three-pane quote builder, data tables, and side-by-side presentation. Phones keep bottom tabs and the swipe deck.

- Version stamp on every screen and a fuller one in Settings.
- Owner feedback mode: region screenshot, context, Supabase (or local file) storage, optional GitHub issue.
- Price Ranger assistant: ask questions about your own quotes, or run in-app actions with a visible spotlight and a replayable tour. Message caps come from `lib/plans.ts`.
- Sign-in can be Google, Facebook, Microsoft, email link, a 6-digit code, or a password. Apple stays hidden. Guests can draft a quote and keep it when they create an account.
- First-run question: what are you pricing? Yard sales get a printable price sheet with a QR code.

## v2.0.0 Trailhead

Phase 1. Magic-link sign-in, catalog, prices, groups with automatic descriptions, quotes with options, and presentation mode.

## Planned

- v2.2 Ridgeline. Live Supabase, the plan caps in `lib/plans.ts`, and Stripe checkout. A customer link and a PDF stay in this release.
- v2.3 Lookout. One live catalog feed, only with written permission.
- v2.4 Outpost. The iPhone app via Capacitor. Face ID, camera, share sheet, and Sign in with Apple. TestFlight, then the App Store. Apple in-app purchase through RevenueCat.
- v3.0 Summit. Another industry on the same catalog.
