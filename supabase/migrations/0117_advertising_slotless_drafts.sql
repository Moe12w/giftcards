-- 0117_advertising_slotless_drafts.sql
-- A draft keeps only the ad details: placement, creative, name. It has no slot
-- and no time window until the advertiser books one, so reopening a draft always
-- asks for an available slot again. Slots therefore cannot go stale while a
-- draft sits around.

alter table public.advertising_campaigns alter column starts_at drop not null;
alter table public.advertising_campaigns alter column ends_at drop not null;

-- Existing unpaid drafts become slotless as well.
update public.advertising_campaigns
set slot_number = null,
    starts_at = null,
    ends_at = null,
    quote_amount_minor = 0,
    fixed_price_minor = 0,
    total_budget_minor = 0,
    hold_expires_at = null,
    updated_at = now()
where payment_status is distinct from 'paid'
  and status in ('draft', 'rejected');

-- Holds follow the slot, not the draft: a slotless draft holds nothing, and
-- booking or re-timing a slot starts a fresh two minutes.
create or replace function public.advertising_set_draft_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_status = 'paid' then
    new.hold_expires_at := null;
    return new;
  end if;

  if new.status not in ('draft', 'rejected') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.slot_number is not null and new.starts_at is not null and new.ends_at is not null then
      new.hold_expires_at := now() + interval '2 minutes';
    end if;
    return new;
  end if;

  if new.slot_number is not null
     and new.starts_at is not null
     and new.ends_at is not null
     and (old.slot_number is null
          or old.starts_at is distinct from new.starts_at
          or old.ends_at is distinct from new.ends_at) then
    new.hold_expires_at := now() + interval '2 minutes';
  end if;

  if new.slot_number is null then
    new.hold_expires_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists advertising_draft_hold on public.advertising_campaigns;
create trigger advertising_draft_hold
before insert or update on public.advertising_campaigns
for each row execute function public.advertising_set_draft_hold();

