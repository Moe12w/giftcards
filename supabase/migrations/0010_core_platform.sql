-- 0010_core_platform.sql
-- Core platform structures: roles, vendor staff, enterprise partners,
-- categories, media, notifications, system settings and the audit log.
--
-- This migration is additive. It does not touch the existing catalogue or
-- fulfilment tables; those are extended in 0011 and 0012.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum (
    'customer',
    'vendor_owner',
    'vendor_manager',
    'vendor_redemption_staff',
    'enterprise_user',
    'admin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vendor_member_role as enum (
    'owner',
    'manager',
    'redemption_staff'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.enterprise_member_role as enum (
    'owner',
    'manager',
    'analyst'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_status as enum (
    'started',
    'incomplete',
    'pending_review',
    'approved',
    'rejected',
    'suspended'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.profile_status as enum (
    'active',
    'suspended'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_status as enum (
    'draft',
    'active',
    'suspended'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_kind as enum (
    'logo',
    'banner',
    'cover',
    'gallery',
    'product'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles: account status
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists status public.profile_status not null default 'active';
alter table public.profiles
  add column if not exists avatar_url text;
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- user_roles: platform-wide role assignment
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

comment on table public.user_roles is
  'One platform role per user. Vendor and enterprise roles are additionally scoped by vendor_members / enterprise_members.';

create table if not exists public.user_role_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  permission text not null,
  allowed boolean not null default true,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role, permission)
);

-- ---------------------------------------------------------------------------
-- vendor_members: vendor staff and their permissions
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_members (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.vendor_member_role not null default 'redemption_staff',
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (vendor_id, user_id)
);

create index if not exists vendor_members_user_idx on public.vendor_members (user_id);

-- ---------------------------------------------------------------------------
-- vendor_applications: onboarding wizard state
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_applications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  status public.application_status not null default 'started',
  step text not null default 'business',
  payload jsonb not null default '{}'::jsonb,
  business_name text,
  business_category text,
  business_description text,
  business_email text,
  business_phone text,
  business_location text,
  business_website text,
  logo_url text,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_applications_status_idx
  on public.vendor_applications (status, submitted_at desc);

-- ---------------------------------------------------------------------------
-- enterprise_partners
-- ---------------------------------------------------------------------------
create table if not exists public.enterprise_partners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  name text not null,
  slug text not null unique,
  website text,
  contact_name text,
  contact_email text,
  contact_phone text,
  industry text,
  expected_volume text,
  notes text,
  status public.partner_status not null default 'draft',
  -- Reserved for a future partner API / webhook integration.
  integration_config jsonb not null default '{}'::jsonb,
  -- Reserved for future settlement runs.
  settlement_terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enterprise_members (
  partner_id uuid not null references public.enterprise_partners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.enterprise_member_role not null default 'analyst',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);

create index if not exists enterprise_members_user_idx on public.enterprise_members (user_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_ar text,
  icon text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- product_media: images for vendors and products
-- ---------------------------------------------------------------------------
create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors (id) on delete cascade,
  product_id uuid,
  url text not null,
  kind public.media_kind not null default 'product',
  sort_order integer not null default 0,
  alt_text text,
  created_at timestamptz not null default now(),
  constraint product_media_one_owner check (
    (vendor_id is not null and product_id is null) or
    (vendor_id is null and product_id is not null)
  )
);

create index if not exists product_media_vendor_idx on public.product_media (vendor_id);
create index if not exists product_media_product_idx on public.product_media (product_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title_key text not null,
  body_key text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------------
-- system_settings
-- ---------------------------------------------------------------------------
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log: append-only history of everything that matters
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_user_id, created_at desc);

-- The audit log is append-only, exactly like the ledger.
create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

drop trigger if exists audit_no_update on public.audit_log;
create trigger audit_no_update
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- Role helpers used by every RLS policy
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.user_roles where user_id = auth.uid()),
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.vendor_member_role(p_vendor_id uuid)
returns public.vendor_member_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.vendor_members
  where vendor_id = p_vendor_id
    and user_id = auth.uid()
    and active
  limit 1;
$$;

create or replace function public.is_vendor_member(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.vendor_member_role(p_vendor_id) is not null;
$$;

-- Owner or manager: everything the vendor can do.
create or replace function public.can_manage_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.vendor_member_role(p_vendor_id) in ('owner', 'manager');
$$;

-- Any staff member may redeem for their vendor.
create or replace function public.can_redeem_for(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.vendor_member_role(p_vendor_id) is not null;
$$;

create or replace function public.enterprise_member_role(p_partner_id uuid)
returns public.enterprise_member_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.enterprise_members
  where partner_id = p_partner_id
    and user_id = auth.uid()
    and active
  limit 1;
$$;

create or replace function public.is_enterprise_member(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.enterprise_member_role(p_partner_id) is not null;
$$;

create or replace function public.can_manage_partner(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.enterprise_member_role(p_partner_id) in ('owner', 'manager');
$$;

-- ---------------------------------------------------------------------------
-- Keep user_roles in step with the profile trigger
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_data ->> 'full_name', new.email)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit helper
-- ---------------------------------------------------------------------------
create or replace function public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.audit_log (actor_user_id, actor_role, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    (select role::text from public.user_roles where user_id = auth.uid()),
    p_action,
    p_entity_type,
    p_entity_id,
    p_before,
    p_after
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.vendor_member_role(uuid) to authenticated;
grant execute on function public.is_vendor_member(uuid) to authenticated;
grant execute on function public.can_manage_vendor(uuid) to authenticated;
grant execute on function public.can_redeem_for(uuid) to authenticated;
grant execute on function public.enterprise_member_role(uuid) to authenticated;
grant execute on function public.is_enterprise_member(uuid) to authenticated;
grant execute on function public.can_manage_partner(uuid) to authenticated;
grant execute on function public.write_audit(text, text, text, jsonb, jsonb) to authenticated;
