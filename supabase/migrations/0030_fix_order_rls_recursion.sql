-- ---------------------------------------------------------------------------
-- Fix: the orders and order_items read policies referenced each other.
--
--   orders_select      -> EXISTS (select from order_items ...)
--   order_items_select -> EXISTS (select from orders ...)
--
-- Postgres detects that loop at runtime and refuses every read with
-- "infinite recursion detected in policy" (42P17), which broke order
-- history in the app and the admin dashboard.
--
-- The rules now live in security-definer helpers. They read the other table
-- with row security switched off, so the policies themselves stay flat and
-- the behaviour is unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.can_see_order(p_order_id uuid, p_buyer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    (p_buyer_id = auth.uid())
    or public.is_admin()
    or exists (
      select 1
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.vendor_id is not null
        and public.can_redeem_for(oi.vendor_id)
    );
$$;

create or replace function public.can_see_order_item(p_order_id uuid, p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    exists (
      select 1
      from public.orders o
      where o.id = p_order_id
        and o.buyer_id = auth.uid()
    )
    or public.is_admin()
    or (p_vendor_id is not null and public.can_redeem_for(p_vendor_id));
$$;

create or replace function public.buyer_owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.buyer_id = auth.uid()
  );
$$;

revoke all on function public.can_see_order(uuid, uuid) from public;
revoke all on function public.can_see_order_item(uuid, uuid) from public;
revoke all on function public.buyer_owns_order(uuid) from public;
grant execute on function public.can_see_order(uuid, uuid) to authenticated;
grant execute on function public.can_see_order_item(uuid, uuid) to authenticated;
grant execute on function public.buyer_owns_order(uuid) to authenticated;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to public
  using (public.can_see_order(id, buyer_id));

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select to public
  using (public.can_see_order_item(order_id, vendor_id));

drop policy if exists order_items_insert_buyer on public.order_items;
create policy order_items_insert_buyer on public.order_items
  for insert to public
  with check (public.buyer_owns_order(order_id));
