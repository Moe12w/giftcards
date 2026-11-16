-- 0109_account_deletion.sql
-- Real account deletion for customers (App Store requirement).
--
-- Deleting the auth user removes the profile and every personal row that hangs
-- off it (addresses, preferences, recipients, saved payment references,
-- favourites, push tokens, notifications, business account, baskets they alone
-- created). Financial records are kept: orders and vouchers stay for the vendor
-- and for the recipient, with the buyer link cleared.
--
-- Accounts that carry business responsibilities (admin, vendor, enterprise,
-- approved business buyer, or a basket other people contributed to) cannot be
-- deleted from the app; they get a clear error and must contact support.

-- ---------------------------------------------------------------------------
-- 1. Orders survive the customer
-- ---------------------------------------------------------------------------

alter table public.orders
  alter column buyer_id drop not null;

-- Drop whatever foreign key currently guards orders.buyer_id, then replace it
-- with one that clears the link instead of blocking the delete.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any (con.conkey)
    where con.conrelid = 'public.orders'::regclass
      and con.contype = 'f'
      and att.attname = 'buyer_id'
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.orders
  add constraint orders_buyer_id_fkey
  foreign key (buyer_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Basket item attribution survives; the display name is kept
-- ---------------------------------------------------------------------------

alter table public.gift_basket_items
  alter column added_by drop not null;

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any (con.conkey)
    where con.conrelid = 'public.gift_basket_items'::regclass
      and con.contype = 'f'
      and att.attname = 'added_by'
  loop
    execute format('alter table public.gift_basket_items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.gift_basket_items
  add constraint gift_basket_items_added_by_fkey
  foreign key (added_by) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Deletion entry point
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Staff and partner accounts are removed by the business that owns them.
  if coalesce(public.is_admin(), false) then
    raise exception 'admin_account';
  end if;

  if exists (select 1 from public.vendors where owner_id = v_uid)
     or exists (
       select 1 from public.vendor_members
       where user_id = v_uid and active
     ) then
    raise exception 'vendor_account';
  end if;

  if exists (
    select 1 from public.enterprise_members
    where user_id = v_uid and active
  ) then
    raise exception 'enterprise_account';
  end if;

  if exists (
       select 1 from public.business_accounts
       where user_id = v_uid and status = 'approved'
     )
     or exists (select 1 from public.bulk_orders where buyer_user_id = v_uid) then
    raise exception 'business_account';
  end if;

  -- A shared basket holds other people's contributions; deleting the creator
  -- would delete their gifts too.
  if exists (
    select 1
    from public.gift_baskets b
    where b.creator_id = v_uid
      and exists (
        select 1
        from public.gift_basket_participants p
        where p.basket_id = b.id
          and p.user_id <> v_uid
      )
  ) then
    raise exception 'shared_basket';
  end if;

  -- Cascades to profiles, memberships, tokens, addresses, recipients,
  -- favourites, notifications and the customer's own baskets.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
