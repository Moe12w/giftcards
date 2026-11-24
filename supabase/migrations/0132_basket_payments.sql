-- 0132_basket_payments.sql
--
-- Basket contributions are now paid through MyFatoorah. Until this migration
-- the app inserted gift_basket_items directly, so a contribution appeared in
-- the shared box without any charge.
--
-- A contribution is an ordinary order (one order_item per card) marked with the
-- basket it belongs to. Once the payment is confirmed, the items are copied
-- into the basket exactly once. No voucher is issued to the payer: the box owns
-- the contribution, not the buyer's wallet.

alter table public.orders
  add column if not exists basket_id uuid references public.gift_baskets(id) on delete set null;

create index if not exists orders_basket_idx
  on public.orders (basket_id)
  where basket_id is not null;

-- One basket item per paid order line, so a replayed confirmation cannot add
-- the same contribution twice.
alter table public.gift_basket_items
  add column if not exists order_item_id uuid references public.order_items(id) on delete set null unique;

-- ---------------------------------------------------------------------------
-- Copy a paid contribution order into its basket. Idempotent.
-- Service role only: the confirmation route calls it after the provider has
-- been re-queried and the order is marked paid.
-- ---------------------------------------------------------------------------
create or replace function public.basket_fulfill_from_payment(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  v_item record;
  v_name text;
  v_added integer := 0;
  v_row uuid;
begin
  perform set_config('mf.internal', '1', true);

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if o.basket_id is null then
    return jsonb_build_object('is_basket', false, 'added', 0);
  end if;
  if o.payment_status <> 'paid' then
    raise exception 'payment_not_confirmed';
  end if;

  -- The payer must belong to the basket they are adding to.
  if not exists (
    select 1 from public.gift_basket_participants p
    where p.basket_id = o.basket_id and p.user_id = o.buyer_id
  ) then
    raise exception 'not_a_participant';
  end if;

  select coalesce(nullif(full_name, ''), 'Tazilla customer')
    into v_name
  from public.profiles
  where id = o.buyer_id;
  v_name := coalesce(v_name, 'Tazilla customer');

  for v_item in
    select
      oi.id,
      oi.product_id,
      oi.vendor_id,
      oi.total_minor,
      pr.title,
      pr.icon,
      pr.tone,
      pr.image_url,
      coalesce(v.name, ep.name) as business_name,
      coalesce(v.logo_url, ep.logo_url) as logo_url,
      coalesce(v.banner_url, ep.banner_url) as banner_url
    from public.order_items oi
    left join public.products pr on pr.id = oi.product_id
    left join public.vendors v on v.id = oi.vendor_id
    left join public.enterprise_partners ep on ep.id = pr.partner_id
    where oi.order_id = o.id
    order by oi.created_at, oi.id
  loop
    v_row := null;

    insert into public.gift_basket_items (
      basket_id, offer_id, vendor_id, vendor_name, title, amount_minor,
      emoji, tone, logo_url, banner_url, added_by, added_by_name, order_item_id
    )
    values (
      o.basket_id, v_item.product_id, v_item.vendor_id,
      coalesce(v_item.business_name, 'Tazilla'),
      coalesce(v_item.title, 'Gift card'),
      v_item.total_minor,
      v_item.icon, v_item.tone, v_item.logo_url, v_item.banner_url,
      o.buyer_id, v_name, v_item.id
    )
    on conflict (order_item_id) do nothing
    returning id into v_row;

    if v_row is not null then
      v_added := v_added + 1;

      insert into public.gift_basket_activity (
        basket_id, kind, actor_id, actor_name, item_title, amount_minor
      )
      values (
        o.basket_id, 'item_added', o.buyer_id, v_name,
        coalesce(v_item.title, 'Gift card'), v_item.total_minor
      );
    end if;
  end loop;

  return jsonb_build_object('is_basket', true, 'added', v_added);
end;
$$;

revoke all on function public.basket_fulfill_from_payment(uuid) from public, anon, authenticated;
grant execute on function public.basket_fulfill_from_payment(uuid) to service_role;
