-- 0172_basket_claim.sql
-- Adds a claim flow to gift baskets, mirroring the gift-card claim flow, so a
-- recipient can "receive" a sent basket (and the gift cards inside it) the same
-- way they receive an individual gift card.
--
-- A basket that is sent (status = 'completed') gets a recipient_id and a
-- claim_token_hash. The recipient claims it by presenting the raw token; the
-- database hashes it and compares. On claim, the basket's items become vouchers
-- in the recipient's wallet (claimed_by = recipient, status = 'claimed').

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.gift_baskets
  add column if not exists recipient_id uuid references public.profiles (id) on delete set null,
  add column if not exists claim_token_hash text;

create index if not exists gift_baskets_recipient_idx
  on public.gift_baskets (recipient_id);

-- ---------------------------------------------------------------------------
-- claim_basket: claim a sent basket for the signed-in recipient.
-- Creates a voucher for each basket item, sets claimed_by to the recipient,
-- and returns the basket id on success. Returns null if the token is invalid
-- or already claimed by someone else.
-- ---------------------------------------------------------------------------
create or replace function public.claim_basket(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_basket_id uuid;
  v_recipient_id uuid;
  v_recipient_name text;
  v_recipient_email text;
  item record;
  v_vendor_id uuid;
  v_fulfilment public.fulfilment_type;
  v_code text;
  v_card_id uuid;
  v_sessions integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select id, recipient_id, recipient_name
    into v_basket_id, v_recipient_id, v_recipient_name
    from public.gift_baskets
    where claim_token_hash = v_hash
      and status = 'completed';

  if v_basket_id is null then
    return null;
  end if;

  -- Already claimed by someone else.
  if v_recipient_id is not null and v_recipient_id <> auth.uid() then
    return null;
  end if;

  -- Already claimed by this user — return without re-creating vouchers.
  if v_recipient_id = auth.uid() then
    return v_basket_id;
  end if;

  -- Get recipient email from profile.
  select email into v_recipient_email
    from public.profiles
    where id = auth.uid();

  -- Claim the basket.
  update public.gift_baskets
    set recipient_id = auth.uid()
    where id = v_basket_id;

  -- Add the claimer as a participant so they can read the book.
  insert into public.gift_basket_participants (basket_id, user_id, name, is_owner)
    values (v_basket_id, auth.uid(), coalesce(v_recipient_name, 'Recipient'), false)
    on conflict (basket_id, user_id) do nothing;

  -- Create a voucher for each basket item.
  for item in
    select i.offer_id, i.vendor_id, i.title, i.amount_minor
    from public.gift_basket_items i
    where i.basket_id = v_basket_id
  loop
    select vendor_id, fulfilment_type
      into v_vendor_id, v_fulfilment
      from public.products
      where id = item.offer_id;

    if v_fulfilment = 'experience' then
      -- Look up session count from the product.
      select session_count into v_sessions
        from public.products
        where id = item.offer_id;

      v_code := public.generate_voucher_code();

      insert into public.vouchers (
        product_id, order_id, buyer_id, recipient_name, recipient_email,
        initial_value_minor, remaining_value_minor,
        claim_token_hash, expires_at, vendor_id, fulfilment_type, status,
        voucher_code, card_code_hash,
        total_sessions, remaining_sessions, used_sessions,
        claimed_by, claimed_at, delivery_status
      )
      values (
        item.offer_id, null, null, v_recipient_name, v_recipient_email,
        item.amount_minor, item.amount_minor,
        null, null, coalesce(v_vendor_id, item.vendor_id::uuid), 'experience', 'claimed',
        v_code, encode(extensions.digest(upper(v_code), 'sha256'), 'hex'),
        coalesce(v_sessions, 1), coalesce(v_sessions, 1), 0,
        auth.uid(), now(), 'delivered'
      )
      returning id into v_card_id;
    else
      v_code := public.generate_voucher_code();

      insert into public.vouchers (
        product_id, order_id, buyer_id, recipient_name, recipient_email,
        initial_value_minor, remaining_value_minor,
        claim_token_hash, expires_at, vendor_id, fulfilment_type, status,
        voucher_code, card_code_hash,
        claimed_by, claimed_at, delivery_status
      )
      values (
        item.offer_id, null, null, v_recipient_name, v_recipient_email,
        item.amount_minor, item.amount_minor,
        null, null, coalesce(v_vendor_id, item.vendor_id::uuid), 'monetary', 'claimed',
        v_code, encode(extensions.digest(upper(v_code), 'sha256'), 'hex'),
        auth.uid(), now(), 'delivered'
      )
      returning id into v_card_id;
    end if;

    -- Ledger entry for the issue.
    insert into public.ledger_entries (voucher_id, order_id, entry_type, amount_minor)
      values (v_card_id, null, 'issue', item.amount_minor);
  end loop;

  return v_basket_id;
end;
$$;

revoke all on function public.claim_basket(text) from public;
grant execute on function public.claim_basket(text) to authenticated;

-- ---------------------------------------------------------------------------
-- mint_basket_claim_token: generate a fresh claim token for a completed basket.
-- Returns the raw token (caller must deliver it to the recipient). Only the
-- hash is stored.
-- ---------------------------------------------------------------------------
create or replace function public.mint_basket_claim_token(p_basket_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_hash text;
begin
  -- Only the creator (or admin) may mint a token for their basket.
  if not exists (
    select 1 from public.gift_baskets b
    where b.id = p_basket_id
      and (b.creator_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'Not authorized';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  update public.gift_baskets
    set claim_token_hash = v_hash
    where id = p_basket_id;

  return v_token;
end;
$$;

revoke all on function public.mint_basket_claim_token(uuid) from public;
grant execute on function public.mint_basket_claim_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: recipients can read baskets they've claimed.
-- ---------------------------------------------------------------------------
drop policy if exists gift_baskets_select_recipient on public.gift_baskets;
create policy gift_baskets_select_recipient on public.gift_baskets
  for select using (recipient_id = auth.uid());