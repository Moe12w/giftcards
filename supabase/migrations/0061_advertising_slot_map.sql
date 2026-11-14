-- 0061_advertising_slot_map.sql
-- Read-only slot availability for the campaign wizard and the admin inventory
-- view. It exposes only slot state and times, never another advertiser's data.

create or replace function public.advertising_slot_map()
returns table (
  placement_key text,
  slot_number integer,
  state text,
  occupied_until timestamptz,
  next_free_at timestamptz
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
    )
  from slots s
  order by s.key, s.slot_number;
$$;

grant execute on function public.advertising_slot_map() to authenticated;
grant execute on function public.advertising_slot_map() to service_role;
