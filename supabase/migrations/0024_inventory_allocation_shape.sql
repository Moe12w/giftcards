-- 0024_inventory_allocation_shape.sql
-- A code that has left the available pool must record when it was allocated.
-- The order is optional: a partner can reserve stock before the order exists,
-- so the timestamp is what the rule checks, not the order reference.

alter table public.enterprise_code_inventory
  drop constraint if exists inventory_allocation_shape;

alter table public.enterprise_code_inventory
  add constraint inventory_allocation_shape check (
    status in ('available', 'reserved', 'quarantined', 'invalid', 'expired', 'cancelled')
    or allocated_at is not null
  );
