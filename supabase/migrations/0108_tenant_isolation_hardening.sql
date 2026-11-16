-- 0108_tenant_isolation_hardening.sql
-- Closes the cross-tenant holes found in the tenant-isolation audit.
--
--   1. Advertising partner-vendor RPCs no longer act on arbitrary partners.
--   2. verify_voucher_balances() is scoped to the caller's vendors.
--   3. voucher_for_redemption() requires redemption rights for the voucher.
--   4. Business accounts can no longer self-approve outside the platform
--      setting that disables bulk registration review.
--   5. Buyers can no longer rewrite financial/fulfilment columns of their own
--      bulk orders or attach vouchers/tokens to their allocations.
--   6. statements uses the vendor-membership model instead of comparing
--      auth.uid() to a vendor id.
--   7. Basket invite lookups are rate limited, since the invite code is a
--      bearer secret.

-- ---------------------------------------------------------------------------
-- 1. Advertising: partner -> vendor RPCs
--
-- These were security definer and callable by any authenticated user with any
-- partner id, disclosing another partner's advertising vendor and creating its
-- shell vendor row. They now require admin, service role, or an active
-- owner/manager membership of that partner (reads also allow any active
-- member of the partner).
-- ---------------------------------------------------------------------------

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
  -- auth.uid() is null for service_role / migrations, which legitimately create
  -- the shell vendor for a partner (e.g. the backfill and the admin client).
  if auth.uid() is not null
     and not coalesce(public.can_manage_partner(p_partner_id), false) then
    raise exception 'not allowed';
  end if;

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

