-- 0118_advertising_slot_availability_labels.sql
-- The wizard labelled a slot "free now" whenever nothing was running in it at
-- that moment, even when a campaign booked later in the same slot leaves no
-- room for a fresh run of six-hour periods. Checkout already books the first
-- window that fits, so the label promised a start the booking could not honour.
--
-- The map now also returns the booked intervals per slot, which is all the
-- wizard needs to apply the same rule as advertising_next_slot_window().

drop function if exists public.advertising_slot_map();

create or replace function public.advertising_slot_map()
returns table (
  placement_key text,
  slot_number integer,
  state text,
  occupied_until timestamptz,
  next_free_at timestamptz,
  booked jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with active_placements as (
    select p.key, greatest(coalesce(p.slot_count, 0), 0) as slot_count
    from public.advertising_placements p
    where p.is_active and coalesce(p.slot_count, 0) > 0
  ),
  slots as (
    select a.key, generate_series(1, a.slot_count) as slot_number
    from active_placements a
  ),
  blocking as (
    select c.placement_key, c.slot_number, c.starts_at, c.ends_at
    from public.advertising_campaigns c
    where c.status in ('active', 'scheduled', 'pending_approval', 'pending_payment')
      and c.ends_at > now()
  ),
  intervals as (
    select
      b.placement_key,
      b.slot_number,
      jsonb_agg(
        jsonb_build_object('starts_at', b.starts_at, 'ends_at', b.ends_at)
        order by b.starts_at
      ) as booked
    from blocking b
    group by b.placement_key, b.slot_number
  )
  select
    s.key,
    s.slot_number,
    case
      when exists (
        select 1 from blocking b
        where b.placement_key = s.key
          and b.slot_number = s.slot_number
          and b.starts_at <= now()
      ) then 'occupied'
      when exists (
        select 1 from blocking b
        where b.placement_key = s.key
          and b.slot_number = s.slot_number
      ) then 'reserved'
      else 'free'
    end,
    (
      select max(b.ends_at) from blocking b
      where b.placement_key = s.key
        and b.slot_number = s.slot_number
        and b.starts_at <= now()
    ),
    (
      select max(b.ends_at) from blocking b
      where b.placement_key = s.key
        and b.slot_number = s.slot_number
    ),
    coalesce(i.booked, '[]'::jsonb)
  from slots s
  left join intervals i
    on i.placement_key = s.key
   and i.slot_number = s.slot_number
  order by s.key, s.slot_number;
$$;

grant execute on function public.advertising_slot_map() to authenticated;
grant execute on function public.advertising_slot_map() to service_role;
