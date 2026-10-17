-- PMF instrumentation (#55): session and anonymous ids on funnel_events, the
-- extended event list, anonymous share-page events, and cohort SQL views.
-- Additive. Safe to run again. Not applied to production by the change that added it.

alter table public.funnel_events add column if not exists anon_id text;
alter table public.funnel_events add column if not exists session_id text;
alter table public.funnel_events add column if not exists platform text;

alter table public.funnel_events drop constraint if exists funnel_events_name_check;
alter table public.funnel_events add constraint funnel_events_name_check check (
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
    'checkout_completed',
    'session_started',
    'price_started',
    'price_result_shown',
    'price_adjusted',
    'quote_shared',
    'pdf_downloaded',
    'item_marked_sold',
    'assistant_message',
    'checkout_started',
    'feedback_submitted',
    'share_viewed',
    'share_header_click',
    'share_signup_click',
    'beta_survey_completed',
    'tagline_other_submitted'
  )
);

alter table public.funnel_events drop constraint if exists funnel_events_ids_check;
alter table public.funnel_events add constraint funnel_events_ids_check check (
  coalesce(length(anon_id), 0) <= 64
  and coalesce(length(session_id), 0) <= 64
  and coalesce(length(platform), 0) <= 32
  and pg_column_size(props) <= 4096
);

create index if not exists funnel_events_session_idx on public.funnel_events (session_id, created_at);
create index if not exists funnel_events_anon_idx on public.funnel_events (anon_id, created_at);
create index if not exists funnel_events_created_idx on public.funnel_events (created_at desc);

-- A share-page visitor has no account. The server inserts their events with the anon key.
grant insert on public.funnel_events to anon;
drop policy if exists "anon inserts share events" on public.funnel_events;
create policy "anon inserts share events" on public.funnel_events
  for insert to anon
  with check (
    user_id is null
    and name in ('share_viewed', 'share_header_click', 'share_signup_click', 'pdf_downloaded', 'session_started')
  );

drop policy if exists "support reads funnel" on public.funnel_events;
create policy "support reads funnel" on public.funnel_events
  for select to authenticated using (public.is_support());

-- Test and staff accounts. Support adds rows here; every pmf_ view leaves them out.
create table if not exists public.pmf_excluded_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default 'test',
  created_at timestamptz not null default now()
);

alter table public.pmf_excluded_users enable row level security;
revoke all on table public.pmf_excluded_users from anon;
grant select, insert, delete on public.pmf_excluded_users to authenticated;
drop policy if exists "support manages exclusions" on public.pmf_excluded_users;
create policy "support manages exclusions" on public.pmf_excluded_users
  for all to authenticated using (public.is_support()) with check (public.is_support());

-- Views run with the caller's rights, so RLS still applies: support sees every row.

create or replace view public.pmf_events with (security_invoker = true) as
select e.id, e.user_id, e.anon_id, e.session_id, e.platform, e.name, e.props, e.created_at
from public.funnel_events e
where e.deleted_at is null
  and coalesce(e.props ->> 'internal', '') <> 'true'
  and (e.user_id is null or not exists (select 1 from public.pmf_excluded_users x where x.user_id = e.user_id));

-- One row per account with the timestamps the funnel and retention views need.
create or replace view public.pmf_users with (security_invoker = true) as
with signups as (
  select user_id, min(created_at) as signed_up_at
  from public.pmf_events
  where name = 'signup' and user_id is not null
  group by user_id
),
prices as (
  select user_id, created_at
  from public.pmf_events
  where name in ('price_result_shown', 'first_price_generated') and user_id is not null
),
firsts as (
  select user_id, min(created_at) as first_price_at from prices group by user_id
)
select
  s.user_id,
  s.signed_up_at,
  date_trunc('week', s.signed_up_at)::date as cohort_week,
  f.first_price_at,
  (f.first_price_at is not null and f.first_price_at <= s.signed_up_at + interval '24 hours') as activated_24h,
  (select min(created_at) from public.pmf_events e where e.user_id = s.user_id and e.name in ('quote_shared', 'first_share')) as first_share_at,
  (select min(created_at) from public.pmf_events e where e.user_id = s.user_id and e.name in ('item_marked_sold', 'first_mark_sold')) as first_sold_at,
  exists (
    select 1 from prices p
    where p.user_id = s.user_id
      and p.created_at >= f.first_price_at + interval '1 day'
      and p.created_at < f.first_price_at + interval '2 days'
  ) as priced_d1,
  exists (
    select 1 from prices p
    where p.user_id = s.user_id
      and p.created_at >= f.first_price_at + interval '1 day'
      and p.created_at < f.first_price_at + interval '8 days'
  ) as priced_d1_7,
  exists (
    select 1 from prices p
    where p.user_id = s.user_id
      and p.created_at >= f.first_price_at + interval '8 days'
      and p.created_at < f.first_price_at + interval '31 days'
  ) as priced_d8_30,
  exists (
    select 1 from public.pmf_events e
    where e.user_id = s.user_id and e.name = 'session_started'
      and e.created_at >= s.signed_up_at + interval '1 day'
      and e.created_at < s.signed_up_at + interval '2 days'
  ) as returned_d1,
  exists (
    select 1 from public.pmf_events e
    where e.user_id = s.user_id and e.name = 'session_started'
      and e.created_at >= s.signed_up_at + interval '1 day'
      and e.created_at < s.signed_up_at + interval '8 days'
  ) as returned_d1_7,
  exists (
    select 1 from public.pmf_events e
    where e.user_id = s.user_id and e.name = 'checkout_completed'
      and e.created_at < coalesce(f.first_price_at, s.signed_up_at) + interval '30 days'
  ) as paid_30d,
  exists (
    select 1
    from public.pmf_events mine
    join public.pmf_events click on click.anon_id = mine.anon_id and click.name = 'share_signup_click'
    where mine.user_id = s.user_id and mine.anon_id is not null
  ) as from_share
