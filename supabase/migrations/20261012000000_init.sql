-- Price Ranger phase 1
-- Run this in a new Supabase project (SQL editor or supabase db push).
-- It expects Supabase auth.users. Do not run it on a plain Postgres instance.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  business_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  industry text not null default 'home_improvement',
  website text
);

create table if not exists public.products (
  id uuid primary key,
  brand_id uuid references public.brands (id),
  name text not null,
  category text not null,
  description text,
  industry text not null default 'home_improvement'
);

create table if not exists public.skus (
  id uuid primary key,
  product_id uuid not null references public.products (id),
  sku_code text,
  name text not null,
  variation text,
  unit text not null check (unit in ('square', 'sq_ft', 'linear_ft', 'roll', 'bundle', 'each', 'hour')),
  list_price_cents integer check (list_price_cents is null or list_price_cents >= 0),
  connector_slug text,
  attributes jsonb not null default '{}'::jsonb
);

comment on column public.skus.list_price_cents is
  'Placeholder sample price in cents. Not a live supplier price.';

create table if not exists public.connector_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  connector_slug text not null,
  connected_at timestamptz not null default now(),
  primary key (user_id, connector_slug)
);

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sku_id uuid references public.skus (id),
  connector_slug text,
  name text not null,
  unit text not null check (unit in ('square', 'sq_ft', 'linear_ft', 'roll', 'bundle', 'each', 'hour')),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  sample_price boolean not null default false,
  source text not null check (source in ('custom', 'connector', 'catalog')),
  created_at timestamptz not null default now()
);

create table if not exists public.line_item_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  summary text not null default '',
  summary_edited boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.group_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.line_item_groups (id) on delete cascade,
  library_item_id uuid references public.library_items (id) on delete set null,
  name text not null,
  unit text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity numeric(12, 2) not null check (quantity > 0),
  sort_order integer not null default 0
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  customer_name text not null,
  status text not null default 'draft' check (status in ('draft', 'presented')),
  presented_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_tiers (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  name text not null,
  note text not null default '',
  sort_order integer not null default 0,
  recommended boolean not null default false
);

create table if not exists public.quote_tier_groups (
  tier_id uuid not null references public.quote_tiers (id) on delete cascade,
  group_id uuid not null references public.line_item_groups (id) on delete cascade,
  primary key (tier_id, group_id)
);

create index if not exists library_items_user_idx on public.library_items (user_id);
create index if not exists line_item_groups_user_idx on public.line_item_groups (user_id);
create index if not exists group_items_group_idx on public.group_items (group_id);
create index if not exists quotes_user_idx on public.quotes (user_id, updated_at desc);
create index if not exists quote_tiers_quote_idx on public.quote_tiers (quote_id);
create index if not exists skus_connector_idx on public.skus (connector_slug);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.skus enable row level security;
alter table public.connector_connections enable row level security;
alter table public.library_items enable row level security;
alter table public.line_item_groups enable row level security;
alter table public.group_items enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_tiers enable row level security;
alter table public.quote_tier_groups enable row level security;

grant usage on schema public to authenticated;
grant select on public.brands, public.products, public.skus to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.connector_connections,
  public.library_items,
  public.line_item_groups,
  public.group_items,
  public.quotes,
  public.quote_tiers,
  public.quote_tier_groups
to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "read brands" on public.brands;
create policy "read brands" on public.brands for select to authenticated using (true);
drop policy if exists "read products" on public.products;
create policy "read products" on public.products for select to authenticated using (true);
drop policy if exists "read skus" on public.skus;
create policy "read skus" on public.skus for select to authenticated using (true);

drop policy if exists "own connections" on public.connector_connections;
create policy "own connections" on public.connector_connections
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own library" on public.library_items;
create policy "own library" on public.library_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own groups" on public.line_item_groups;
create policy "own groups" on public.line_item_groups
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own group items" on public.group_items;
create policy "own group items" on public.group_items
  for all to authenticated
  using (
    exists (
      select 1 from public.line_item_groups g
      where g.id = group_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.line_item_groups g
      where g.id = group_id and g.user_id = auth.uid()
    )
    and (
      library_item_id is null
      or exists (
        select 1 from public.library_items li
        where li.id = library_item_id and li.user_id = auth.uid()
      )
    )
  );

drop policy if exists "own quotes" on public.quotes;
create policy "own quotes" on public.quotes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own tiers" on public.quote_tiers;
create policy "own tiers" on public.quote_tiers
  for all to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.user_id = auth.uid()
    )
  );

drop policy if exists "own tier groups" on public.quote_tier_groups;
create policy "own tier groups" on public.quote_tier_groups
  for all to authenticated
  using (
    exists (
      select 1 from public.quote_tiers t
      join public.quotes q on q.id = t.quote_id
      where t.id = tier_id and q.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quote_tiers t
      join public.quotes q on q.id = t.quote_id
      where t.id = tier_id and q.user_id = auth.uid()
    )
    and exists (
      select 1 from public.line_item_groups g
      where g.id = group_id and g.user_id = auth.uid()
    )
  );

