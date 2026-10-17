-- Navigation by trade (#54): file each guide quote under a trade and subcategory.
-- Additive. Safe to run again. Ids come from lib/trades.ts, so no check constraint:
-- adding a trade there must not need a migration.
-- Until this runs, the app files quotes by keyword and saves without these columns.

alter table public.guide_quotes
  add column if not exists trade text,
  add column if not exists trade_category text;

create index if not exists guide_quotes_user_trade_idx
  on public.guide_quotes (user_id, trade, updated_at desc);
