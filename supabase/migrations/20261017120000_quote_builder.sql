-- Quote builder sheet. Additive and not applied by the app.
-- The running app stores the sheet in guide_quotes.sources as meta:sheet=
-- until this column exists in a database that is not production.
-- Do not run this against production from the app or a preview that shares production.

alter table public.guide_quotes
  add column if not exists sheet jsonb;

comment on column public.guide_quotes.sheet is
  'Line items, typed columns, and one safe formula per calculated column.';
