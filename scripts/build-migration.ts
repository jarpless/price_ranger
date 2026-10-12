import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { BRANDS, PRODUCTS, SKUS } from "../lib/catalog";

function sql(value: string | null): string {
  if (value == null) return "null";
  return `'${value.replaceAll("'", "''")}'`;
}

const brandRows = BRANDS.map(
  (brand) =>
    `  (${sql(brand.id)}, ${sql(brand.name)}, ${sql(brand.slug)}, ${sql(brand.industry)}, ${sql(brand.website)})`,
).join(",\n");

const productRows = PRODUCTS.map(
  (product) =>
    `  (${sql(product.id)}, ${sql(product.brandId)}, ${sql(product.name)}, ${sql(product.category)}, ${sql(product.description)}, ${sql(product.industry)})`,
).join(",\n");

const skuRows = SKUS.map(
  (sku) =>
    `  (${sql(sku.id)}, ${sql(sku.productId)}, ${sql(sku.skuCode)}, ${sql(sku.name)}, ${sql(sku.variation)}, ${sql(sku.unit)}, ${sku.listPriceCents}, ${sql(sku.connectorSlug)}, '${JSON.stringify(sku.attributes)}'::jsonb)`,
).join(",\n");

const migration = `-- Price Ranger phase 1
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
${brandRows}
on conflict (id) do nothing;

insert into public.products (id, brand_id, name, category, description, industry) values
${productRows}
on conflict (id) do nothing;

insert into public.skus (
  id, product_id, sku_code, name, variation, unit, list_price_cents, connector_slug, attributes
) values
${skuRows}
on conflict (id) do nothing;
`;

const output = fileURLToPath(new URL("../supabase/migrations/20261012000000_init.sql", import.meta.url));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, migration);
console.log("wrote supabase/migrations/20261012000000_init.sql");
