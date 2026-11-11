-- ---------------------------------------------------------------------------
-- Dashboard guide
--
-- New dashboard accounts get the animated walkthrough the first time they
-- sign in. The timestamp records that it has been seen so it stays closed
-- afterwards; the "Tutorial" button in the sidebar can still replay it.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists tutorial_completed_at timestamptz;

comment on column public.profiles.tutorial_completed_at is
  'When the dashboard walkthrough was last completed or skipped by this user.';
