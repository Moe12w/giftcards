-- 0050_enterprise_advertising.sql
-- Enterprise partners can run advertising through a linked vendor account.
--
-- A partner (RetailPlus Rewards and future enterprise customers) is itself a
-- business, but the advertising engine speaks `vendor_id`. Instead of rewriting
-- the lifecycle, we add a stable link between an enterprise partner and the
-- vendor account that acts as its advertising advertiser. The vendor row is
-- created on demand and reused for every campaign, budget, charge, tracking
-- event and notification that already carries a vendor id.

-- ---------------------------------------------------------------------------
-- 1. Partner -> vendor link
-- ---------------------------------------------------------------------------

alter table public.vendors
  add column if not exists enterprise_partner_id uuid references public.enterprise_partners (id) on delete set null;

create index if not exists vendors_enterprise_partner_idx on public.vendors (enterprise_partner_id);

-- Returns the advertising vendor for a partner, creating it on first use.
create or replace function public.advertising_ensure_partner_vendor(p_partner_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner record;
  v_owner uuid;
  v_vendor_id uuid;
  v_slug text;
begin
  select * into v_partner from public.enterprise_partners where id = p_partner_id;
  if not found then
    raise exception 'partner_not_found';
  end if;

  select id into v_vendor_id
  from public.vendors
  where enterprise_partner_id = p_partner_id
  limit 1;

  if found then
    return v_vendor_id;
  end if;

  v_owner := v_partner.owner_id;
  if v_owner is null then
    select em.user_id into v_owner
    from public.enterprise_members em
    where em.partner_id = p_partner_id
      and em.active
      and em.role in ('owner', 'manager')
    order by em.created_at asc
    limit 1;
  end if;
  if v_owner is null then
    raise exception 'partner_owner_missing';
  end if;

  v_slug := 'adv_' || substr(replace(v_partner.slug, '-', ''), 1, 24);
  loop
    select id into v_vendor_id from public.vendors where slug = v_slug;
    exit when not found;
    v_slug := v_slug || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end loop;

  insert into public.vendors (owner_id, name, slug, logo_url, banner_url, status, enterprise_partner_id)
  values (v_owner, v_partner.name, v_slug, v_partner.logo_url, v_partner.banner_url, 'approved', p_partner_id)
  returning id into v_vendor_id;

  return v_vendor_id;
end;
$$;

grant execute on function public.advertising_ensure_partner_vendor(uuid) to authenticated;
grant execute on function public.advertising_ensure_partner_vendor(uuid) to service_role;

-- Returns the advertising vendor row for a partner as jsonb. Security definer
-- so the owner/manager of a partner can read the shell vendor row they act as,
-- without the public vendors RLS policy (which only understands vendor_members).
create or replace function public.advertising_get_partner_vendor(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vendors%rowtype;
begin
  if not exists (select 1 from public.enterprise_partners ep where ep.id = p_partner_id) then
    raise exception 'partner_not_found';
  end if;

  select * into v
  from public.vendors
  where enterprise_partner_id = p_partner_id
  order by created_at asc
  limit 1;

  if not found then
    perform public.advertising_ensure_partner_vendor(p_partner_id);
    select * into v
    from public.vendors
    where enterprise_partner_id = p_partner_id
    order by created_at asc
    limit 1;
  end if;

  if not found then
    raise exception 'vendor_not_found';
  end if;

  return jsonb_build_object(
    'id', v.id::text,
    'owner_id', v.owner_id::text,
    'name', v.name,
    'slug', v.slug,
    'description', v.description,
    'logo_url', v.logo_url,
    'banner_url', v.banner_url,
    'status', v.status::text,
    'commission_bps', v.commission_bps,
    'max_unredeemed_minor', v.max_unredeemed_minor,
    'advertising_enabled', v.advertising_enabled,
    'advertising_verified', v.advertising_verified,
    'advertising_suspended_at', v.advertising_suspended_at,
    'advertising_suspended_reason', v.advertising_suspended_reason,
    'city', v.city,
    'area', v.area,
    'category_id', v.category_id,
    'created_at', v.created_at::text,
    'updated_at', v.updated_at::text
  );
end;
$$;

grant execute on function public.advertising_get_partner_vendor(uuid) to authenticated;
grant execute on function public.advertising_get_partner_vendor(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Advertising permission helpers
-- ---------------------------------------------------------------------------

create or replace function public.advertising_can_manage_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.vendor_member_role(p_vendor_id) in ('owner', 'manager')
    or exists (
      select 1
      from public.vendors v
      join public.enterprise_members em
        on em.partner_id = v.enterprise_partner_id
       and em.user_id = auth.uid()
       and em.active
       and em.role in ('owner', 'manager')
      where v.id = p_vendor_id
    );
$$;

grant execute on function public.advertising_can_manage_vendor(uuid) to authenticated;
grant execute on function public.advertising_can_manage_vendor(uuid) to service_role;

create or replace function public.advertising_can_view_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.vendor_member_role(p_vendor_id) in ('owner', 'manager')
    or exists (
      select 1
      from public.vendors v
      join public.enterprise_members em
        on em.partner_id = v.enterprise_partner_id
       and em.user_id = auth.uid()
       and em.active
       and em.role in ('owner', 'manager')
      where v.id = p_vendor_id
    );
$$;

grant execute on function public.advertising_can_view_vendor(uuid) to authenticated;
grant execute on function public.advertising_can_view_vendor(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Do not double-list shell vendors in the public marketplace
-- ---------------------------------------------------------------------------

drop view if exists public.marketplace_businesses;
create view public.marketplace_businesses with (security_invoker = true) as
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
    and v.enterprise_partner_id is null
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
    0::numeric,
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
-- 4. Backfill linked advertising vendors for existing active partners
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_id uuid;
begin
  for r in
    select id from public.enterprise_partners where status = 'active'
  loop
    select public.advertising_ensure_partner_vendor(r.id) into v_id;
  end loop;
end;
$$;
