-- 0116_advertising_two_minute_hold.sql
-- An unpaid draft holds its slot for two minutes.
--
-- The hold is what the checkout countdown shows. While it is live, another
-- advertiser cannot start a checkout for the same slot and window; once it
-- expires the slot is free for anyone, exactly as if the draft did not exist.
-- Paying extends the hold by two minutes so the card form has time to finish.

alter table public.advertising_campaigns
  add column if not exists hold_expires_at timestamptz;

create index if not exists advertising_campaigns_hold_idx
  on public.advertising_campaigns (hold_expires_at)
  where hold_expires_at is not null;

-- Every new draft starts its two-minute hold immediately.
create or replace function public.advertising_set_draft_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_status is distinct from 'paid'
     and new.status in ('draft', 'rejected')
     and new.hold_expires_at is null then
    new.hold_expires_at := now() + interval '2 minutes';
  end if;
  return new;
end;
$$;

drop trigger if exists advertising_draft_hold on public.advertising_campaigns;
create trigger advertising_draft_hold
before insert on public.advertising_campaigns
for each row execute function public.advertising_set_draft_hold();

-- Starting a checkout checks the live hold and then restarts it, so the
-- advertiser gets a fresh two minutes on the payment page.
create or replace function public.advertising_start_checkout(
  p_campaign_id uuid,
  p_invoice_id text,
  p_payment_url text,
  p_provider text default 'myfatoorah',
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  tx record;
  v_tx uuid;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not public.advertising_can_manage_vendor(c.vendor_id) then
    raise exception 'not_authorized';
  end if;

  if c.payment_status = 'paid' then
    return jsonb_build_object(
      'campaign_id', c.id,
      'status', c.status,
      'already_paid', true,
      'amount_minor', c.quote_amount_minor,
      'currency', c.currency);
  end if;

  if c.status not in ('draft', 'rejected', 'pending_payment') then
    raise exception 'campaign_not_payable';
  end if;

  -- Never open a checkout for a window that is already gone.
  if c.ends_at <= now() then
    raise exception 'booking_window_expired';
  end if;

  if coalesce(trim(p_invoice_id), '') = '' then
    raise exception 'invoice_required';
  end if;

  -- The two-minute hold decides who gets the slot. Another draft only blocks it
  -- while its own hold is live; an expired hold never blocks anyone.
  if c.slot_number is not null and exists (
    select 1
    from public.advertising_campaigns x
    where x.id <> c.id
      and x.payment_status is distinct from 'paid'
      and x.placement_key = c.placement_key
      and x.slot_number = c.slot_number
      and x.starts_at < c.ends_at
      and x.ends_at > c.starts_at
      and (
        x.status in ('active', 'scheduled', 'pending_approval', 'pending_payment', 'paused')
        or (x.status in ('draft', 'rejected')
            and x.hold_expires_at is not null
            and x.hold_expires_at > now())
      )
  ) then
    raise exception 'slot_unavailable';
  end if;

  select * into tx
  from public.advertising_transactions
  where campaign_id = c.id and kind = 'payment'
  order by created_at desc
  limit 1;

  if found then
    if tx.status = 'succeeded' then
      return jsonb_build_object(
        'campaign_id', c.id,
        'status', c.status,
        'already_paid', true,
        'amount_minor', c.quote_amount_minor,
        'currency', c.currency);
    end if;

    update public.advertising_transactions
    set status = 'pending',
        provider = coalesce(p_provider, 'myfatoorah'),
        provider_reference = p_invoice_id,
        amount_minor = c.quote_amount_minor,
        currency = c.currency,
        raw_payload = coalesce(p_meta, '{}'::jsonb)
          || jsonb_build_object('invoice_id', p_invoice_id, 'payment_url', p_payment_url),
        processed_at = null
    where id = tx.id;
    v_tx := tx.id;
  else
    insert into public.advertising_transactions
      (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
       provider_reference, idempotency_key, description, raw_payload, created_by)
    values
      (c.id, c.vendor_id, 'payment', 'pending', c.quote_amount_minor, c.currency,
       coalesce(p_provider, 'myfatoorah'), p_invoice_id,
       'payment:' || c.id::text, 'Advertising card payment',
       coalesce(p_meta, '{}'::jsonb)
         || jsonb_build_object('invoice_id', p_invoice_id, 'payment_url', p_payment_url),
       auth.uid())
    returning id into v_tx;
  end if;

  update public.advertising_campaigns
  set payment_provider = coalesce(p_provider, 'myfatoorah'),
      payment_reference = p_invoice_id,
      hold_expires_at = now() + interval '2 minutes',
      updated_at = now()
  where id = c.id;

  perform public.advertising_audit(
    'checkout_started', 'advertising_campaign', c.id,
    jsonb_build_object('provider', p_provider, 'invoice_id', p_invoice_id,
                       'amount_minor', c.quote_amount_minor));

  return jsonb_build_object(
    'campaign_id', c.id,
    'transaction_id', v_tx,
    'amount_minor', c.quote_amount_minor,
    'currency', c.currency,
    'status', c.status,
    'already_paid', false);
end;
$$;

grant execute on function public.advertising_start_checkout(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.advertising_start_checkout(uuid, text, text, text, jsonb) to service_role;