-- Save the ad details as a slotless draft (create or update).
create or replace function public.advertising_save_draft(
  p_campaign_id uuid,
  p_vendor_id uuid,
  p_placement_key text,
  p_pricing_id uuid,
  p_name text,
  p_creative jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  p record;
  pr record;
  c record;
  v_id uuid;
begin
  if not public.advertising_can_manage_vendor(p_vendor_id) then
    raise exception 'not_authorized';
  end if;

  select * into v from public.vendors where id = p_vendor_id;
  if not found or v.status <> 'approved' then
    raise exception 'vendor_not_approved';
  end if;
  if not v.advertising_enabled then
    raise exception 'advertising_suspended';
  end if;

  select * into p from public.advertising_placements
  where key = p_placement_key and is_active;
  if not found then
    raise exception 'placement_unavailable';
  end if;

  select * into pr from public.advertising_pricing
  where id = p_pricing_id and placement_id = p.id and is_active;
  if not found then
    raise exception 'pricing_unavailable';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  perform public.advertising_validate_creative(p_creative, p.format);

  if p_campaign_id is null then
    insert into public.advertising_campaigns
      (vendor_id, created_by, placement_id, placement_key, pricing_id, pricing_model,
       currency, name, status, quote_amount_minor, fixed_price_minor, starts_at,
       ends_at, total_budget_minor, daily_budget_minor, slot_number, pricing_snapshot)
    values
      (p_vendor_id, auth.uid(), p.id, p.key, pr.id, pr.pricing_model,
       pr.currency, trim(p_name), 'draft', 0, 0, null, null, 0, 0, null,
       jsonb_build_object(
         'pricing_id', pr.id, 'model', pr.pricing_model, 'currency', pr.currency,
         'version', pr.version, 'captured_at', now(), 'unbooked', true))
    returning id into v_id;
  else
    select * into c from public.advertising_campaigns where id = p_campaign_id for update;
    if not found then
      raise exception 'campaign_not_found';
    end if;
    if c.vendor_id <> p_vendor_id then
      raise exception 'not_authorized';
    end if;
    if c.payment_status = 'paid' then
      raise exception 'campaign_already_paid';
    end if;
    if c.status not in ('draft', 'rejected', 'pending_payment') then
      raise exception 'campaign_not_editable';
    end if;

    update public.advertising_campaigns
    set placement_id = p.id,
        placement_key = p.key,
        pricing_id = pr.id,
        pricing_model = pr.pricing_model,
        currency = pr.currency,
        name = trim(p_name),
        quote_amount_minor = 0,
        fixed_price_minor = 0,
        total_budget_minor = 0,
        daily_budget_minor = 0,
        slot_number = null,
        starts_at = null,
        ends_at = null,
        hold_expires_at = null,
        updated_at = now()
    where id = c.id;

    update public.advertising_campaign_budgets
    set total_budget_minor = 0,
        daily_budget_minor = 0,
        updated_at = now()
    where campaign_id = c.id;

    v_id := c.id;
  end if;

  update public.advertising_creatives
  set type = coalesce(nullif(p_creative->>'type', ''), type),
      headline = coalesce(p_creative->>'headline', headline),
      headline_ar = nullif(p_creative->>'headline_ar', ''),
      body = nullif(p_creative->>'body', ''),
      body_ar = nullif(p_creative->>'body_ar', ''),
      image_url = nullif(p_creative->>'image_url', ''),
      mobile_image_url = nullif(p_creative->>'mobile_image_url', ''),
      image_alt = nullif(p_creative->>'image_alt', ''),
      image_alt_ar = nullif(p_creative->>'image_alt_ar', ''),
      cta_label = nullif(p_creative->>'cta_label', ''),
      cta_label_ar = nullif(p_creative->>'cta_label_ar', ''),
      destination_type = coalesce(nullif(p_creative->>'destination_type', ''), 'business'),
      destination_id = nullif(p_creative->>'destination_id', '')::uuid,
      destination_url = nullif(p_creative->>'destination_url', ''),
      sponsored_label = coalesce(nullif(p_creative->>'sponsored_label', ''), 'Sponsored'),
      sponsored_label_ar = coalesce(nullif(p_creative->>'sponsored_label_ar', ''), 'إعلان مدفوع'),
      updated_at = now()
  where campaign_id = v_id and sort_order = 0;

  if not found then
    insert into public.advertising_creatives
      (campaign_id, type, headline, headline_ar, body, body_ar, image_url, mobile_image_url,
       image_alt, image_alt_ar, cta_label, cta_label_ar, destination_type, destination_id,
       destination_url, sponsored_label, sponsored_label_ar, status, sort_order)
    values
      (v_id, coalesce(p_creative->>'type', 'image'),
       coalesce(p_creative->>'headline', ''),
       nullif(trim(coalesce(p_creative->>'headline_ar', '')), ''),
       nullif(trim(coalesce(p_creative->>'body', '')), ''),
       nullif(trim(coalesce(p_creative->>'body_ar', '')), ''),
       nullif(trim(coalesce(p_creative->>'image_url', '')), ''),
       nullif(trim(coalesce(p_creative->>'mobile_image_url', '')), ''),
       nullif(trim(coalesce(p_creative->>'image_alt', '')), ''),
       nullif(trim(coalesce(p_creative->>'image_alt_ar', '')), ''),
       nullif(trim(coalesce(p_creative->>'cta_label', '')), ''),
       nullif(trim(coalesce(p_creative->>'cta_label_ar', '')), ''),
       coalesce(nullif(p_creative->>'destination_type', ''), 'business'),
       nullif(trim(coalesce(p_creative->>'destination_id', '')), '')::uuid,
       nullif(trim(coalesce(p_creative->>'destination_url', '')), ''),
       coalesce(p_creative->>'sponsored_label', 'Sponsored'),
       coalesce(p_creative->>'sponsored_label_ar', 'إعلان مدفوع'),
       'active', 0);
  end if;

  if p_campaign_id is null then
    insert into public.advertising_campaign_budgets
      (campaign_id, currency, total_budget_minor, daily_budget_minor, spent_minor, daily_spent_minor)
    values
      (v_id, pr.currency, 0, 0, 0, 0);
  end if;

  perform public.advertising_audit(
    'draft_saved', 'advertising_campaign', v_id,
    jsonb_build_object('vendor_id', p_vendor_id, 'placement_key', p.key));

  return v_id;
end;
$$;

grant execute on function public.advertising_save_draft(uuid, uuid, text, uuid, text, jsonb) to authenticated;
grant execute on function public.advertising_save_draft(uuid, uuid, text, uuid, text, jsonb) to service_role;
