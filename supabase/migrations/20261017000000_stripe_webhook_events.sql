-- Processed Stripe webhook event ids. Service role only.
-- Additive. Does not change auth, storage, or project settings. Safe to run again.
-- This file is not applied to production by the change that added it.

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null default '',
  livemode boolean not null default false,
  received_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'Stripe webhook event ids already accepted. A retried delivery is acknowledged and not applied again.';

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from anon, authenticated;
