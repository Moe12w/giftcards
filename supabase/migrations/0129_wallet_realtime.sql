-- 0129_wallet_realtime.sql
-- Push wallet balance changes to the customer app without a manual refresh.
-- Voucher rows already use RLS (buyer_id/claimed_by), and Realtime enforces
-- the same policies for the signed-in customer.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vouchers'
  ) then
    alter publication supabase_realtime add table public.vouchers;
  end if;
end $$;

-- UPDATE events need the full row so RLS can decide who may receive it.
alter table public.vouchers replica identity full;
