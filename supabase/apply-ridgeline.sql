-- Apply the Ridgeline migrations that are not part of production v2.1.1.
-- Project: vexsmkplsusxlayxhpqb (production and the Vercel preview).
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- The agent could not read supabase_migrations.schema_migrations: there is no
-- database password, service-role key, or Supabase CLI session in this environment.
-- Nothing in this file was applied to that project from here.
--
-- Included, in order, unchanged from the migration files:
--   supabase/migrations/20261013000000_ridgeline.sql
--   supabase/migrations/20261013120000_guide.sql
--
-- Not included, because www.priceranger.app is already v2.1.1 and those
-- migrations create the tables that app uses. If any of them are actually
-- missing, the check below stops and leaves the database unchanged:
--   supabase/migrations/20261012000000_init.sql
--   supabase/migrations/20261012010000_basecamp.sql
--   supabase/migrations/20261012020000_account.sql
--
-- Additive and safe to run again. No DROP TABLE, DELETE, or TRUNCATE.
-- New columns are added with IF NOT EXISTS. Existing quote, profile, and
-- line-item values are not rewritten. A missing updated_at is added as
-- timestamptz not null default now(), which fills only that new column.
-- Policies and triggers are replaced with the same definitions. Lock wait
-- is capped at 5 seconds so a busy table fails the script instead of
-- stalling the app.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $guard$
declare
  missing text[];
begin
  if to_regclass('public.profiles') is null then
    missing := array_append(missing, 'public.profiles (20261012000000_init.sql)');
  end if;
  if to_regclass('public.quotes') is null then
    missing := array_append(missing, 'public.quotes (20261012000000_init.sql)');
  end if;
  if to_regclass('public.group_items') is null then
    missing := array_append(missing, 'public.group_items (20261012000000_init.sql)');
  end if;
  if to_regclass('public.line_item_groups') is null then
    missing := array_append(missing, 'public.line_item_groups (20261012000000_init.sql)');
  end if;
  if to_regclass('public.quote_tiers') is null then
    missing := array_append(missing, 'public.quote_tiers (20261012000000_init.sql)');
  end if;
  if to_regclass('public.quote_tier_groups') is null then
    missing := array_append(missing, 'public.quote_tier_groups (20261012000000_init.sql)');
  end if;
  if to_regclass('public.connector_connections') is null then
    missing := array_append(missing, 'public.connector_connections (20261012000000_init.sql)');
  end if;
  if to_regclass('public.library_items') is null then
    missing := array_append(missing, 'public.library_items (20261012000000_init.sql)');
  end if;
  if to_regclass('public.feedback') is null then
    missing := array_append(missing, 'public.feedback (20261012010000_basecamp.sql)');
  end if;
  if to_regclass('public.guided_tours') is null then
    missing := array_append(missing, 'public.guided_tours (20261012010000_basecamp.sql)');
  end if;
  if to_regclass('public.assistant_usage') is null then
    missing := array_append(missing, 'public.assistant_usage (20261012020000_account.sql)');
  end if;
  if to_regclass('public.profiles') is not null and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'plan'
  ) then
    missing := array_append(missing, 'public.profiles.plan (20261012020000_account.sql)');
  end if;
  if to_regclass('public.quotes') is not null and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quotes' and column_name = 'share_token'
  ) then
    missing := array_append(missing, 'public.quotes.share_token (20261012020000_account.sql)');
  end if;
  if missing is not null then
    raise exception 'Nothing was changed. Apply these missing v2.1 migrations first, then run this file again: %', array_to_string(missing, ', ');
  end if;
end
$guard$;


-- ===== 20261013000000_ridgeline.sql =====

-- Price Ranger v2.2 Ridgeline schema hooks.
-- Run after 20261012020000_account.sql.
-- Columns and tables only. The app does not read or write these yet.
-- customer_name on quotes stays the fallback when contact_id is null.
-- deleted_at is reserved for a later soft delete. Existing policies do not filter it,
-- so current rows stay visible.

