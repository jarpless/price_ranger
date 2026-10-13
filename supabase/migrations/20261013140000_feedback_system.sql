-- Feedback tickets: classification, thread, score, and session events.
-- Run after 20261012010000_basecamp.sql. Additive. Safe to run again.
-- Does not drop tables or rewrite existing feedback text.

alter table public.profiles
  add column if not exists paid_cents integer not null default 0;

alter table public.feedback
  add column if not exists summary text not null default '',
  add column if not exists severity text not null default 'medium',
  add column if not exists duplicate_of uuid,
  add column if not exists duplicate_count integer not null default 0,
  add column if not exists score integer not null default 0,
  add column if not exists score_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists device_id text not null default '',
  add column if not exists source text not null default 'desktop',
  add column if not exists deleted_at timestamptz;

alter table public.feedback drop constraint if exists feedback_severity_check;
alter table public.feedback
  add constraint feedback_severity_check check (severity in ('low', 'medium', 'high'));

alter table public.feedback drop constraint if exists feedback_source_check;
alter table public.feedback
  add constraint feedback_source_check check (source in ('desktop', 'mobile', 'shake'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'feedback_duplicate_of_fkey') then
    alter table public.feedback
      add constraint feedback_duplicate_of_fkey
      foreign key (duplicate_of) references public.feedback (id) on delete set null;
  end if;
end $$;

create index if not exists feedback_score_idx on public.feedback (score desc, created_at desc);

create table if not exists public.support_owners (
  email text primary key
);

alter table public.support_owners enable row level security;

create or replace function public.is_support()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.support_owners
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_support() from public;
grant execute on function public.is_support() to authenticated;

drop policy if exists "bootstrap support owner" on public.support_owners;
create policy "bootstrap support owner" on public.support_owners
  for insert to authenticated
  with check (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (
      not exists (select 1 from public.support_owners)
      or public.is_support()
    )
  );

drop policy if exists "read support owners" on public.support_owners;
create policy "read support owners" on public.support_owners
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.is_support());

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author text not null check (author in ('user', 'support')),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.feedback_history (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  from_status text,
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_images (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null default '',
  name text not null,
  route text not null default '',
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_ticket_idx on public.feedback_messages (feedback_id, created_at);
create index if not exists feedback_history_ticket_idx on public.feedback_history (feedback_id, created_at);
create index if not exists app_events_user_idx on public.app_events (user_id, created_at desc);

alter table public.feedback_messages enable row level security;
alter table public.feedback_history enable row level security;
alter table public.feedback_images enable row level security;
alter table public.app_events enable row level security;

grant select, insert on public.feedback_messages to authenticated;
grant select, insert on public.feedback_history to authenticated;
grant select, insert on public.feedback_images to authenticated;
grant select, insert on public.app_events to authenticated;
grant select, insert on public.support_owners to authenticated;

drop policy if exists "support reads feedback" on public.feedback;
create policy "support reads feedback" on public.feedback
  for select to authenticated using (public.is_support());

drop policy if exists "support updates feedback" on public.feedback;
create policy "support updates feedback" on public.feedback
  for update to authenticated using (public.is_support()) with check (public.is_support());

drop policy if exists "read ticket messages" on public.feedback_messages;
create policy "read ticket messages" on public.feedback_messages
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid())
    or public.is_support()
  );

drop policy if exists "write ticket messages" on public.feedback_messages;
create policy "write ticket messages" on public.feedback_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (author = 'user' and exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid()))
      or (author = 'support' and public.is_support())
    )
  );

drop policy if exists "read ticket history" on public.feedback_history;
create policy "read ticket history" on public.feedback_history
  for select to authenticated
  using (
    exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid())
    or public.is_support()
  );

drop policy if exists "write ticket history" on public.feedback_history;
create policy "write ticket history" on public.feedback_history
  for insert to authenticated
  with check (
    exists (select 1 from public.feedback f where f.id = feedback_id and (f.user_id = auth.uid() or public.is_support()))
  );

drop policy if exists "read ticket images" on public.feedback_images;
create policy "read ticket images" on public.feedback_images
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid())
    or public.is_support()
  );

drop policy if exists "write ticket images" on public.feedback_images;
create policy "write ticket images" on public.feedback_images
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid())
  );

drop policy if exists "own app events" on public.app_events;
create policy "own app events" on public.app_events
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "support reads app events" on public.app_events;
create policy "support reads app events" on public.app_events
  for select to authenticated using (public.is_support());

drop policy if exists "support reads profiles" on public.profiles;
create policy "support reads profiles" on public.profiles
  for select to authenticated using (public.is_support());

-- Open tickets for dedupe. Security definer so one account can match another account's note
-- without reading that account's other rows.
create or replace function public.feedback_open_briefs()
returns table (
  id uuid,
  user_id uuid,
  summary text,
  body text,
  kind text,
  github_issue_url text,
  duplicate_count integer,
  score integer,
  score_breakdown jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.user_id, f.summary, left(f.body, 400), f.kind, f.github_issue_url, f.duplicate_count, f.score, f.score_breakdown
  from public.feedback f
  where f.duplicate_of is null
    and f.status <> 'shipped'
    and f.deleted_at is null
  order by f.created_at desc
  limit 80;
$$;

revoke all on function public.feedback_open_briefs() from public;
grant execute on function public.feedback_open_briefs() to authenticated;

create or replace function public.feedback_apply_duplicate(
  canonical uuid,
  next_score integer,
  breakdown jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if not exists (
    select 1 from public.feedback mine
    where mine.duplicate_of = canonical and mine.user_id = auth.uid()
  ) then
    raise exception 'Not your duplicate';
  end if;
  update public.feedback
  set duplicate_count = duplicate_count + 1,
      score = next_score,
      score_breakdown = breakdown,
      updated_at = now()
  where id = canonical
    and duplicate_of is null;
end;
$$;

revoke all on function public.feedback_apply_duplicate(uuid, integer, jsonb) from public;
grant execute on function public.feedback_apply_duplicate(uuid, integer, jsonb) to authenticated;

do $$
begin
  if to_regclass('public.funnel_events') is not null then
    execute 'drop policy if exists "support reads funnel" on public.funnel_events';
    execute 'create policy "support reads funnel" on public.funnel_events for select to authenticated using (public.is_support())';
  end if;
  if to_regclass('public.guide_users') is not null then
    execute 'drop policy if exists "support reads guide users" on public.guide_users';
    execute 'create policy "support reads guide users" on public.guide_users for select to authenticated using (public.is_support())';
  end if;
end $$;
