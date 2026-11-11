-- ---------------------------------------------------------------------------
-- Fix: the voucher notification trigger compared vouchers.status with the
-- value 'delivered', which is not part of the voucher_status enum.
--
-- Postgres refused to cast it, so every update of vouchers.status raised
-- "invalid input value for enum voucher_status: delivered" and broke every
-- redemption, in the app and in the dashboard.
--
-- Delivery lives in the delivery_status column, so that is what the trigger
-- reads now.
-- ---------------------------------------------------------------------------

create or replace function public.notify_on_voucher_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_title text;
  v_body text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'received';
    v_title := 'notifications.received';
    v_body := 'notifications.receivedBody';
  elsif new.delivery_status = 'delivered'
        and old.delivery_status is distinct from 'delivered' then
    v_kind := 'delivered';
    v_title := 'notifications.delivered';
    v_body := 'notifications.deliveredBody';
  elsif new.status = 'claimed' and old.status is distinct from 'claimed' then
    v_kind := 'opened';
    v_title := 'notifications.opened';
    v_body := 'notifications.openedBody';
  elsif new.status = 'redeemed' and old.status is distinct from 'redeemed' then
    v_kind := 'redeemed';
    v_title := 'notifications.redeemed';
    v_body := 'notifications.redeemedBody';
  else
    return new;
  end if;

  if new.buyer_id is null then
    return new;
  end if;

  insert into public.notifications (user_id, kind, title_key, body_key, payload)
  values (
    new.buyer_id,
    v_kind,
    v_title,
    v_body,
    jsonb_build_object('gift_id', new.id, 'voucher_code', new.voucher_code)
  );

  return new;
end;
$$;

drop trigger if exists vouchers_notify on public.vouchers;
create trigger vouchers_notify
  after insert or update of status, delivery_status on public.vouchers
  for each row execute function public.notify_on_voucher_event();