-- Shared catalog (brands, products, skus) is not a user table and is left unchanged.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Stamps updated_at on user tables. deleted_at is unused until soft delete is built.';

-- Contacts. customer_name on the quote remains when neither contact is set.
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

comment on table public.contacts is
  'Quote contacts. Empty until the app writes them. customer_name is still the fallback.';

-- Adjustments apply to a whole quote (order) or one line (group_items).
create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quote_id uuid,
  group_item_id uuid references public.group_items (id) on delete cascade,
  scope text not null default 'order' check (scope in ('line', 'order')),
  kind text not null default 'discount' check (kind in ('discount', 'markup', 'fee')),
  mode text not null default 'amount' check (mode in ('percent', 'amount')),
  value numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint adjustments_scope_target_check check (
    (scope = 'order' and quote_id is not null)
    or (scope = 'line' and group_item_id is not null)
  )
);

comment on table public.adjustments is
  'Discount, markup, or fee. scope line targets group_items; scope order targets a quote.';
comment on column public.adjustments.value is
  'Percent mode is a percent (10 = 10%). Amount mode is cents.';

-- Future accounting or API sync. No rows, and nothing writes here yet.
create table if not exists public.external_refs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  provider text not null,
  external_id text not null default '',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.external_refs is
  'Empty hook for a later accounting or API sync.';

create index if not exists contacts_user_idx on public.contacts (user_id, updated_at desc);

create index if not exists adjustments_user_idx on public.adjustments (user_id, updated_at desc);
create index if not exists adjustments_quote_idx on public.adjustments (quote_id);
create index if not exists adjustments_line_idx on public.adjustments (group_item_id);

create unique index if not exists external_refs_entity_provider_key
  on public.external_refs (user_id, entity_type, entity_id, provider);
create index if not exists external_refs_provider_idx
  on public.external_refs (user_id, provider, external_id);

-- quotes.id is already unique. The pair lets a contact or adjustment
-- foreign key include user_id, so one account cannot point at another's row.
create unique index if not exists quotes_id_user_key on public.quotes (id, user_id);

alter table public.quotes
  add column if not exists contact_id uuid,
  add column if not exists recipient_contact_id uuid,
  add column if not exists deposit_cents integer not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists doc_number text,
  add column if not exists accepted_by_email text,
  add column if not exists deleted_at timestamptz;

alter table public.quotes drop constraint if exists quotes_deposit_cents_check;
alter table public.quotes
  add constraint quotes_deposit_cents_check check (deposit_cents >= 0);

alter table public.quotes drop constraint if exists quotes_payment_status_check;
alter table public.quotes
  add constraint quotes_payment_status_check
  check (payment_status in ('unpaid', 'partial', 'paid'));

comment on column public.quotes.customer_name is
  'Fallback customer label when contact_id is null.';
comment on column public.quotes.contact_id is
  'Customer contact. Null until a contact is chosen. customer_name still shows.';
comment on column public.quotes.recipient_contact_id is
  'Person the quote is sent to, when that is not the customer contact.';
comment on column public.quotes.deposit_cents is
  'Deposit requested, in cents. Defaults to 0.';
comment on column public.quotes.payment_status is
  'unpaid, partial, or paid. Defaults to unpaid.';
comment on column public.quotes.doc_number is
  'Human-facing quote number. Null until one is assigned.';
comment on column public.quotes.accepted_by_email is
  'Email that accepted the quote. Null until someone accepts.';

-- Line items live in group_items. New columns stay empty or defaulted.
alter table public.group_items
  add column if not exists cost_cents integer,
  add column if not exists taxable boolean not null default false,
  add column if not exists tax_rate_id uuid,
  add column if not exists optional boolean not null default false;

alter table public.group_items drop constraint if exists group_items_cost_cents_check;
alter table public.group_items
  add constraint group_items_cost_cents_check
  check (cost_cents is null or cost_cents >= 0);

comment on column public.group_items.cost_cents is
  'Internal cost in cents. Null until a cost is recorded.';
