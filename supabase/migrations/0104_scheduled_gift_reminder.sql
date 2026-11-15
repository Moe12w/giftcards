-- 0104_scheduled_gift_reminder.sql
-- The nudge a scheduled gift needs on the day it comes due.
--
-- Email can be sent by the server, but WhatsApp, SMS and a plain link cannot:
-- those messages go out from the buyer's own phone, so somebody has to press
-- send. A scheduled gift nobody sends is a gift that never arrives, and until
-- now the buyer was only told "delivered" after the fact.
--
-- Two pieces here:
--   1. The delivery notification becomes an instruction when the gift was
--      scheduled and nobody has claimed it yet: "send the claim link".
--   2. `buyer_claim_link` lets the buyer get that link back, because only the
--      hash of a claim token is stored and the original link is gone.

-- ---------------------------------------------------------------------------
-- 1. "Gift due" instead of "Gift delivered" for a scheduled gift nobody opened
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
    -- A scheduled gift is only "delivered" by the calendar: the buyer still has
    -- to send it, unless the recipient has already claimed it.
    if new.scheduled_for is not null and new.claimed_by is null then
      v_kind := 'due';
      v_title := 'notifications.due';
      v_body := 'notifications.dueBody';
    else
      v_kind := 'delivered';
      v_title := 'notifications.delivered';
      v_body := 'notifications.deliveredBody';
    end if;
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

-- ---------------------------------------------------------------------------
-- 2. The buyer's own claim link
-- ---------------------------------------------------------------------------
--
-- The original token is minted once, at purchase, and only its hash is stored,
-- so the link cannot be read back. This mints a fresh one for the gift's buyer
-- and returns it so the app can put it in a WhatsApp message.
--
-- It refuses a gift that was already claimed (rotating would break the
-- recipient's card without warning) and a closed one, and bulk orders keep
-- their own resend flow in the business dashboard.

create or replace function public.buyer_claim_link(p_voucher_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;

  select * into v_voucher
  from public.vouchers
  where id = p_voucher_id
  for update;

  if not found then
    raise exception 'voucher not found';
  end if;

  if v_voucher.buyer_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;

  if v_voucher.claimed_by is not null then
    raise exception 'this gift has already been claimed';
  end if;

  if v_voucher.status not in ('issued', 'claimed') then
    raise exception 'this gift can no longer be claimed';
  end if;

  if exists (select 1 from public.bulk_order_vouchers where voucher_id = p_voucher_id) then
    raise exception 'this voucher belongs to a bulk order; resend it from the business dashboard';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.vouchers
  set claim_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      updated_at = now()
  where id = p_voucher_id;

  return v_token;
end;
$$;

revoke all on function public.buyer_claim_link(uuid) from public;
grant execute on function public.buyer_claim_link(uuid) to authenticated;
