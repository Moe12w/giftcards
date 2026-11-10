-- 0023_ledger_redemption_link.sql
-- The redemption functions write the ledger entry and the redemption record
-- together, so the ledger row points back at the redemption that caused it and
-- at the staff member who performed it.

alter table public.ledger_entries
  add column if not exists redemption_id uuid references public.redemptions (id) on delete set null;

alter table public.ledger_entries
  add column if not exists staff_user_id uuid references auth.users (id) on delete set null;

create index if not exists ledger_entries_redemption_idx
  on public.ledger_entries (redemption_id);

create index if not exists ledger_entries_staff_idx
  on public.ledger_entries (staff_user_id);
