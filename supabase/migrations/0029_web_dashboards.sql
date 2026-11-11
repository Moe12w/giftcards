-- 0029_web_dashboards.sql
-- Everything the web dashboards need that the customer app never did:
-- vendor self-registration, staff invites, teammate visibility and the few
-- admin write paths that were still missing.
--
-- Security-definer RPCs are used for the two flows that RLS cannot express:
-- a brand-new vendor owner has no membership yet, and a newly invited member
-- has no membership until the invite is accepted.

-- ---------------------------------------------------------------------------
-- 1. Vendor visibility and profile editing for every active member
-- ---------------------------------------------------------------------------

drop policy if exists vendors_select_member on public.vendors;
create policy vendors_select_member on public.vendors
  for select using (public.is_vendor_member(id));

drop policy if exists vendors_update_member on public.vendors;
create policy vendors_update_member on public.vendors
  for update
  using (public.can_manage_vendor(id))
  with check (public.can_manage_vendor(id));

-- Teammates need to see each other's names in the staff and audit views.
drop policy if exists profiles_select_teammates on public.profiles;
create policy profiles_select_teammates on public.profiles
  for select using (
    exists (
      select 1
      from public.vendor_members me
      join public.vendor_members them on them.vendor_id = me.vendor_id
      where me.user_id = auth.uid()
        and me.active
        and them.user_id = profiles.id
        and them.active
    )
    or exists (
      select 1
      from public.enterprise_members me
      join public.enterprise_members them on them.partner_id = me.partner_id
      where me.user_id = auth.uid()
        and me.active
        and them.user_id = profiles.id
        and them.active
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Vendor invites
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_invites (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  email text not null,
  role public.vendor_member_role not null default 'manager',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vendor_invites_vendor_idx on public.vendor_invites(vendor_id);
create index if not exists vendor_invites_email_idx on public.vendor_invites(lower(email));

alter table public.vendor_invites enable row level security;

grant select, insert, update, delete on public.vendor_invites to authenticated;

drop policy if exists vendor_invites_select on public.vendor_invites;
create policy vendor_invites_select on public.vendor_invites
  for select using (public.can_manage_vendor(vendor_id) or public.is_admin());

drop policy if exists vendor_invites_write on public.vendor_invites;
create policy vendor_invites_write on public.vendor_invites
  for all
  using (public.can_manage_vendor(vendor_id) or public.is_admin())
  with check (public.can_manage_vendor(vendor_id) or public.is_admin());

create or replace function public.create_vendor_invite(
  p_vendor_id uuid,
  p_email text,
  p_role public.vendor_member_role default 'manager'
)
returns table (invite_id uuid, invite_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if not public.can_manage_vendor(p_vendor_id) then
    raise exception 'You cannot invite people to this vendor';
  end if;
  if p_role = 'owner' then
    raise exception 'Only the existing owner can transfer ownership';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Email is required';
  end if;

  insert into public.vendor_invites (vendor_id, email, role, invited_by)
  values (p_vendor_id, lower(trim(p_email)), p_role, auth.uid())
  returning vendor_invites.id, vendor_invites.token into v_id, v_token;

  perform public.write_audit(
    'vendor.invite',
    'vendor',
    p_vendor_id::text,
    null,
    jsonb_build_object('email', lower(trim(p_email)), 'role', p_role)
  );

  return query select v_id, v_token;
end;
$$;

grant execute on function public.create_vendor_invite(uuid, text, public.vendor_member_role) to authenticated;

create or replace function public.accept_vendor_invite(p_token text)
returns table (vendor_id uuid, member_role public.vendor_member_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.vendor_invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_invite
  from public.vendor_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'This invite link is not valid';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'This invite has already been used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired';
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from lower(v_invite.email) then
    raise exception 'This invite was sent to a different email address';
  end if;

  insert into public.vendor_members (vendor_id, user_id, role, invited_by, active)
  values (v_invite.vendor_id, auth.uid(), v_invite.role, v_invite.invited_by, true)
  on conflict (vendor_id, user_id)
  do update set role = excluded.role, active = true;

  update public.vendor_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  perform public.write_audit(
    'vendor.invite.accept',
    'vendor',
    v_invite.vendor_id::text,
    null,
    jsonb_build_object('email', v_email, 'role', v_invite.role)
  );

  return query select v_invite.vendor_id, v_invite.role;
end;
$$;

grant execute on function public.accept_vendor_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vendor self-registration
-- ---------------------------------------------------------------------------

create or replace function public.register_vendor_account(
  p_business_name text,
  p_category text default null,
  p_description text default null,
  p_email text default null,
  p_phone text default null,
  p_location text default null,
  p_website text default null
)
returns table (vendor_id uuid, vendor_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_slug text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  v_name := trim(coalesce(p_business_name, ''));
  if length(v_name) < 2 then
    raise exception 'Business name is required';
  end if;

  if exists (
    select 1 from public.vendor_members
    where user_id = auth.uid() and active
  ) then
    raise exception 'You already belong to a vendor account';
  end if;

  if exists (
    select 1 from public.vendor_applications
    where business_email = lower(trim(coalesce(p_email, '')))
      and status in ('started', 'incomplete', 'pending_review')
  ) then
    raise exception 'An application with this email is already being reviewed';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'vendor';
  end if;
  v_slug := v_slug || '-' || substr(replace(auth.uid()::text, '-', ''), 1, 6);

  insert into public.vendors (
    owner_id, name, slug, description, status, email, phone, address, website
  )
  values (
    auth.uid(),
    v_name,
    v_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    'pending',
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    nullif(trim(coalesce(p_website, '')), '')
  )
  returning id into v_vendor_id;

  insert into public.vendor_members (vendor_id, user_id, role, active)
  values (v_vendor_id, auth.uid(), 'owner', true)
  on conflict (vendor_id, user_id)
  do update set role = 'owner', active = true;

  insert into public.vendor_applications (
    vendor_id, status, step, payload,
    business_name, business_category, business_description,
    business_email, business_phone, business_location, business_website,
    submitted_at
  )
  values (
    v_vendor_id,
    'pending_review',
    'submitted',
    jsonb_build_object(
      'business_name', v_name,
      'category', nullif(trim(coalesce(p_category, '')), ''),
      'description', nullif(trim(coalesce(p_description, '')), ''),
      'email', nullif(lower(trim(coalesce(p_email, ''))), ''),
      'phone', nullif(trim(coalesce(p_phone, '')), ''),
      'location', nullif(trim(coalesce(p_location, '')), ''),
      'website', nullif(trim(coalesce(p_website, '')), '')
    ),
    v_name,
    nullif(trim(coalesce(p_category, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    nullif(trim(coalesce(p_website, '')), ''),
    now()
  );

  perform public.write_audit(
    'vendor.register',
    'vendor',
    v_vendor_id::text,
    null,
    jsonb_build_object('name', v_name, 'email', lower(trim(coalesce(p_email, ''))))
  );

  return query select v_vendor_id, v_slug;
end;
$$;

grant execute on function public.register_vendor_account(text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin writes that were missing
-- ---------------------------------------------------------------------------

drop policy if exists promo_codes_write_admin on public.promo_codes;
create policy promo_codes_write_admin on public.promo_codes
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists support_requests_update_admin on public.support_requests;
create policy support_requests_update_admin on public.support_requests
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin on public.orders
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists order_items_update_admin on public.order_items;
create policy order_items_update_admin on public.order_items
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Enterprise partners need to report on the orders that contain their codes.
drop policy if exists order_items_select_enterprise on public.order_items;
create policy order_items_select_enterprise on public.order_items
  for select using (
    enterprise_product_id is not null
    and exists (
      select 1
      from public.enterprise_products ep
      join public.enterprise_members em on em.partner_id = ep.partner_id
      where ep.id = order_items.enterprise_product_id
        and em.user_id = auth.uid()
        and em.active
    )
  );

drop policy if exists orders_select_enterprise on public.orders;
create policy orders_select_enterprise on public.orders
  for select using (
    exists (
      select 1
      from public.order_items oi
      join public.enterprise_products ep on ep.id = oi.enterprise_product_id
      join public.enterprise_members em on em.partner_id = ep.partner_id
      where oi.order_id = orders.id
        and em.user_id = auth.uid()
        and em.active
    )
  );

create or replace function public.admin_set_vendor_status(
  p_vendor_id uuid,
  p_status public.vendor_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  update public.vendors
  set status = p_status,
      approved_at = case
        when p_status = 'approved' then coalesce(approved_at, now())
        else approved_at
      end,
      updated_at = now()
  where id = p_vendor_id;

  update public.vendor_applications
  set status = case p_status
        when 'approved' then 'approved'::public.application_status
        when 'rejected' then 'rejected'::public.application_status
        when 'suspended' then 'suspended'::public.application_status
        else status
      end,
      decided_at = now(),
      decided_by = auth.uid(),
      decision_note = p_note,
      updated_at = now()
  where vendor_id = p_vendor_id;

  perform public.record_admin_action(
    'vendor.status.' || p_status::text,
    'vendor',
    p_vendor_id,
    jsonb_build_object('note', p_note)
  );
end;
$$;

grant execute on function public.admin_set_vendor_status(uuid, public.vendor_status, text) to authenticated;
