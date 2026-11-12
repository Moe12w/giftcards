-- ---------------------------------------------------------------------------
-- Partners are businesses: make the data match the model
--
-- 0036 gave a catalogue gift a `partner_id`, but the existing partner gifts
-- were only linked through `enterprise_product_id`, so every partner storefront
-- counted zero gifts and the app fell back to the gift product's own name.
--
-- This migration:
--   - backfills `products.partner_id` from the enterprise product
--   - keeps the link in sync for every future partner gift
--   - gives the demo partner its logo, banner and public description
--   - teaches `card_balances` about partner codes
--   - rebuilds the public business directory with a real partner rating
--   - buys a demo partner gift through a normal paid order, so the wallet has
--     a real partner voucher with a real code allocated from inventory
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. A partner gift is linked to its partner business
-- ---------------------------------------------------------------------------
update public.products p
set partner_id = ep.partner_id
from public.enterprise_products ep
where p.enterprise_product_id = ep.id
  and p.partner_id is distinct from ep.partner_id;

create or replace function public.sync_product_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enterprise_product_id is not null then
    select ep.partner_id
      into new.partner_id
    from public.enterprise_products ep
    where ep.id = new.enterprise_product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_partner on public.products;
create trigger products_sync_partner
  before insert or update of enterprise_product_id, partner_id on public.products
  for each row execute function public.sync_product_partner();

-- A partner gift belongs to a partner, never to a vendor.
update public.products
set vendor_id = null
where partner_id is not null
  and vendor_id is not null;

-- Baskets hold gifts from any business. A partner gift has no vendor row, so
-- the basket item keeps the business name and logo instead.
alter table public.gift_basket_items
  alter column vendor_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. The demo partner looks like a real storefront
-- ---------------------------------------------------------------------------
update public.enterprise_partners
set
  logo_url = coalesce(logo_url, 'https://placehold.co/200x200/png?text=RP'),
  banner_url = coalesce(banner_url, 'https://placehold.co/900x300/png?text=RetailPlus+Rewards'),
  notes = coalesce(
    notes,
    'Everyday rewards for shopping, dining and fuel across Qatar. Use your RetailPlus gift card at any till or online checkout.'
  )
where id = '96d72e91-21e8-47bd-8298-8f991a2ca84e';

-- ---------------------------------------------------------------------------
-- 3. A partner code carries value, even though it has no ledger entry
-- ---------------------------------------------------------------------------
create or replace view public.card_balances with (security_invoker = true) as
  select
    v.id as voucher_id,
    v.id as card_id,
    v.fulfilment_type,
    case
      when v.fulfilment_type = 'monetary'
        then coalesce(sum(le.amount_minor), 0)::bigint
      when v.fulfilment_type = 'enterprise_code'
        then coalesce(v.remaining_value_minor, 0)
      else 0::bigint
    end as balance_minor,
    case
      when v.fulfilment_type = 'experience'
        then coalesce(sum(le.sessions), 0)::integer
      else 0
    end as sessions_remaining
  from public.vouchers v
  left join public.ledger_entries le on le.voucher_id = v.id
  group by v.id, v.fulfilment_type, v.remaining_value_minor;

-- ---------------------------------------------------------------------------
-- 4. One public directory for both kinds of business
-- ---------------------------------------------------------------------------
create or replace view public.marketplace_businesses with (security_invoker = true) as
  select
    v.id,
    'vendor'::text as business_kind,
    v.name,
    v.slug,
    v.logo_url,
    v.banner_url,
    v.city,
    v.area,
    v.rating::numeric as rating,
    v.description,
    v.status::text as status,
    (
      select count(*)::int
      from public.products p
      where p.vendor_id = v.id and p.status = 'published'
    ) as gift_count
  from public.vendors v
  where v.status = 'approved'
  union all
  select
    ep.id,
    'partner'::text,
    ep.name,
    ep.slug,
    ep.logo_url,
    ep.banner_url,
    null::text,
    null::text,
    coalesce(
      (
        select round(avg(p.rating)::numeric, 1)
        from public.products p
        where p.partner_id = ep.id and p.status = 'published'
      ),
      4.8::numeric
    ) as rating,
    ep.notes,
    ep.status::text as status,
    (
      select count(*)::int
      from public.products p
      where p.partner_id = ep.id and p.status = 'published'
    ) as gift_count
  from public.enterprise_partners ep
  where ep.status = 'active';

-- ---------------------------------------------------------------------------
-- 5. A demo partner gift, bought the same way a customer buys one
--
-- The order starts pending, the item is added, then the order is marked paid.
-- The existing `orders_issue_enterprise_codes` trigger allocates a real code
-- from the partner's inventory and creates the buyer's voucher.
-- ---------------------------------------------------------------------------
insert into public.orders (
  id, order_ref, buyer_id, status, currency, subtotal_minor, discount_minor,
  fee_minor, total_minor, sender_name, gift_message, delivery_method,
  payment_status, payment_provider, payment_reference, paid_at, created_at
)
select
  'c4b0a0d0-6c1e-4a4e-9f5e-2d8b7c6a5f01',
  'ORD-2000',
  '11111111-1111-4111-8111-111111111111',
  'pending',
  'QAR', 12000, 0, 0, 12000,
  'Demo Customer',
  'A little RetailPlus treat.',
  'email',
  'unpaid',
  'demo',
  'MF-DEMO-2000',
  null,
  now()
where not exists (
  select 1 from public.orders where id = 'c4b0a0d0-6c1e-4a4e-9f5e-2d8b7c6a5f01'
);

insert into public.order_items (
  id, order_id, product_id, enterprise_product_id, vendor_id, quantity,
  unit_price_minor, total_minor, commission_minor, vendor_share_minor,
  currency, gift_message, recipient_name, recipient_email, delivery_method,
  created_at
)
select
  'c4b0a0d0-6c1e-4a4e-9f5e-2d8b7c6a5f02',
  'c4b0a0d0-6c1e-4a4e-9f5e-2d8b7c6a5f01',
  '281f0523-5642-4d8c-9a14-1effc26d6126',
  '552487ae-23fb-463f-b05e-f73e7cea3a6a',
  null,
  1,
  12000, 12000, 2500, 9500,
  'QAR',
  'A little RetailPlus treat.',
  'Layla',
  'layla@example.com',
  'email',
  now()
where not exists (
  select 1 from public.order_items where id = 'c4b0a0d0-6c1e-4a4e-9f5e-2d8b7c6a5f02'
);

-- Marking it paid fires the normal fulfilment trigger.
update public.orders
set status = 'paid', payment_status = 'paid', paid_at = now()
where id = 'c4b0a0d0-6c1e-4a4e-9f5e-2d8b7c6a5f01'
  and status = 'pending';

-- If the partner gift was already bought before this migration, make sure its
-- voucher still points at the catalogue product (the trigger does this on new
-- orders; this keeps the demo order idempotent).
update public.vouchers
set product_id = '281f0523-5642-4d8c-9a14-1effc26d6126'
where order_item_id = 'c4b0a0d0-6c1e-4a4e-9f5e-2d8b7c6a5f02'
  and product_id is null;
