-- 0112_advertising_credit_only_payments.sql
-- Advertising is paid from promotional credit only.
--
-- The manual bank-transfer path is retired: campaigns can no longer be
-- submitted for payment verification, so no reference or proof of payment is
-- ever produced. `advertising_pay_with_credit` is the only way to settle a
-- campaign, and it still refuses a window that has already ended.
--
-- The function is kept (rather than dropped) so any stale caller or bookmark
-- gets a clear error instead of a permission failure, and it changes nothing.

create or replace function public.advertising_submit_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'manual_payment_disabled';
end;
$$;

grant execute on function public.advertising_submit_campaign(uuid) to authenticated;
grant execute on function public.advertising_submit_campaign(uuid) to service_role;