comment on column public.group_items.taxable is
  'Whether the line is taxed. Defaults to false.';
comment on column public.group_items.tax_rate_id is
  'Reserved for a future tax rate. No tax-rate table yet, so this stays null.';
comment on column public.group_items.optional is
  'When true, the line can be left off the quote. Defaults to false.';

-- Keep a contact on the same account as the quote.
-- SET NULL (contact_id) clears only that column and leaves user_id in place.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_contact_owner_fkey'
  ) then
    alter table public.quotes
      add constraint quotes_contact_owner_fkey
      foreign key (contact_id, user_id)
      references public.contacts (id, user_id)
      on delete set null (contact_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'quotes_recipient_contact_owner_fkey'
  ) then
    alter table public.quotes
      add constraint quotes_recipient_contact_owner_fkey
      foreign key (recipient_contact_id, user_id)
      references public.contacts (id, user_id)
      on delete set null (recipient_contact_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'adjustments_quote_owner_fkey'
  ) then
    alter table public.adjustments
      add constraint adjustments_quote_owner_fkey
      foreign key (quote_id, user_id)
      references public.quotes (id, user_id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists quotes_doc_number_user_idx
  on public.quotes (user_id, doc_number)
  where doc_number is not null and deleted_at is null;

-- updated_at and deleted_at on every user-owned table.
-- Shared catalog tables are excluded.
do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles',
    'connector_connections',
    'library_items',
    'line_item_groups',
    'group_items',
    'quotes',
    'quote_tiers',
    'quote_tier_groups',
    'feedback',
    'guided_tours',
    'assistant_usage',
    'contacts',
    'adjustments',
    'external_refs'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists updated_at timestamptz not null default now()',
      target
    );
    execute format(
      'alter table public.%I add column if not exists deleted_at timestamptz',
      target
    );
    execute format(
      'drop trigger if exists %I on public.%I',
      target || '_set_updated_at',
      target
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      target || '_set_updated_at',
      target
    );
  end loop;
end $$;

alter table public.contacts enable row level security;
alter table public.adjustments enable row level security;
alter table public.external_refs enable row level security;

grant select, insert, update, delete on
  public.contacts,
  public.adjustments,
  public.external_refs
to authenticated;

drop policy if exists "own contacts" on public.contacts;
create policy "own contacts" on public.contacts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own adjustments" on public.adjustments;
create policy "own adjustments" on public.adjustments
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      quote_id is null
      or exists (
        select 1 from public.quotes q
        where q.id = quote_id and q.user_id = auth.uid()
      )
    )
    and (
      group_item_id is null
      or exists (
        select 1 from public.group_items gi
        join public.line_item_groups g on g.id = gi.group_id
        where gi.id = group_item_id and g.user_id = auth.uid()
      )
    )
  );

drop policy if exists "own external refs" on public.external_refs;
create policy "own external refs" on public.external_refs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===== 20261013120000_guide.sql =====

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

do $record$
declare
  has_name boolean;
  has_statements boolean;
  statements_required boolean;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'Ridgeline schema is applied. supabase_migrations.schema_migrations is not on this database, so versions 20261013000000 and 20261013120000 were not recorded.';
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'name'
  ) into has_name;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'statements'
  ) into has_statements;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'statements'
      and is_nullable = 'NO'
  ) into statements_required;

  if has_name and has_statements and statements_required then
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values
      ('20261013000000', 'ridgeline', array[]::text[]),
      ('20261013120000', 'guide', array[]::text[])
    on conflict (version) do nothing;
  elsif has_name then
    insert into supabase_migrations.schema_migrations (version, name)
    values
      ('20261013000000', 'ridgeline'),
      ('20261013120000', 'guide')
    on conflict (version) do nothing;
  else
    insert into supabase_migrations.schema_migrations (version)
    values ('20261013000000'), ('20261013120000')
    on conflict (version) do nothing;
  end if;
exception when others then
  raise notice 'Ridgeline schema is applied. Could not write supabase_migrations.schema_migrations: %', sqlerrm;
end
$record$;

commit;