from signups s
left join firsts f on f.user_id = s.user_id;

-- Activation funnel: signup -> first price (24h) -> share -> sold, plus a second price within 7 days.
create or replace view public.pmf_activation_funnel with (security_invoker = true) as
select
  count(*) as signups,
  count(*) filter (where first_price_at is not null) as priced,
  count(*) filter (where activated_24h) as activated_24h,
  count(*) filter (where first_share_at is not null) as shared,
  count(*) filter (where first_sold_at is not null) as sold,
  count(*) filter (where priced_d1_7) as second_price_7d,
  count(*) filter (where paid_30d) as paid_30d,
  count(*) filter (where from_share) as from_share
from public.pmf_users;

-- Retention triangle: weekly signup cohorts x D1 / D7 / D30 repeat.
-- priced_* is measured from the first price (activated accounts); returned_* from signup.
create or replace view public.pmf_repeat_cohorts with (security_invoker = true) as
select
  cohort_week,
  count(*) as signups,
  count(*) filter (where first_price_at is not null) as activated,
  count(*) filter (where returned_d1) as returned_d1,
  count(*) filter (where returned_d1_7) as returned_d7,
  count(*) filter (where priced_d1) as repeat_price_d1,
  count(*) filter (where priced_d1_7) as repeat_price_d7,
  count(*) filter (where priced_d8_30) as repeat_price_d30,
  round(100.0 * count(*) filter (where priced_d1_7) / nullif(count(*) filter (where first_price_at is not null), 0), 1) as repeat_d7_pct
from public.pmf_users
group by cohort_week
order by cohort_week desc;

-- Weekly returning pricers: priced this week and in some earlier week.
create or replace view public.pmf_weekly_returning_pricers with (security_invoker = true) as
with weeks as (
  select distinct user_id, date_trunc('week', created_at)::date as week
  from public.pmf_events
  where name in ('price_result_shown', 'first_price_generated') and user_id is not null
)
select
  w.week,
  count(*) as pricers,
  count(*) filter (where exists (select 1 from weeks p where p.user_id = w.user_id and p.week < w.week)) as returning_pricers
from weeks w
group by w.week
order by w.week desc;

-- Share loop: recipient views -> header click -> sign-up click, by anonymous visitor.
create or replace view public.pmf_share_loop with (security_invoker = true) as
select
  date_trunc('week', created_at)::date as week,
  count(distinct coalesce(anon_id, session_id)) filter (where name = 'share_viewed') as viewers,
  count(*) filter (where name = 'share_viewed') as views,
  count(distinct coalesce(anon_id, session_id)) filter (where name = 'share_header_click') as header_clickers,
  count(distinct coalesce(anon_id, session_id)) filter (where name = 'share_signup_click') as signup_clickers
from public.pmf_events
where name in ('share_viewed', 'share_header_click', 'share_signup_click')
group by 1
order by 1 desc;

-- Paid funnel: plan viewed -> checkout started -> purchase.
create or replace view public.pmf_paid_funnel with (security_invoker = true) as
select
  count(distinct user_id) filter (where name = 'upgrade_viewed') as plan_viewers,
  count(distinct user_id) filter (where name = 'checkout_started') as checkout_starters,
  count(distinct user_id) filter (where name = 'checkout_completed') as purchasers
from public.pmf_events
where user_id is not null;

-- Messaging test from the beta survey (#53): choice share by persona and trade, plus position bias.
create or replace view public.pmf_messaging_test with (security_invoker = true) as
select
  coalesce(props ->> 'tagline_choice', 'other') as tagline_choice,
  coalesce(props ->> 'persona', '') as persona,
  coalesce(props ->> 'trade', '') as trade,
  array_position(string_to_array(coalesce(props ->> 'tagline_order', ''), ','), props ->> 'tagline_choice') as shown_position,
  coalesce(props ->> 'ellis', '') as ellis,
  count(*) as responses
from public.pmf_events
where name = 'beta_survey_completed'
group by 1, 2, 3, 4, 5;

revoke all on public.pmf_events, public.pmf_users, public.pmf_activation_funnel, public.pmf_repeat_cohorts,
  public.pmf_weekly_returning_pricers, public.pmf_share_loop, public.pmf_paid_funnel, public.pmf_messaging_test
  from anon;
grant select on public.pmf_events, public.pmf_users, public.pmf_activation_funnel, public.pmf_repeat_cohorts,
  public.pmf_weekly_returning_pricers, public.pmf_share_loop, public.pmf_paid_funnel, public.pmf_messaging_test
  to authenticated;
