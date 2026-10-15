-- Feedback mode: triage status, and the reporter email for a later follow-up.
-- Additive. Does not change auth settings. Safe to run again.

alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback
  add constraint feedback_status_check
  check (status in ('triage', 'new', 'planned', 'in_progress', 'shipped'));

alter table public.feedback
  add column if not exists email text not null default '';
