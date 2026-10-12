-- Price Ranger v2.1 Basecamp
-- Run after 20261012000000_init.sql on the new Supabase project.

alter table public.profiles
  add column if not exists feedback_enabled boolean not null default false;

grant insert on public.profiles to authenticated;

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'feature')),
  body text not null,
  route text not null,
  version_label text not null,
  git_sha text not null,
  env text not null,
  viewport text not null,
  user_agent text not null,
  console_errors jsonb not null default '[]'::jsonb,
  screenshot_path text,
  status text not null default 'new' check (status in ('new', 'planned', 'in_progress', 'shipped')),
  shipped_in text,
  github_issue_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guided_tours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  prompt text not null default '',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);
create index if not exists guided_tours_user_idx on public.guided_tours (user_id, created_at desc);

alter table public.feedback enable row level security;
alter table public.guided_tours enable row level security;

grant select, insert, update, delete on public.feedback to authenticated;
grant select, insert, update, delete on public.guided_tours to authenticated;

drop policy if exists "own feedback" on public.feedback;
create policy "own feedback" on public.feedback
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own tours" on public.guided_tours;
create policy "own tours" on public.guided_tours
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('feedback', 'feedback', false)
on conflict (id) do nothing;

drop policy if exists "own feedback objects read" on storage.objects;
create policy "own feedback objects read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own feedback objects write" on storage.objects;
create policy "own feedback objects write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own feedback objects update" on storage.objects;
create policy "own feedback objects update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own feedback objects delete" on storage.objects;
create policy "own feedback objects delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