insert into public.brands (id, name, slug, industry, website) values
  ('fb80cb57-d697-51a2-9fae-be849c68bcc9', 'GAF', 'gaf', 'home_improvement', 'https://www.gaf.com'),
  ('f1b2b83a-42e0-55ce-8eba-8bc635c2bad6', 'Owens Corning', 'owens-corning', 'home_improvement', 'https://www.owenscorning.com'),
  ('e63e6da6-4ac9-54f3-8470-85151b0ffee8', 'James Hardie', 'james-hardie', 'home_improvement', 'https://www.jameshardie.com'),
  ('5226475c-1e0d-5b3c-8a00-e29c3f641cbe', 'LP', 'lp', 'home_improvement', 'https://www.lpcorp.com'),
  ('f16cc1a0-4eef-589a-8e23-c6c0bc76501d', 'GCP', 'gcp', 'home_improvement', 'https://gcpat.com'),
  ('fe62119d-158f-533b-8ac2-8ae19ac56627', 'DuPont', 'dupont', 'home_improvement', 'https://www.dupont.com'),
  ('cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Unbranded', 'unbranded', 'home_improvement', null)
on conflict (id) do nothing;

insert into public.products (id, brand_id, name, category, description, industry) values
  ('852d9141-5a8f-5453-b3c2-b410fe235c2e', 'fb80cb57-d697-51a2-9fae-be849c68bcc9', 'Timberline HDZ shingles', 'Roofing', 'Architectural asphalt shingles for steep-slope roofs.', 'home_improvement'),
  ('ad0c4c46-6b69-55f6-9f81-44a6678b8e20', 'fb80cb57-d697-51a2-9fae-be849c68bcc9', 'Timberline UHDZ shingles', 'Roofing', 'Thicker architectural asphalt shingles in the Timberline line.', 'home_improvement'),
  ('93228617-ae96-5157-8aa4-e09dcb84ae10', 'fb80cb57-d697-51a2-9fae-be849c68bcc9', 'Seal-A-Ridge cap shingles', 'Roofing', 'Hip and ridge cap shingles.', 'home_improvement'),
  ('27b01d2a-1b60-5dfa-b977-e8030cf437f3', 'fb80cb57-d697-51a2-9fae-be849c68bcc9', 'FeltBuster underlayment', 'Roofing', 'Synthetic roof underlayment.', 'home_improvement'),
  ('bc9866ef-b797-5e2c-86e4-15148952444c', 'f1b2b83a-42e0-55ce-8eba-8bc635c2bad6', 'Duration shingles', 'Roofing', 'Architectural asphalt shingles.', 'home_improvement'),
  ('03f960f8-908c-57b7-9f25-1d711d52ba8d', 'f1b2b83a-42e0-55ce-8eba-8bc635c2bad6', 'Oakridge shingles', 'Roofing', 'Architectural asphalt shingles.', 'home_improvement'),
  ('ed5ed855-5314-51c4-bd66-4afbb6a43329', 'f16cc1a0-4eef-589a-8e23-c6c0bc76501d', 'Ice and Water Shield', 'Roofing', 'Self-adhered roof leak barrier.', 'home_improvement'),
  ('db65fad1-82ad-5cdf-bf21-25283d2ab442', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Aluminum drip edge', 'Roofing', 'Edge flashing for roof eaves and rakes.', 'home_improvement'),
  ('393fb731-271e-5da7-8dc1-992f9a459784', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Roofing nails', 'Roofing', 'Coil nails for shingle fastening.', 'home_improvement'),
  ('f4f27a51-b2a4-5b41-8eb9-950f1d85e385', '5226475c-1e0d-5b3c-8a00-e29c3f641cbe', 'SmartSide lap siding', 'Siding', 'Engineered wood lap siding.', 'home_improvement'),
  ('b3144b07-fed8-54bd-be51-1d33e652320c', 'fe62119d-158f-533b-8ac2-8ae19ac56627', 'Tyvek HomeWrap', 'Weather barrier', 'House wrap for exterior walls.', 'home_improvement'),
  ('181cb373-89a1-566f-8c55-705c67f98fd7', 'cbe5746a-ce89-5733-b78c-fb6a997a3c98', 'Vinyl corner post', 'Siding', 'Outside corner trim for vinyl siding.', 'home_improvement'),
  ('943e1a6f-b12f-532a-9a59-37f3855fde07', 'e63e6da6-4ac9-54f3-8470-85151b0ffee8', 'HardiePlank lap siding', 'Siding', 'Fiber-cement lap siding.', 'home_improvement'),
  ('03603b98-dc7d-5fc3-8ce5-4cded6d97722', 'e63e6da6-4ac9-54f3-8470-85151b0ffee8', 'HardieTrim boards', 'Siding', 'Fiber-cement trim boards.', 'home_improvement'),
  ('b108e016-0d8d-586e-9bee-dac5b807667d', 'e63e6da6-4ac9-54f3-8470-85151b0ffee8', 'HardieSoffit panels', 'Siding', 'Fiber-cement soffit panels.', 'home_improvement')
on conflict (id) do nothing;

insert into public.skus (
  id, product_id, sku_code, name, variation, unit, list_price_cents, connector_slug, attributes
) values
  ('719c4821-6e7a-5be1-bdf0-dfc4965af742', '852d9141-5a8f-5453-b3c2-b410fe235c2e', 'HD-THDZ-CHAR', 'GAF Timberline HDZ shingles', 'Charcoal', 'square', 32000, 'home-depot', '{"color":"Charcoal"}'::jsonb),
  ('4b11f167-606f-5d24-9918-faf78ebe30ed', 'bc9866ef-b797-5e2c-86e4-15148952444c', 'HD-DUR-ONYX', 'Owens Corning Duration shingles', 'Onyx Black', 'square', 29500, 'home-depot', '{"color":"Onyx Black"}'::jsonb),
  ('573026b2-c096-537f-988f-3092b140540e', 'ed5ed855-5314-51c4-bd66-4afbb6a43329', 'HD-IWS', 'GCP Ice and Water Shield', null, 'roll', 11500, 'home-depot', '{}'::jsonb),
  ('fdb79d12-ac64-58cb-bc79-c16adc6913a5', 'db65fad1-82ad-5cdf-bf21-25283d2ab442', 'HD-DRIP-W', 'Aluminum drip edge', 'White', 'linear_ft', 250, 'home-depot', '{"color":"White"}'::jsonb),
  ('d0f27a9a-a5ff-5009-bcb5-f15661d3a57f', '393fb731-271e-5da7-8dc1-992f9a459784', 'HD-NAILS', 'Roofing nails, coil box', '1-1/4 in', 'each', 4200, 'home-depot', '{"size":"1-1/4 in"}'::jsonb),
  ('cbb5035d-d157-568e-b64d-66b9dbfdf423', '03f960f8-908c-57b7-9f25-1d711d52ba8d', 'LOW-OAK-BRN', 'Owens Corning Oakridge shingles', 'Brownwood', 'square', 27500, 'lowes', '{"color":"Brownwood"}'::jsonb),
  ('23ccb4b1-fb93-51dd-b8af-83dd1d4cf599', 'f4f27a51-b2a4-5b41-8eb9-950f1d85e385', 'LOW-SMART', 'LP SmartSide lap siding', null, 'sq_ft', 310, 'lowes', '{}'::jsonb),
  ('6f9ba51b-d289-5d40-9a79-b441ac8c42dc', 'b3144b07-fed8-54bd-be51-1d33e652320c', 'LOW-TYVEK', 'DuPont Tyvek HomeWrap', null, 'roll', 16500, 'lowes', '{}'::jsonb),
  ('10508e7a-e6d2-52cb-913e-7c526fed0cac', '181cb373-89a1-566f-8c55-705c67f98fd7', 'LOW-CORNER', 'Vinyl corner post', 'White', 'each', 1800, 'lowes', '{"color":"White"}'::jsonb),
  ('8151f24a-25a7-55d8-a293-c77bd1f34bcc', '852d9141-5a8f-5453-b3c2-b410fe235c2e', 'GAF-THDZ', 'GAF Timberline HDZ shingles', null, 'square', 34000, 'gaf', '{}'::jsonb),
  ('91e51b90-767b-5b67-a530-66a0f8d66184', 'ad0c4c46-6b69-55f6-9f81-44a6678b8e20', 'GAF-UHDZ', 'GAF Timberline UHDZ shingles', null, 'square', 41000, 'gaf', '{}'::jsonb),
  ('73a32f9a-2d87-5d6a-adab-63db6045bd8f', '93228617-ae96-5157-8aa4-e09dcb84ae10', 'GAF-RIDGE', 'GAF Seal-A-Ridge cap shingles', null, 'bundle', 6800, 'gaf', '{}'::jsonb),
  ('183b11e0-81e4-5d12-bc39-a7f1be75024e', '27b01d2a-1b60-5dfa-b977-e8030cf437f3', 'GAF-FELT', 'GAF FeltBuster underlayment', null, 'roll', 9500, 'gaf', '{}'::jsonb),
  ('efe79e9f-3ab7-52bf-9a0e-b2934cf8a936', '943e1a6f-b12f-532a-9a59-37f3855fde07', 'JH-PLANK', 'James Hardie HardiePlank lap siding', null, 'sq_ft', 425, 'james-hardie', '{}'::jsonb),
  ('d34f5ec1-f4a3-57fb-b107-f16f45dab6f9', '03603b98-dc7d-5fc3-8ce5-4cded6d97722', 'JH-TRIM', 'James Hardie HardieTrim boards', null, 'linear_ft', 380, 'james-hardie', '{}'::jsonb),
  ('3d64de28-0e02-5669-99b8-79569799b2a8', 'b108e016-0d8d-586e-9bee-dac5b807667d', 'JH-SOFFIT', 'James Hardie HardieSoffit panels', null, 'sq_ft', 350, 'james-hardie', '{}'::jsonb)
on conflict (id) do nothing;
