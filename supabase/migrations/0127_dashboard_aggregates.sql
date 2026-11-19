-- 0127_dashboard_aggregates.sql
--
-- KPI totals for the vendor and admin dashboards, aggregated in SQL.
--
-- The dashboards used to derive their KPI cards from a capped row fetch
-- (orders up to 400/1000 rows, vouchers up to 600/2000, order_items up to 300
-- per vendor), so every card silently stopped growing once a table passed the
-- cap. These functions return the real totals for the rows the caller may see,
-- which lets the cards stay correct independently of how many rows a page
-- loads for its tables.
--
-- All functions are SECURITY INVOKER: the existing row level security policies
-- decide which rows are counted, exactly as they do for the page queries.

-- ---------------------------------------------------------------------------
-- Vendor
-- ---------------------------------------------------------------------------

-- Paid sales for one vendor. `paid_orders` counts distinct orders because one
-- order can contain several of the vendor's items.
create or replace function public.vendor_sales_totals(
  p_vendor_id uuid,
  p_since timestamptz default null
)
returns table (
  paid_items bigint,
  paid_orders bigint,
  gross_minor bigint,
  commission_minor bigint,
  share_minor bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::bigint,
    count(distinct o.id)::bigint,
    coalesce(sum(oi.total_minor), 0)::bigint,
    coalesce(sum(oi.commission_minor), 0)::bigint,
    coalesce(sum(oi.vendor_share_minor), 0)::bigint
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.vendor_id = p_vendor_id
    and o.status = 'paid'
    and (p_since is null or oi.created_at >= p_since);
$$;

-- Best-selling gifts for one vendor, by gross value.
create or replace function public.vendor_top_products(
  p_vendor_id uuid,
  p_since timestamptz default null,
  p_limit integer default 5
)
returns table (
  product_title text,
  gross_minor bigint,
  units bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.title as product_title,
    coalesce(sum(oi.total_minor), 0)::bigint as gross_minor,
    count(*)::bigint as units
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  where oi.vendor_id = p_vendor_id
    and o.status = 'paid'
    and (p_since is null or oi.created_at >= p_since)
  group by p.title
  order by 2 desc, 1 nulls last
  limit greatest(1, least(coalesce(p_limit, 5), 50));
$$;

-- Voucher counts and the remaining monetary liability for one vendor.
create or replace function public.vendor_voucher_totals(
  p_vendor_id uuid,
  p_since timestamptz default null
)
returns table (
  total bigint,
  active bigint,
  redeemed bigint,
  expired bigint,
  outstanding_minor bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (
      where v.status in ('issued', 'claimed', 'active', 'partially_redeemed')
    )::bigint,
    count(*) filter (where v.status = 'redeemed')::bigint,
    count(*) filter (where v.status = 'expired')::bigint,
    coalesce(
      sum(
        case
          when v.fulfilment_type = 'monetary'
            and v.status in ('issued', 'claimed', 'active', 'partially_redeemed')
          then v.remaining_value_minor
          else 0
        end
      ),
      0
    )::bigint
  from public.vouchers v
  where v.vendor_id = p_vendor_id
    and (p_since is null or v.created_at >= p_since);
$$;

-- Redemption history for one vendor.
create or replace function public.vendor_redemption_totals(
  p_vendor_id uuid,
  p_since timestamptz default null
)
returns table (
  redemptions bigint,
  amount_minor bigint,
  sessions bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::bigint,
    coalesce(sum(r.amount_minor), 0)::bigint,
    coalesce(sum(r.sessions), 0)::bigint
  from public.redemptions r
  where r.vendor_id = p_vendor_id
    and (p_since is null or r.occurred_at >= p_since);
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

create or replace function public.admin_order_totals(
  p_since timestamptz default null
)
returns table (
  total bigint,
  paid bigint,
  pending bigint,
  refunded bigint,
  paid_value_minor bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where o.status = 'paid')::bigint,
    count(*) filter (where o.status = 'pending')::bigint,
    count(*) filter (where o.status = 'refunded')::bigint,
    coalesce(
      sum(case when o.status = 'paid' then o.total_minor else 0 end),
      0
    )::bigint
  from public.orders o
  where (p_since is null or o.created_at >= p_since);
$$;

create or replace function public.admin_voucher_totals(
  p_since timestamptz default null
)
returns table (
  total bigint,
  active bigint,
  redeemed bigint,
  expired bigint,
  outstanding_minor bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (
      where v.status in ('issued', 'claimed', 'active', 'partially_redeemed')
    )::bigint,
    count(*) filter (where v.status = 'redeemed')::bigint,
    count(*) filter (where v.status = 'expired')::bigint,
    coalesce(
      sum(
        case
          when v.fulfilment_type = 'monetary'
            and v.status in ('issued', 'claimed', 'active', 'partially_redeemed')
          then v.remaining_value_minor
          else 0
        end
      ),
      0
    )::bigint
  from public.vouchers v
  where (p_since is null or v.created_at >= p_since);
$$;

create or replace function public.admin_product_totals()
returns table (
  total bigint,
  published bigint,
  experience bigint,
  enterprise_code bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where p.status = 'published')::bigint,
    count(*) filter (where p.fulfilment_type = 'experience')::bigint,
    count(*) filter (where p.fulfilment_type = 'enterprise_code')::bigint
  from public.products p;
$$;

create or replace function public.admin_customer_totals()
returns table (
  accounts bigint,
  suspended bigint,
  with_orders bigint,
  paid_orders bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.profiles)::bigint,
    (
      select count(*) from public.profiles p
      where p.status::text = 'suspended'
    )::bigint,
    (
      select count(distinct o.buyer_id) from public.orders o
      where o.buyer_id is not null
    )::bigint,
    (
      select count(*) from public.orders o
      where o.status = 'paid'
    )::bigint;
$$;

create or replace function public.admin_support_open_count()
returns table (open_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.support_requests s
  where s.status = 'open';
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

revoke all on function public.vendor_sales_totals(uuid, timestamptz) from public;
grant execute on function public.vendor_sales_totals(uuid, timestamptz)
  to authenticated, service_role;

revoke all on function public.vendor_top_products(uuid, timestamptz, integer) from public;
grant execute on function public.vendor_top_products(uuid, timestamptz, integer)
  to authenticated, service_role;

revoke all on function public.vendor_voucher_totals(uuid, timestamptz) from public;
grant execute on function public.vendor_voucher_totals(uuid, timestamptz)
  to authenticated, service_role;

revoke all on function public.vendor_redemption_totals(uuid, timestamptz) from public;
grant execute on function public.vendor_redemption_totals(uuid, timestamptz)
  to authenticated, service_role;

revoke all on function public.admin_order_totals(timestamptz) from public;
grant execute on function public.admin_order_totals(timestamptz)
  to authenticated, service_role;

revoke all on function public.admin_voucher_totals(timestamptz) from public;
grant execute on function public.admin_voucher_totals(timestamptz)
  to authenticated, service_role;

revoke all on function public.admin_product_totals() from public;
grant execute on function public.admin_product_totals()
  to authenticated, service_role;

revoke all on function public.admin_customer_totals() from public;
grant execute on function public.admin_customer_totals()
  to authenticated, service_role;

revoke all on function public.admin_support_open_count() from public;
grant execute on function public.admin_support_open_count()
  to authenticated, service_role;
