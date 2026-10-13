-- Guided Ridgeline: per-user experiment, quote progress, and funnel events.
-- Run after 20261013000000_ridgeline.sql.
-- The app writes these. deleted_at is reserved and not filtered yet.

create table if not exists public.guide_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  variant text not null check (variant in ('a', 'b')),
  intro_completed_at timestamptz,
  tos_version text,
  tos_accepted_at timestamptz,
  trial_started_at timestamptz,
  signed_up_at timestamptz,
  ccpa_do_not_sell boolean not null default false,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.guide_users is
  'Onboarding, terms acceptance, trial start, and the A/B group for this account.';
comment on column public.guide_users.variant is
  'Sticky experiment group. a is the control. b gets the alternate intro, a longer trial, and extra free quotes.';

create table if not exists public.guide_quotes (
  quote_id uuid primary key references public.quotes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (path in ('item', 'job', 'check')),
  step text not null check (step in ('describe', 'review', 'adjust', 'share', 'sold')),
  description text not null default '',
  price_cents integer,
  note text not null default '',
  sources jsonb not null default '[]'::jsonb,
  photo_name text,
  shared_at timestamptz,
  share_token text,
  outcome text check (outcome is null or outcome in ('sold', 'not_yet')),
  sample boolean not null default false,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists guide_quotes_user_idx on public.guide_quotes (user_id, updated_at desc);

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (
    name in (
      'landing',
      'signup',
      'terms_accepted',
      'path_chosen',
      'first_price_generated',
      'first_share',
      'first_mark_sold',
      'trial_expiry',
      'upgrade_viewed',
      'checkout_completed'
    )
  ),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists funnel_events_name_idx on public.funnel_events (name, created_at desc);
create index if not exists funnel_events_user_idx on public.funnel_events (user_id, name);

alter table public.guide_users enable row level security;
alter table public.guide_quotes enable row level security;
alter table public.funnel_events enable row level security;

grant select, insert, update, delete on public.guide_users to authenticated;
grant select, insert, update, delete on public.guide_quotes to authenticated;
grant select, insert on public.funnel_events to authenticated;

drop policy if exists "own guide user" on public.guide_users;
create policy "own guide user" on public.guide_users
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own guide quotes" on public.guide_quotes;
create policy "own guide quotes" on public.guide_quotes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "insert own funnel events" on public.funnel_events;
create policy "insert own funnel events" on public.funnel_events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "read own funnel events" on public.funnel_events;
create policy "read own funnel events" on public.funnel_events
  for select to authenticated
  using (user_id = auth.uid());

-- Checkout uses the service role to set plan. The existing trigger blocks every
-- other caller, including a signed-in person editing their own row.
create or replace function public.protect_plan()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.pass_expires_at is distinct from old.pass_expires_at then
    new.plan := old.plan;
    new.pass_expires_at := old.pass_expires_at;
  end if;
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array['guide_users', 'guide_quotes', 'funnel_events']
  loop
    execute format('drop trigger if exists %I on public.%I', target || '_set_updated_at', target);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      target || '_set_updated_at',
      target
    );
  end loop;
end $$;
