-- 0026_notifications.sql
-- Notifications are written by the platform, not by the app: a voucher being
-- issued, delivered, opened or redeemed is what produces them. The trigger
-- runs as the table owner, so it is not blocked by the row level policies.

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
  elsif new.status = 'delivered' and old.status is distinct from 'delivered' then
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
  after insert or update of status on public.vouchers
  for each row execute function public.notify_on_voucher_event();

-- The same for a voucher that is about to expire.
create or replace function public.notify_on_voucher_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expires_at is null or new.status <> 'claimed' then
    return new;
  end if;

  if exists (
    select 1 from public.notifications n
    where n.user_id = new.buyer_id
      and n.kind = 'expiry'
      and (n.payload ->> 'gift_id') = new.id::text
  ) then
    return new;
  end if;

  insert into public.notifications (user_id, kind, title_key, body_key, payload)
  values (
    new.buyer_id,
    'expiry',
    'notifications.expiry',
    'notifications.expiryBody',
    jsonb_build_object('gift_id', new.id, 'voucher_code', new.voucher_code)
  );

  return new;
end;
$$;

drop trigger if exists vouchers_notify_expiry on public.vouchers;
create trigger vouchers_notify_expiry
  after update of expires_at on public.vouchers
  for each row execute function public.notify_on_voucher_expiry();
