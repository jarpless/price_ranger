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
