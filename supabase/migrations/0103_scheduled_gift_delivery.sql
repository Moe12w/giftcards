-- 0103_scheduled_gift_delivery.sql
-- Delivering gifts on the date they were scheduled for.
--
-- A scheduled gift is a voucher with `scheduled_for` in the future. Nothing in
-- the platform acted on that date: the voucher stayed undelivered until a human
-- touched it, so the buyer never got the "delivered" notification and the app
-- kept showing the gift as waiting.
--
-- This function delivers everything that has come due. It only moves the
-- delivery state; the existing `vouchers_notify` trigger writes the buyer's
-- notification, and the balance/ledger is untouched, so nothing about the
-- money rules changes.
--
-- Safe to call as often as you like: a voucher already marked delivered is
-- excluded, so a repeated run is a no-op.

create or replace function public.deliver_scheduled_gifts(p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not allowed';
  end if;

  with due as (
    select v.id
    from public.vouchers v
    where v.scheduled_for is not null
      and v.scheduled_for <= now()
      and coalesce(v.delivery_status, '') <> 'delivered'
      and v.status not in ('void', 'cancelled', 'expired')
    order by v.scheduled_for asc
    limit greatest(coalesce(p_limit, 200), 1)
    for update skip locked
  )
  update public.vouchers v
  set delivery_status = 'delivered',
      updated_at = now()
  from due
  where v.id = due.id;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke all on function public.deliver_scheduled_gifts(integer) from public;
grant execute on function public.deliver_scheduled_gifts(integer) to authenticated, service_role;
