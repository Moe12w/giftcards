-- 0045_advertising_lifecycle_core.sql
-- Rule helpers, audit, notifications, charges, capacity and activation checks.

-- ---------------------------------------------------------------------------
-- 1. Rule helpers
-- ---------------------------------------------------------------------------

create or replace function public.advertising_rule_value(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select value
  from public.advertising_rules
  where key = p_key and is_active
  limit 1;
$$;

create or replace function public.advertising_rule_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.advertising_rules where key = p_key and is_active limit 1),
    p_default
  );
$$;

create or replace function public.advertising_rule_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value #>> '{}')::integer from public.advertising_rules where key = p_key and is_active limit 1),
    p_default
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Audit
-- ---------------------------------------------------------------------------

create or replace function public.advertising_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.advertising_audit_logs
    (actor_id, actor_role, action, entity_type, entity_id, before_state, after_state, details)
  values
    (auth.uid(), coalesce(auth.role(), 'system'), p_action, p_entity_type, p_entity_id,
     p_before, p_after, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Admin-only wrapper used by server actions after direct table edits.
create or replace function public.advertising_record_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  perform public.advertising_audit(p_action, p_entity_type, p_entity_id, p_details, p_before, p_after);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Notifications
-- ---------------------------------------------------------------------------

create or replace function public.advertising_notify(
  p_audience text,
  p_vendor_id uuid,
  p_campaign_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  if p_audience = 'admin' then
    insert into public.advertising_notifications
      (audience, vendor_id, user_id, campaign_id, kind, title, body, payload)
    values
      ('admin', p_vendor_id, null, p_campaign_id, p_kind, p_title, p_body,
       coalesce(p_payload, '{}'::jsonb));
  elsif p_vendor_id is not null then
    for m in
      select user_id
      from public.vendor_members
      where vendor_id = p_vendor_id
        and active
        and role in ('owner', 'manager')
    loop
      insert into public.advertising_notifications
        (audience, vendor_id, user_id, campaign_id, kind, title, body, payload)
      values
        ('vendor', p_vendor_id, m.user_id, p_campaign_id, p_kind, p_title, p_body,
         coalesce(p_payload, '{}'::jsonb));
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Daily stats
-- ---------------------------------------------------------------------------

create or replace function public.advertising_bump_stats(
  p_campaign_id uuid,
  p_date date,
  p_impressions bigint default 0,
  p_clicks bigint default 0,
  p_conversions bigint default 0,
  p_spend bigint default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select placement_id, vendor_id into c
  from public.advertising_campaigns
  where id = p_campaign_id;

  if not found then
    return;
  end if;

  insert into public.advertising_daily_stats
    (campaign_id, stat_date, placement_id, vendor_id, impressions, clicks, conversions, spend_minor, updated_at)
  values
    (p_campaign_id, p_date, c.placement_id, c.vendor_id, p_impressions, p_clicks, p_conversions, p_spend, now())
  on conflict (campaign_id, stat_date) do update set
    impressions = public.advertising_daily_stats.impressions + excluded.impressions,
    clicks = public.advertising_daily_stats.clicks + excluded.clicks,
    conversions = public.advertising_daily_stats.conversions + excluded.conversions,
    spend_minor = public.advertising_daily_stats.spend_minor + excluded.spend_minor,
    updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Inventory release and capacity
-- ---------------------------------------------------------------------------

create or replace function public.advertising_release_inventory(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.advertising_inventory
  set status = 'released', updated_at = now()
  where campaign_id = p_campaign_id
    and status in ('occupied', 'reserved');
end;
$$;

create or replace function public.advertising_capacity_available(p_campaign_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  p record;
  v_count integer;
  v_max integer;
  v_slot integer;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id;
  if not found then
    return false;
  end if;
  if c.capacity_override then
    return true;
  end if;

  select * into p from public.advertising_placements where id = c.placement_id;
  if not found or not p.is_active then
    return false;
  end if;

  if p.slot_count > 0 then
    if exists (
      select 1 from public.advertising_inventory
      where campaign_id = c.id and status in ('occupied', 'reserved')
    ) then
      return true;
    end if;

    for v_slot in 1..p.slot_count loop
      if not exists (
        select 1
        from public.advertising_inventory inv
        join public.advertising_campaigns ac on ac.id = inv.campaign_id
        where inv.placement_id = p.id
          and inv.slot_index = v_slot
          and inv.status = 'occupied'
          and ac.status in ('active', 'scheduled', 'pending_approval')
          and ac.starts_at < c.ends_at
          and ac.ends_at > c.starts_at
      ) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  v_max := coalesce(nullif(p.max_active_campaigns, 0),
                    public.advertising_rule_int('max_active_campaigns_per_placement', 5));
  if v_max <= 0 then
    return true;
  end if;

  select count(*) into v_count
  from public.advertising_campaigns
  where placement_id = p.id
    and status in ('active', 'scheduled')
    and id <> c.id;

  return v_count < v_max;
end;
$$;

create or replace function public.advertising_assign_inventory(p_campaign_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  p record;
  v_slot integer;
  v_id uuid;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id;
  if not found then
    return null;
  end if;

  select * into p from public.advertising_placements where id = c.placement_id;
  if not found or p.slot_count <= 0 then
    return null;
  end if;

  select id into v_id
  from public.advertising_inventory
  where campaign_id = c.id
  limit 1;

  if v_id is not null then
    update public.advertising_inventory
    set status = 'occupied', starts_at = c.starts_at, ends_at = c.ends_at, updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  for v_slot in 1..p.slot_count loop
    if not exists (
      select 1
      from public.advertising_inventory inv
      join public.advertising_campaigns ac on ac.id = inv.campaign_id
      where inv.placement_id = p.id
        and inv.slot_index = v_slot
        and inv.status = 'occupied'
        and ac.status in ('active', 'scheduled', 'pending_approval')
        and ac.starts_at < c.ends_at
        and ac.ends_at > c.starts_at
    ) then
      insert into public.advertising_inventory
        (placement_id, campaign_id, slot_index, status, starts_at, ends_at)
      values
        (p.id, c.id, v_slot, 'occupied', c.starts_at, c.ends_at)
      returning id into v_id;
      return v_id;
    end if;
  end loop;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Charge a CPC/CPM campaign
-- ---------------------------------------------------------------------------

create or replace function public.advertising_charge_campaign(
  p_campaign_id uuid,
  p_amount_minor bigint,
  p_kind text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  b record;
  v_charge bigint;
  v_tx uuid;
  v_balance bigint;
  v_total_left bigint;
  v_daily_left bigint;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    return 0;
  end if;
  if p_kind not in ('cpc_charge', 'cpm_charge', 'adjustment') then
    raise exception 'invalid_charge_kind';
  end if;
  if exists (select 1 from public.advertising_transactions where idempotency_key = p_idempotency_key) then
    return 0;
  end if;

  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    return 0;
  end if;
  if c.pricing_model = 'fixed' then
    return 0;
  end if;

  select * into b from public.advertising_campaign_budgets where campaign_id = p_campaign_id for update;
  if not found then
    return 0;
  end if;

  if b.daily_spent_date <> current_date then
    update public.advertising_campaign_budgets
    set daily_spent_minor = 0, daily_spent_date = current_date, updated_at = now()
    where id = b.id;
    b.daily_spent_minor := 0;
    b.daily_spent_date := current_date;
  end if;

  v_total_left := greatest(0, b.total_budget_minor - b.spent_minor);
  if v_total_left <= 0 then
    return 0;
  end if;

  if b.daily_budget_minor > 0 then
    v_daily_left := greatest(0, b.daily_budget_minor - b.daily_spent_minor);
  else
    v_daily_left := v_total_left;
  end if;

  v_charge := least(p_amount_minor, v_total_left, v_daily_left);
  if v_charge <= 0 then
    return 0;
  end if;

  insert into public.advertising_transactions
    (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
     provider_reference, idempotency_key, description, raw_payload, processed_at)
  values
    (c.id, c.vendor_id, p_kind, 'succeeded', v_charge, c.currency, 'internal',
     p_idempotency_key, p_idempotency_key, p_kind, coalesce(p_metadata, '{}'::jsonb), now())
  returning id into v_tx;

  v_balance := b.total_budget_minor - (b.spent_minor + v_charge);

  insert into public.advertising_ledger_entries
    (transaction_id, campaign_id, vendor_id, entry_type, entry_key, direction,
     amount_minor, balance_after_minor, currency, reference, metadata)
  values
    (v_tx, c.id, c.vendor_id, p_kind, 'tx:' || v_tx::text, 'debit',
     -v_charge, v_balance, c.currency, c.campaign_ref, coalesce(p_metadata, '{}'::jsonb));

  update public.advertising_campaign_budgets
  set spent_minor = spent_minor + v_charge,
      daily_spent_minor = daily_spent_minor + v_charge,
      daily_spent_date = current_date,
      updated_at = now()
  where id = b.id;

  perform public.advertising_bump_stats(c.id, current_date, 0, 0, 0, v_charge);

  if b.spent_minor + v_charge >= b.total_budget_minor then
    update public.advertising_campaigns
    set status = 'budget_exhausted',
        completed_at = coalesce(completed_at, now()),
        pause_reason = 'budget_exhausted',
        last_evaluated_at = now(),
        updated_at = now()
    where id = c.id;

    perform public.advertising_release_inventory(c.id);
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'budget_exhausted',
      'Advertising budget exhausted',
      'Campaign ' || c.name || ' has used its full budget and has stopped delivering.',
      jsonb_build_object('campaign_id', c.id));
    perform public.advertising_notify(
      'admin', c.vendor_id, c.id, 'budget_exhausted',
      'Advertiser budget exhausted',
      'Campaign ' || c.name || ' has used its full budget.',
      jsonb_build_object('campaign_id', c.id));

  elsif b.daily_budget_minor > 0 and b.daily_spent_minor + v_charge >= b.daily_budget_minor then
    update public.advertising_campaigns
    set status = 'paused',
        paused_at = now(),
        pause_reason = 'daily_budget',
        auto_resume_at = (current_date + 1)::timestamptz,
        last_evaluated_at = now(),
        updated_at = now()
    where id = c.id;

    perform public.advertising_release_inventory(c.id);
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'daily_budget_reached',
      'Daily budget reached',
      'Campaign ' || c.name || ' paused for today and will resume tomorrow.',
      jsonb_build_object('campaign_id', c.id, 'auto_resume_at', (current_date + 1)::timestamptz));
  end if;

  return v_charge;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Creative and activation readiness
-- ---------------------------------------------------------------------------

create or replace function public.advertising_has_creative(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.advertising_creatives
    where campaign_id = p_campaign_id
      and status = 'active'
      and length(trim(coalesce(headline, ''))) > 0
  );
$$;

create or replace function public.advertising_activation_ready(p_campaign_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  p record;
  v record;
  b record;
  v_max integer;
  v_count integer;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id;
  if not found then
    return false;
  end if;
  if c.payment_status <> 'paid' then
    return false;
  end if;
  if c.status not in ('scheduled', 'pending_approval', 'paused') then
    return false;
  end if;
  if public.advertising_rule_bool('approval_required', true) and c.approved_at is null then
    return false;
  end if;
  if not public.advertising_has_creative(c.id) then
    return false;
  end if;

  select * into p from public.advertising_placements where id = c.placement_id;
  if not found or not p.is_active then
    return false;
  end if;

  if c.vendor_id is not null then
    select * into v from public.vendors where id = c.vendor_id;
    if not found or v.status <> 'approved' or not v.advertising_enabled then
      return false;
    end if;

    v_max := public.advertising_rule_int('max_active_campaigns_per_vendor', 10);
    if v_max > 0 then
      select count(*) into v_count
      from public.advertising_campaigns
      where vendor_id = c.vendor_id
        and status in ('active', 'scheduled')
        and id <> c.id;
      if v_count >= v_max then
        return false;
      end if;
    end if;
  end if;

  if now() < c.starts_at or now() >= c.ends_at then
    return false;
  end if;

  if c.pricing_model <> 'fixed' then
    select * into b from public.advertising_campaign_budgets where campaign_id = c.id;
    if not found then
      return false;
    end if;
    if b.total_budget_minor > 0 and b.spent_minor >= b.total_budget_minor then
      return false;
    end if;
    if b.daily_budget_minor > 0
       and b.daily_spent_date = current_date
       and b.daily_spent_minor >= b.daily_budget_minor then
      return false;
    end if;
  end if;

  return public.advertising_capacity_available(c.id);
end;
$$;
