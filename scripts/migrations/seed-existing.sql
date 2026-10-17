-- Prod-like rows created before the pending migrations, so the check can prove
-- the pending chain keeps existing data. Local Postgres only.

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'seller@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'roofer@example.test')
on conflict (id) do nothing;

-- One funnel event for every name the pre-release check constraint accepts.
do $$
declare
  def text;
  event_name text;
begin
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conrelid = 'public.funnel_events'::regclass and conname = 'funnel_events_name_check';
  for event_name in select (regexp_matches(def, '''([a-z_0-9]+)''', 'g'))[1] loop
    insert into public.funnel_events (user_id, name) values ('00000000-0000-4000-8000-000000000001', event_name);
  end loop;
end
$$;

insert into public.guide_users (user_id, variant)
values ('00000000-0000-4000-8000-000000000001', 'a'), ('00000000-0000-4000-8000-000000000002', 'b')
on conflict do nothing;

insert into public.quotes (id, user_id, title, customer_name, share_token)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Used wooden dresser', '', 'seed-share-token'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Roof repair', '', null);

insert into public.guide_quotes (user_id, quote_id, path, step, description, price_cents)
values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'item', 'share', 'Used wooden dresser', 24000),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'job', 'adjust', 'Roof repair', 185000);

-- A saved library item pointing at a pre-release roofing sku, if the catalog has one.
insert into public.library_items (user_id, sku_id, name, unit, unit_price_cents, source)
select '00000000-0000-4000-8000-000000000002', s.id, s.name, s.unit, s.list_price_cents, 'catalog'
from public.skus s
order by s.sku_code
limit 3;
