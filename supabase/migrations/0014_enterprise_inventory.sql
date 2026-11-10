-- 0014_enterprise_inventory.sql
-- Enterprise partners supply their own gift-card codes in bulk.
--
-- The actual code is encrypted at rest and never readable by a partner user.
-- A fingerprint (hash) is kept for duplicate detection. Only the service role
-- and the owning partner's own staff can see metadata — never the plaintext of
-- an allocated code.
--
-- Sold or delivered does NOT mean redeemed. A code only becomes `redeemed`
-- when the partner confirms it.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.inventory_status as enum (
    'available',
    'reserved',
    'sold',
    'delivered',
    'redeemed',
    'expired',
    'invalid',
    'cancelled',
    'quarantined'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.code_event_type as enum (
    'imported',
    'reserved',
    'allocated',
    'sold',
    'delivered',
    'confirmed_redeemed',
    'expired',
    'invalidated',
    'cancelled',
    'quarantined',
    'reported'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_status as enum (
    'processing',
    'completed',
    'failed'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Import batches
-- ---------------------------------------------------------------------------
create table if not exists public.enterprise_import_batches (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.enterprise_partners (id) on delete cascade,
  filename text,
  source text not null default 'csv' check (source in ('csv', 'xlsx')),
  total_rows integer not null default 0,
  inserted_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  invalid_rows integer not null default 0,
  status public.import_status not null default 'processing',
  error_report jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists enterprise_import_batches_partner_idx
  on public.enterprise_import_batches (partner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Inventory: one row per imported code
-- ---------------------------------------------------------------------------
create table if not exists public.enterprise_code_inventory (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.enterprise_partners (id) on delete cascade,
  enterprise_product_id uuid not null references public.enterprise_products (id) on delete cascade,
  import_batch_id uuid references public.enterprise_import_batches (id) on delete set null,
  inventory_ref text not null unique,
  -- AES-256 encrypted code. No client policy exposes this column.
  code_ciphertext bytea,
  -- Hash used to detect duplicates without storing a readable code.
  code_fingerprint text not null unique,
  code_last4 text,
  denomination_minor bigint not null check (denomination_minor > 0),
  currency text not null default 'QAR',
  status public.inventory_status not null default 'available',
  allocated_order_id uuid references public.orders (id) on delete set null,
  allocated_order_item_id uuid references public.order_items (id) on delete set null,
  allocated_at timestamptz,
  delivered_at timestamptz,
  confirmed_redeemed_at timestamptz,
  expires_at timestamptz,
  invalid_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A code that is sold or delivered has been allocated to an order.
  constraint inventory_allocation_shape check (
    (status in ('available', 'reserved', 'quarantined', 'invalid', 'expired', 'cancelled'))
      or allocated_order_id is not null
  )
);

create index if not exists enterprise_code_inventory_partner_idx
  on public.enterprise_code_inventory (partner_id, status);
create index if not exists enterprise_code_inventory_product_idx
  on public.enterprise_code_inventory (enterprise_product_id, status);
create index if not exists enterprise_code_inventory_order_idx
  on public.enterprise_code_inventory (allocated_order_id);

-- ---------------------------------------------------------------------------
-- Code events: the full history of every inventory row
-- ---------------------------------------------------------------------------
create table if not exists public.enterprise_code_events (
  id bigint generated always as identity primary key,
  inventory_id uuid not null references public.enterprise_code_inventory (id) on delete cascade,
  partner_id uuid not null references public.enterprise_partners (id) on delete cascade,
  event_type public.code_event_type not null,
  order_id uuid references public.orders (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists enterprise_code_events_inventory_idx
  on public.enterprise_code_events (inventory_id, created_at desc);
create index if not exists enterprise_code_events_partner_idx
  on public.enterprise_code_events (partner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Encryption helpers
--
-- The key lives in system_settings (admin only). Production should move it to
-- Supabase Vault and swap the body of these two functions.
-- ---------------------------------------------------------------------------
create or replace function public.enterprise_code_key()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select value ->> 'key' into v_key
  from public.system_settings
  where key = 'enterprise.code_encryption_key';

  if v_key is null or v_key = '' then
    raise exception 'enterprise code encryption key is not configured';
  end if;
  return v_key;
end;
$$;

create or replace function public.encrypt_enterprise_code(p_code text)
returns bytea
language sql
volatile
security definer
set search_path = public
as $$
  select pgp_sym_encrypt(p_code, public.enterprise_code_key());
$$;

create or replace function public.decrypt_enterprise_code(p_ciphertext bytea)
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select pgp_sym_decrypt(p_ciphertext, public.enterprise_code_key());
$$;

-- Duplicate detection without storing anything readable.
create or replace function public.enterprise_code_fingerprint(
  p_partner_id uuid,
  p_code text
)
returns text
language sql
immutable
as $$
  select encode(
    digest(p_partner_id::text || ':' || upper(trim(p_code)), 'sha256'),
    'hex'
  );
$$;

-- ---------------------------------------------------------------------------
-- Import: validate, deduplicate and store a batch of codes.
-- The caller passes the plaintext codes; they are encrypted here.
-- ---------------------------------------------------------------------------
create or replace function public.import_enterprise_codes(
  p_batch_id uuid,
  p_rows jsonb
)
returns table (
  batch_id uuid,
  inserted integer,
  duplicates integer,
  invalid integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.enterprise_import_batches%rowtype;
  v_row jsonb;
  v_product uuid;
  v_code text;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_invalid integer := 0;
  v_fingerprint text;
  v_last4 text;
  v_denomination bigint;
begin
  select * into v_batch
  from public.enterprise_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'import batch not found';
  end if;

  if not public.can_manage_partner(v_batch.partner_id) then
    raise exception 'not allowed';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_code := nullif(trim(coalesce(v_row ->> 'code', '')), '');
    v_product := nullif(v_row ->> 'enterprise_product_id', '')::uuid;
    v_denomination := nullif(v_row ->> 'denomination_minor', '')::bigint;

    if v_code is null or v_product is null or v_denomination is null or v_denomination <= 0 then
      v_invalid := v_invalid + 1;
      insert into public.enterprise_code_events (inventory_id, partner_id, event_type, reason, payload)
      select null, v_batch.partner_id, 'quarantined', 'invalid row', v_row
      where false;
      continue;
    end if;

    v_fingerprint := public.enterprise_code_fingerprint(v_batch.partner_id, v_code);
    v_last4 := right(v_code, 4);

    if exists (
      select 1 from public.enterprise_code_inventory
      where code_fingerprint = v_fingerprint
    ) then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    insert into public.enterprise_code_inventory (
      partner_id, enterprise_product_id, import_batch_id, inventory_ref,
      code_ciphertext, code_fingerprint, code_last4, denomination_minor,
      currency, status
    )
    values (
      v_batch.partner_id, v_product, v_batch.id,
      coalesce(nullif(v_row ->> 'inventory_ref', ''), 'INV-' || upper(substr(v_fingerprint, 1, 10))),
      public.encrypt_enterprise_code(v_code),
      v_fingerprint,
      v_last4,
      v_denomination,
      coalesce(nullif(v_row ->> 'currency', ''), 'QAR'),
      'available'
    );

    insert into public.enterprise_code_events (inventory_id, partner_id, event_type, payload)
    values (
      (select id from public.enterprise_code_inventory where code_fingerprint = v_fingerprint),
      v_batch.partner_id, 'imported', jsonb_build_object('last4', v_last4)
    );

    v_inserted := v_inserted + 1;
  end loop;

  update public.enterprise_import_batches
  set
    total_rows = v_inserted + v_duplicates + v_invalid,
    inserted_rows = v_inserted,
    duplicate_rows = v_duplicates,
    invalid_rows = v_invalid,
    status = 'completed',
    completed_at = now()
  where id = p_batch_id;

  perform public.write_audit(
    'enterprise_import', 'enterprise_import_batches', p_batch_id::text,
    null, jsonb_build_object('inserted', v_inserted, 'duplicates', v_duplicates, 'invalid', v_invalid)
  );

  return query select p_batch_id, v_inserted, v_duplicates, v_invalid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Allocation: find an available code and reserve it for an order.
-- `for update skip locked` makes sure two orders can never take the same code.
-- ---------------------------------------------------------------------------
create or replace function public.allocate_enterprise_code(
  p_partner_id uuid,
  p_enterprise_product_id uuid,
  p_order_id uuid default null,
  p_order_item_id uuid default null
)
returns table (
  inventory_id uuid,
  inventory_ref text,
  code_masked text,
  denomination_minor bigint,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.enterprise_code_inventory%rowtype;
begin
  if not public.can_manage_partner(p_partner_id) then
    raise exception 'not allowed';
  end if;

  select * into v_row
  from public.enterprise_code_inventory
  where partner_id = p_partner_id
    and enterprise_product_id = p_enterprise_product_id
    and status = 'available'
  order by created_at
  for update skip locked
  limit 1;

  if v_row.id is null then
    raise exception 'no available codes for this product';
  end if;

  update public.enterprise_code_inventory
  set
    status = 'sold',
    allocated_order_id = p_order_id,
    allocated_order_item_id = p_order_item_id,
    allocated_at = now(),
    updated_at = now()
  where id = v_row.id;

  insert into public.enterprise_code_events (inventory_id, partner_id, event_type, order_id, actor_user_id)
  values (v_row.id, p_partner_id, 'allocated', p_order_id, auth.uid());

  perform public.write_audit(
    'enterprise_code_allocated', 'enterprise_code_inventory', v_row.id::text,
    jsonb_build_object('status', 'available'),
    jsonb_build_object('status', 'sold', 'order_id', p_order_id)
  );

  return query
    select v_row.id, v_row.inventory_ref,
      '••••' || coalesce(v_row.code_last4, ''),
      v_row.denomination_minor, v_row.currency;
end;
$$;

-- ---------------------------------------------------------------------------
-- State changes: delivery, expiry, invalidation, cancellation
-- ---------------------------------------------------------------------------
create or replace function public.set_enterprise_code_status(
  p_inventory_id uuid,
  p_status public.inventory_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.enterprise_code_inventory%rowtype;
  v_event public.code_event_type;
begin
  select * into v_row
  from public.enterprise_code_inventory
  where id = p_inventory_id
  for update;

  if not found then
    raise exception 'inventory row not found';
  end if;

  if not public.can_manage_partner(v_row.partner_id) then
    raise exception 'not allowed';
  end if;

  -- A redeemed code is only reached through the confirmation path below.
  if p_status = 'redeemed' then
    raise exception 'use confirm_enterprise_redemption';
  end if;

  v_event := case p_status
    when 'delivered' then 'delivered'::public.code_event_type
    when 'expired' then 'expired'::public.code_event_type
    when 'invalid' then 'invalidated'::public.code_event_type
    when 'cancelled' then 'cancelled'::public.code_event_type
    when 'quarantined' then 'quarantined'::public.code_event_type
    when 'reserved' then 'reserved'::public.code_event_type
    else 'reported'::public.code_event_type
  end;

  update public.enterprise_code_inventory
  set
    status = p_status,
    invalid_reason = p_reason,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    updated_at = now()
  where id = p_inventory_id;

  insert into public.enterprise_code_events (inventory_id, partner_id, event_type, actor_user_id, reason)
  values (v_row.id, v_row.partner_id, v_event, auth.uid(), p_reason);
end;
$$;

-- Only the partner (or an admin) confirming a redemption makes a code redeemed.
create or replace function public.confirm_enterprise_redemption(
  p_inventory_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.enterprise_code_inventory%rowtype;
begin
  select * into v_row
  from public.enterprise_code_inventory
  where id = p_inventory_id
  for update;

  if not found then
    raise exception 'inventory row not found';
  end if;

  if not public.can_manage_partner(v_row.partner_id) then
    raise exception 'not allowed';
  end if;

  if v_row.status not in ('sold', 'delivered') then
    raise exception 'code was never sold';
  end if;

  update public.enterprise_code_inventory
  set status = 'redeemed', confirmed_redeemed_at = now(), updated_at = now()
  where id = p_inventory_id;

  insert into public.enterprise_code_events (inventory_id, partner_id, event_type, actor_user_id)
  values (v_row.id, v_row.partner_id, 'confirmed_redeemed', auth.uid());

  perform public.write_audit(
    'enterprise_code_redeemed', 'enterprise_code_inventory', p_inventory_id::text,
    jsonb_build_object('status', v_row.status),
    jsonb_build_object('status', 'redeemed')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Import a redemption report (partner confirmation file).
-- ---------------------------------------------------------------------------
create or replace function public.import_enterprise_redemptions(
  p_partner_id uuid,
  p_rows jsonb
)
returns table (confirmed integer, skipped integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_ref text;
  v_fingerprint text;
  v_confirmed integer := 0;
  v_skipped integer := 0;
begin
  if not public.can_manage_partner(p_partner_id) then
    raise exception 'not allowed';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_ref := nullif(trim(coalesce(v_row ->> 'inventory_ref', '')), '');
    v_fingerprint := nullif(trim(coalesce(v_row ->> 'code', '')), '');

    if v_ref is not null then
      select id into v_ref from public.enterprise_code_inventory
      where partner_id = p_partner_id and inventory_ref = v_ref;
    elsif v_fingerprint is not null then
      select id into v_ref from public.enterprise_code_inventory
      where partner_id = p_partner_id
        and code_fingerprint = public.enterprise_code_fingerprint(p_partner_id, v_fingerprint);
    end if;

    if v_ref is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    perform public.confirm_enterprise_redemption(v_ref);
    v_confirmed := v_confirmed + 1;
  end loop;

  return query select v_confirmed, v_skipped;
end;
$$;

-- ---------------------------------------------------------------------------
-- What partner staff may read: metadata and a masked code. The encrypted
-- column is never part of this view, so a partner query cannot pull the
-- ciphertext out of the database at all.
-- ---------------------------------------------------------------------------
create or replace view public.enterprise_inventory_summary
with (security_invoker = true) as
select
  i.id as inventory_id,
  i.partner_id,
  i.enterprise_product_id,
  i.import_batch_id,
  i.inventory_ref,
  ('••••' || coalesce(i.code_last4, '')) as code_masked,
  i.denomination_minor,
  i.currency,
  i.status,
  i.allocated_order_id,
  i.allocated_order_item_id,
  i.allocated_at,
  i.delivered_at,
  i.confirmed_redeemed_at,
  i.expires_at,
  i.invalid_reason,
  i.created_at,
  i.updated_at
from public.enterprise_code_inventory i;

comment on view public.enterprise_inventory_summary is
  'Partner-safe inventory view. Excludes the encrypted code column.';

revoke all on function public.import_enterprise_codes(uuid, jsonb) from public;
grant execute on function public.import_enterprise_codes(uuid, jsonb) to authenticated;
revoke all on function public.allocate_enterprise_code(uuid, uuid, uuid, uuid) from public;
grant execute on function public.allocate_enterprise_code(uuid, uuid, uuid, uuid) to authenticated;
revoke all on function public.set_enterprise_code_status(uuid, public.inventory_status, text) from public;
grant execute on function public.set_enterprise_code_status(uuid, public.inventory_status, text) to authenticated;
revoke all on function public.confirm_enterprise_redemption(uuid) from public;
grant execute on function public.confirm_enterprise_redemption(uuid) to authenticated;
revoke all on function public.import_enterprise_redemptions(uuid, jsonb) from public;
grant execute on function public.import_enterprise_redemptions(uuid, jsonb) to authenticated;
-- Decryption is service-role only: a partner user never gets plaintext back.
revoke all on function public.decrypt_enterprise_code(bytea) from public;
revoke all on function public.encrypt_enterprise_code(text) from public;
revoke all on function public.enterprise_code_key() from public;
