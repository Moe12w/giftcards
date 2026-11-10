-- 0006_fulfill_order.sql
-- Idempotent order fulfilment used by the payment webhook.
-- A paid invoice can arrive more than once; this function issues at most one
-- card per order.

alter table public.orders
  add column if not exists recipient_name text,
  add column if not exists recipient_email text,
  add column if not exists recipient_phone text,
  add column if not exists gift_message text;

create or replace function public.fulfill_order(
  p_provider_invoice_id text,
  p_claim_token_hash text,
  p_card_code_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_card_id uuid;
  v_expires timestamptz;
begin
  select * into v_order
  from public.orders
  where provider_invoice_id = p_provider_invoice_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  -- Already fulfilled: return the existing card (never create a second one).
  if v_order.status = 'paid' then
    select id into v_card_id
    from public.gift_cards
    where order_id = v_order.id
    limit 1;
    return v_card_id;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'order not payable';
  end if;

  select valid_until into v_expires
  from public.offers
  where id = v_order.offer_id;

  update public.orders set status = 'paid' where id = v_order.id;

  v_card_id := public.issue_gift_card(
    v_order.offer_id,
    v_order.id,
    v_order.buyer_id,
    v_order.amount_minor,
    p_claim_token_hash,
    v_order.recipient_name,
    v_order.recipient_email,
    v_order.recipient_phone,
    v_expires
  );

  update public.gift_cards
  set card_code_hash = p_card_code_hash
  where id = v_card_id;

  return v_card_id;
end;
$$;

revoke all on function public.fulfill_order(text, text, text) from public;
grant execute on function public.fulfill_order(text, text, text) to service_role;
