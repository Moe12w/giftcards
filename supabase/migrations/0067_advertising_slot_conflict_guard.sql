-- 0067_advertising_slot_conflict_guard.sql
-- Closes a double-booking hole in slot activation.
--
-- `advertising_create_campaign` reserves a numbered slot when the draft is
-- created. By the time the advertiser pays, another campaign may have booked
-- the same slot and window (for example two drafts reserved the same slot and
-- the second one paid first). `advertising_assign_inventory` used to promote
-- the old `reserved` row to `occupied` without re-checking the calendar, and
-- `advertising_campaign_is_eligible` accepted any `occupied` row, so both
-- campaigns could deliver into one slot.
--
-- This migration adds one shared conflict predicate and uses it everywhere:
-- a numbered slot is free only when no other blocking campaign holds an
-- overlapping reservation for it.

-- ---------------------------------------------------------------------------
-- 1. Shared slot conflict predicate
-- ---------------------------------------------------------------------------

create or replace function public.advertising_slot_is_free(
  p_placement_id uuid,
  p_slot_number integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_campaign_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.advertising_inventory inv
    join public.advertising_campaigns ac on ac.id = inv.campaign_id
    where inv.placement_id = p_placement_id
      and inv.slot_index = p_slot_number
      and inv.status in ('occupied', 'reserved')
      and ac.status in ('active', 'scheduled', 'pending_approval', 'pending_payment')
      and (p_exclude_campaign_id is null or ac.id <> p_exclude_campaign_id)
      and ac.starts_at < p_ends_at
      and ac.ends_at > p_starts_at
  );
$$;

revoke execute on function public.advertising_slot_is_free(uuid, integer, timestamptz, timestamptz, uuid) from public;

-- ---------------------------------------------------------------------------
-- 2. Capacity must mean "this slot is actually free"
-- ---------------------------------------------------------------------------

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

  select * into p from public.advertising_placements where id = c.placement_id;
  if not found or not p.is_active then
    return false;
  end if;

  -- A numbered slot is a physical position in the carousel. An admin capacity
  -- override can raise shared-placement limits, but it can never place two
  -- campaigns in the same slot at the same time.
  if p.slot_count > 0 then
    if c.slot_number is not null then
      return public.advertising_slot_is_free(
        p.id, c.slot_number, c.starts_at, c.ends_at, c.id
      );
    end if;

    for v_slot in 1..p.slot_count loop
      if public.advertising_slot_is_free(p.id, v_slot, c.starts_at, c.ends_at, c.id) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if c.capacity_override then
    return true;
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

-- ---------------------------------------------------------------------------
-- 3. Assigning inventory must re-check the calendar
-- ---------------------------------------------------------------------------

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
  v_found boolean := false;
  v_id uuid;
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    return null;
  end if;

  -- Lock the placement so two activations cannot evaluate the same slot at
  -- the same time.
  select * into p from public.advertising_placements where id = c.placement_id for update;
  if not found or p.slot_count <= 0 then
    return null;
  end if;

  if c.slot_number is not null then
    v_slot := c.slot_number;
    if not public.advertising_slot_is_free(p.id, v_slot, c.starts_at, c.ends_at, c.id) then
      -- Someone else booked this slot after our draft reserved it. Leave the
      -- campaign queued instead of promoting a stale reservation.
      return null;
    end if;
  else
    -- Legacy campaign without a chosen slot: take the first free one.
    for v_slot in 1..p.slot_count loop
      if public.advertising_slot_is_free(p.id, v_slot, c.starts_at, c.ends_at, c.id) then
        v_found := true;
        exit;
      end if;
    end loop;
    if not v_found then
      return null;
    end if;
  end if;

  -- Drop any stale reservation this campaign holds in another slot.
  update public.advertising_inventory
  set status = 'released', updated_at = now()
  where campaign_id = c.id
    and status in ('occupied', 'reserved')
    and (placement_id <> p.id or slot_index <> v_slot);

  select id into v_id
  from public.advertising_inventory
  where campaign_id = c.id
    and placement_id = p.id
    and slot_index = v_slot
    and status in ('occupied', 'reserved')
  order by created_at asc
  limit 1;

  if v_id is not null then
    update public.advertising_inventory
    set status = 'occupied',
        starts_at = c.starts_at,
        ends_at = c.ends_at,
        updated_at = now()
    where id = v_id;
  else
    insert into public.advertising_inventory
      (placement_id, campaign_id, slot_index, status, starts_at, ends_at)
    values
      (p.id, c.id, v_slot, 'occupied', c.starts_at, c.ends_at)
    returning id into v_id;
  end if;

  -- Keep the campaign row in step when a legacy campaign was assigned a slot.
  if c.slot_number is distinct from v_slot then
    update public.advertising_campaigns
    set slot_number = v_slot, updated_at = now()
    where id = c.id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Eligibility must reject a conflicted slot, not just look for any row
-- ---------------------------------------------------------------------------

create or replace function public.advertising_campaign_is_eligible(p_campaign_id uuid)
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
begin
  select * into c from public.advertising_campaigns where id = p_campaign_id;
  if not found or c.status <> 'active' then
    return false;
  end if;
  if c.payment_status <> 'paid' then
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

  if p.slot_count > 0 then
    if not exists (
      select 1 from public.advertising_inventory
      where campaign_id = c.id and status = 'occupied'
    ) then
      return false;
    end if;

    -- Delivery conflict guard. A queued `scheduled` campaign must not block
    -- the live occupant, so only other `active` campaigns are compared. If a
    -- legacy double-booking exists, the campaign that activated first keeps
    -- the slot and the other stops delivering.
    if exists (
      select 1
      from public.advertising_inventory mine
      join public.advertising_inventory other
        on other.placement_id = mine.placement_id
       and other.slot_index = mine.slot_index
       and other.campaign_id <> mine.campaign_id
       and other.status = 'occupied'
      join public.advertising_campaigns ac
        on ac.id = other.campaign_id
       and ac.status = 'active'
       and ac.starts_at < c.ends_at
       and ac.ends_at > c.starts_at
      where mine.campaign_id = c.id
        and mine.status = 'occupied'
        and (
          coalesce(ac.activated_at, ac.created_at) < coalesce(c.activated_at, c.created_at)
          or (
            coalesce(ac.activated_at, ac.created_at) = coalesce(c.activated_at, c.created_at)
            and ac.id < c.id
          )
        )
    ) then
      return false;
    end if;
  end if;

  if c.vendor_id is not null then
    select * into v from public.vendors where id = c.vendor_id;
    if not found or v.status <> 'approved' or not v.advertising_enabled then
      return false;
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

  -- For a numbered slot the checks above already proved ownership of the
  -- slot. Calling capacity_available here would treat a queued campaign's
  -- reservation as a conflict and stop the rightful occupant from delivering.
  if p.slot_count > 0 then
    return true;
  end if;

  return public.advertising_capacity_available(c.id);
end;
$$;