create or replace function public.advertising_get_partner_vendor(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vendors%rowtype;
  v_can_manage boolean;
begin
  v_can_manage := coalesce(public.can_manage_partner(p_partner_id), false);

  if auth.uid() is not null then
    if not (
      v_can_manage
      or exists (
        select 1
        from public.enterprise_members em
        where em.partner_id = p_partner_id
          and em.user_id = auth.uid()
          and em.active
      )
    ) then
      raise exception 'not allowed';
    end if;
  end if;

  if not exists (select 1 from public.enterprise_partners ep where ep.id = p_partner_id) then
    raise exception 'partner_not_found';
  end if;

  select * into v
  from public.vendors
  where enterprise_partner_id = p_partner_id
  order by created_at asc
  limit 1;

  if not found then
    -- Only partner owners/managers (or the service role) may provision the
    -- shell vendor; an analyst can read it once it exists but not create it.
    if auth.uid() is not null and not v_can_manage then
      raise exception 'vendor_not_found';
    end if;

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

-- Functions are executable by PUBLIC by default, so the earlier grants did not
-- actually keep anonymous callers out.
revoke all on function public.advertising_ensure_partner_vendor(uuid) from public;
revoke all on function public.advertising_ensure_partner_vendor(uuid) from anon;
revoke all on function public.advertising_get_partner_vendor(uuid) from public;
revoke all on function public.advertising_get_partner_vendor(uuid) from anon;
grant execute on function public.advertising_ensure_partner_vendor(uuid) to authenticated, service_role;
grant execute on function public.advertising_get_partner_vendor(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. verify_voucher_balances(): no longer enumerates every tenant's vouchers
-- ---------------------------------------------------------------------------

create or replace function public.verify_voucher_balances()
returns table (
  voucher_id uuid,
  voucher_code text,
  fulfilment_type public.fulfilment_type,
  cached_value bigint,
  ledger_value bigint,
  cached_sessions integer,
  ledger_sessions integer,
  is_consistent boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.voucher_code,
    v.fulfilment_type,
    coalesce(v.remaining_value_minor, 0),
    case when v.fulfilment_type = 'monetary'
      then coalesce((select sum(amount_minor) from public.ledger_entries le where le.voucher_id = v.id), 0)
      else 0 end,
    coalesce(v.remaining_sessions, 0),
    case when v.fulfilment_type = 'experience'
      then coalesce((select sum(sessions) from public.ledger_entries le where le.voucher_id = v.id), 0)
      else 0 end,
    (
      case when v.fulfilment_type = 'monetary'
        then coalesce(v.remaining_value_minor, 0)
          = coalesce((select sum(amount_minor) from public.ledger_entries le where le.voucher_id = v.id), 0)
        else true
      end
      and
      case when v.fulfilment_type = 'experience'
        then coalesce(v.remaining_sessions, 0)
          = coalesce((select sum(sessions) from public.ledger_entries le where le.voucher_id = v.id), 0)
        else true
      end
    )
  from public.vouchers v
  where auth.uid() is null
     or coalesce(public.is_admin(), false)
     or coalesce(public.can_redeem_for(v.vendor_id), false);
$$;

revoke all on function public.verify_voucher_balances() from public;
revoke all on function public.verify_voucher_balances() from anon;
grant execute on function public.verify_voucher_balances() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. voucher_for_redemption(): require redemption rights for the vendor
--
-- Any authenticated user could previously probe voucher codes and read the
-- product, vendor, balance/session and redemption state of another tenant.
-- ---------------------------------------------------------------------------

create or replace function public.voucher_for_redemption(p_code text)
returns table (
  voucher_id uuid,
  voucher_code text,
  product_name text,
  vendor_id uuid,
  vendor_name text,
  fulfilment_type public.fulfilment_type,
  status public.voucher_status,
  balance_minor bigint,
  total_sessions integer,
  remaining_sessions integer,
  expires_at timestamptz,
  multi_session_per_visit boolean,
  split_session_allowed boolean,
  booking_required boolean,
  can_redeem boolean,
  blocked_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_product public.products%rowtype;
  v_balance bigint;
  v_sessions integer;
begin
  select * into v_voucher
  from public.vouchers
  where voucher_code = upper(trim(p_code))
     or card_code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  limit 1;

  if v_voucher.id is null then
    raise exception 'voucher not found';
  end if;

  -- Staff (or admins / the service role) only: the redemption screen looks up
  -- codes for the vendor currently signed in.
  if auth.uid() is not null
     and not coalesce(public.can_redeem_for(v_voucher.vendor_id), false) then
    raise exception 'not allowed';
  end if;

  select * into v_product from public.products where id = v_voucher.product_id;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries where voucher_id = v_voucher.id;

  select coalesce(sum(sessions), 0) into v_sessions
  from public.ledger_entries where voucher_id = v_voucher.id;

  return query
  select
    v_voucher.id,
    v_voucher.voucher_code,
    v_product.title,
    v_voucher.vendor_id,
    (select name from public.vendors where id = v_voucher.vendor_id),
    v_voucher.fulfilment_type,
    v_voucher.status,
    case when v_voucher.fulfilment_type = 'monetary' then v_balance else null end,
    v_voucher.total_sessions,
    case when v_voucher.fulfilment_type = 'experience' then v_sessions else null end,
    v_voucher.expires_at,
    coalesce(v_product.multi_session_per_visit, true),
    coalesce(v_product.split_session_allowed, true),
    coalesce(v_product.booking_required, false),
    (
      v_voucher.status in ('claimed', 'issued', 'active', 'partially_redeemed')
      and (v_voucher.expires_at is null or v_voucher.expires_at > now())
      and (
        (v_voucher.fulfilment_type = 'monetary' and v_balance > 0)
        or (v_voucher.fulfilment_type = 'experience' and v_sessions > 0)
      )
    ),
    (
      case
        when v_voucher.status not in ('claimed', 'issued', 'active', 'partially_redeemed')
          then 'voucher not redeemable'
        when v_voucher.expires_at is not null and v_voucher.expires_at <= now()
          then 'voucher expired'
        when v_voucher.fulfilment_type = 'monetary' and v_balance <= 0
          then 'no balance left'
        when v_voucher.fulfilment_type = 'experience' and v_sessions <= 0
          then 'no sessions left'
        else null
      end
    );
end;
$$;

revoke all on function public.voucher_for_redemption(text) from public;
revoke all on function public.voucher_for_redemption(text) from anon;
grant execute on function public.voucher_for_redemption(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Business accounts: no self-approval through the table API
-- ---------------------------------------------------------------------------

drop policy if exists business_accounts_insert on public.business_accounts;
create policy business_accounts_insert on public.business_accounts
  for insert with check (
    user_id = auth.uid()
    and status = 'pending_approval'
    and decided_at is null
    and decided_by is null
    and decision_note is null
  );

create or replace function public.business_accounts_guard_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role and migrations (no JWT) and admins keep full control.
  if auth.uid() is null or coalesce(public.is_admin(), false) then
    return new;
  end if;

  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.user_id <> auth.uid() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at
     or new.decided_by is distinct from old.decided_by
     or new.decision_note is distinct from old.decision_note then
    raise exception 'not allowed';
  end if;

  if new.status is distinct from old.status then
    -- The only owner-driven transition is the automatic approval used when the
    -- platform turns registration review off. Everything else is admin-only.
    if old.status <> 'pending_approval'
       or new.status <> 'approved'
       or coalesce(public.bulk_registration_requires_approval(), true) then
      raise exception 'not allowed';
    end if;
  elsif new.decided_at is distinct from old.decided_at then
    raise exception 'not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_business_accounts_guard_write on public.business_accounts;
create trigger trg_business_accounts_guard_write
  before insert or update on public.business_accounts
  for each row execute function public.business_accounts_guard_write();

-- ---------------------------------------------------------------------------
-- 5. Bulk orders: buyers may not rewrite money/fulfilment state
--
-- Buyers still create their own pending order, name recipients, send links and
-- cancel an unpaid order. Financial, payment, fulfilment and identity columns
-- are owned by the vendor/partner/admin side and the service role.
-- ---------------------------------------------------------------------------

create or replace function public.bulk_orders_guard_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if auth.uid() is null or coalesce(public.is_admin(), false) then
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.buyer_user_id = auth.uid() then
      raise exception 'not allowed';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.buyer_user_id <> auth.uid() then
      raise exception 'not allowed';
    end if;

    -- The order must belong to the buyer's own business account and to the
    -- tenant that actually owns the offer.
    if not exists (
      select 1 from public.business_accounts b
      where b.id = new.business_account_id
        and b.user_id = auth.uid()
    ) then
      raise exception 'not allowed';
    end if;

    if not exists (
      select 1 from public.bulk_offers o
      where o.id = new.offer_id
        and o.product_id is not distinct from new.product_id
        and o.vendor_id is not distinct from new.vendor_id
        and o.partner_id is not distinct from new.partner_id
    ) then
      raise exception 'offer mismatch';
    end if;

    if new.status <> 'pending'
       or new.payment_status <> 'unpaid'
       or new.paid_at is not null
       or new.fulfilled_at is not null
       or new.cancelled_at is not null
       or new.provider_invoice_id is not null
       or new.payment_reference is not null then
      raise exception 'not allowed';
    end if;
    return new;
  end if;

  -- Only the buyer's own rows are restricted here; vendor/partner managers and
  -- admins are governed by the RLS policies (and the early return above).
  if new.buyer_user_id <> auth.uid() then
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status <> 'cancelled'
       or old.payment_status = 'paid'
       or old.status in ('fulfilled', 'partially_fulfilled', 'refunded', 'cancelled') then
      raise exception 'not allowed';
    end if;
  end if;

  v_old := to_jsonb(old) - 'status' - 'cancelled_at' - 'sent_at' - 'notes' - 'gift_message' - 'updated_at';
  v_new := to_jsonb(new) - 'status' - 'cancelled_at' - 'sent_at' - 'notes' - 'gift_message' - 'updated_at';

  if v_old is distinct from v_new then
    raise exception 'not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bulk_orders_guard_write on public.bulk_orders;
create trigger trg_bulk_orders_guard_write
  before insert or update or delete on public.bulk_orders
  for each row execute function public.bulk_orders_guard_write();

create or replace function public.bulk_order_vouchers_guard_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.bulk_orders%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  if auth.uid() is null or coalesce(public.is_admin(), false) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select * into v_order
  from public.bulk_orders
  where id = case when tg_op = 'DELETE' then old.bulk_order_id else new.bulk_order_id end;

  if not found then
    -- A cascading delete of allocations after the parent row is gone.
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'bulk order not found';
  end if;

  if v_order.buyer_user_id <> auth.uid() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- A buyer who also manages the selling vendor/partner keeps partner rights.
  if v_order.vendor_id is not null and coalesce(public.can_manage_vendor(v_order.vendor_id), false) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if v_order.partner_id is not null and coalesce(public.can_manage_partner(v_order.partner_id), false) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'not allowed';
  end if;

  if tg_op = 'INSERT' then
    -- Buyers create empty allocation slots; issued vouchers and claim tokens
    -- are written by the fulfilment RPC (service role) only.
    if new.voucher_id is not null
       or new.claim_token is not null
       or new.claim_token_hash is not null
       or new.delivered_code is not null then
      raise exception 'not allowed';
    end if;
    return new;
  end if;

  v_old := to_jsonb(old) - 'recipient_name' - 'recipient_email' - 'gift_message'
    - 'assignment_index' - 'delivery_status' - 'sent_at' - 'send_error';
  v_new := to_jsonb(new) - 'recipient_name' - 'recipient_email' - 'gift_message'
    - 'assignment_index' - 'delivery_status' - 'sent_at' - 'send_error';

  if v_old is distinct from v_new then
    raise exception 'not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bulk_order_vouchers_guard_write on public.bulk_order_vouchers;
create trigger trg_bulk_order_vouchers_guard_write
  before insert or update or delete on public.bulk_order_vouchers
  for each row execute function public.bulk_order_vouchers_guard_write();

-- ---------------------------------------------------------------------------
-- 6. statements: vendor access follows vendor membership, not auth.uid()
--
-- vendor_id references public.vendors(id), so the old policy could never match
-- a signed-in user. Statements are financial, so owner/manager membership is
-- required (redemption staff are not granted access).
-- ---------------------------------------------------------------------------

drop policy if exists "Vendors can view own statements" on public.statements;
create policy "Vendors can view own statements" on public.statements
  for select using (coalesce(public.can_manage_vendor(vendor_id), false));

drop policy if exists "Admins can view all statements" on public.statements;
create policy "Admins can view all statements" on public.statements
  for select using (coalesce(public.is_admin(), false));

-- ---------------------------------------------------------------------------
-- 7. Basket invite lookups are rate limited
--
-- The invite code is a bearer secret, so lookups are capped per caller/IP to
-- slow down code enumeration. Only the security definer function touches the
-- attempt log.
-- ---------------------------------------------------------------------------

create table if not exists public.basket_lookup_attempts (
  id bigserial primary key,
  lookup_key text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists basket_lookup_attempts_key_idx
  on public.basket_lookup_attempts (lookup_key, attempted_at desc);

alter table public.basket_lookup_attempts enable row level security;
revoke all on public.basket_lookup_attempts from anon, authenticated;

create or replace function public.get_basket_by_code(p_code text)
returns table (
  id uuid,
  code text,
  name text,
  recipient_name text,
  occasion text,
  creator_id uuid,
  creator_name text,
  target_minor bigint,
  status public.basket_status,
  note text,
  created_at timestamptz,
  completed_at timestamptz,
  items jsonb,
  participants jsonb,
  activity jsonb
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_key text;
  v_recent integer;
begin
  v_key := coalesce(
    auth.uid()::text,
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
    'anonymous'
  );

  delete from public.basket_lookup_attempts where attempted_at < now() - interval '1 hour';

  select count(*) into v_recent
  from public.basket_lookup_attempts a
  where a.lookup_key = v_key
    and a.attempted_at > now() - interval '1 minute';

  if v_recent >= 30 then
    raise exception 'too many basket lookups, try again shortly';
  end if;

  insert into public.basket_lookup_attempts (lookup_key) values (v_key);

  return query
  select
    b.id,
    b.code,
    b.name,
    b.recipient_name,
    b.occasion,
    b.creator_id,
    b.creator_name,
    b.target_minor,
    b.status,
    b.note,
    b.created_at,
    b.completed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'offer_id', i.offer_id,
        'vendor_id', i.vendor_id,
        'vendor_name', i.vendor_name,
        'title', i.title,
        'amount_minor', i.amount_minor,
        'emoji', i.emoji,
        'tone', i.tone,
        'logo_url', i.logo_url,
        'banner_url', i.banner_url,
        'added_by_id', i.added_by,
        'added_by_name', i.added_by_name,
        'added_at', i.added_at
      ) order by i.added_at)
      from public.gift_basket_items i
      where i.basket_id = b.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.user_id,
        'name', p.name,
        'is_owner', p.is_owner,
        'joined_at', p.joined_at,
        'tone', p.tone
      ) order by p.joined_at)
      from public.gift_basket_participants p
      where p.basket_id = b.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'kind', a.kind,
        'actor_name', a.actor_name,
        'item_title', a.item_title,
        'amount_minor', a.amount_minor,
        'created_at', a.created_at
      ) order by a.created_at desc)
      from (
        select * from public.gift_basket_activity x
        where x.basket_id = b.id
        order by x.created_at desc
        limit 20
      ) a
    ), '[]'::jsonb)
  from public.gift_baskets b
  where upper(b.code) = upper(trim(p_code));
end;
$$;

revoke all on function public.get_basket_by_code(text) from public;
grant execute on function public.get_basket_by_code(text) to anon, authenticated;
