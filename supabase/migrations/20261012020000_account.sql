-- Account fields, assistant usage, and a public price-sheet token.
-- Plan changes are locked here. Checkout in v2.2 Ridgeline is what sets plan.

alter table public.profiles
  add column if not exists industry text,
  add column if not exists plan text not null default 'free',
  add column if not exists pass_expires_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pass', 'plus', 'pro'));

alter table public.profiles
  drop constraint if exists profiles_industry_check;

alter table public.profiles
  add constraint profiles_industry_check check (
    industry is null or industry in ('trades', 'retail', 'services', 'yard')
  );

create or replace function public.protect_plan()
returns trigger
language plpgsql
as $$
begin
  if new.plan is distinct from old.plan
     or new.pass_expires_at is distinct from old.pass_expires_at then
    new.plan := old.plan;
    new.pass_expires_at := old.pass_expires_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_plan on public.profiles;
create trigger profiles_protect_plan
  before update on public.profiles
  for each row execute function public.protect_plan();

create table if not exists public.assistant_usage (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('ask', 'agent')),
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.assistant_usage enable row level security;

drop policy if exists assistant_usage_select_own on public.assistant_usage;
create policy assistant_usage_select_own on public.assistant_usage
  for select using (user_id = auth.uid());

drop policy if exists assistant_usage_insert_own on public.assistant_usage;
create policy assistant_usage_insert_own on public.assistant_usage
  for insert with check (user_id = auth.uid());

alter table public.quotes
  add column if not exists share_token text,
  add column if not exists sheet jsonb;

create unique index if not exists quotes_share_token_key on public.quotes (share_token);

create or replace function public.shared_sheet(token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select sheet from public.quotes where share_token = token limit 1;
$$;

revoke all on function public.shared_sheet(text) from public;
grant execute on function public.shared_sheet(text) to anon, authenticated;
