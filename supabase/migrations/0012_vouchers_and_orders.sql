-- 0012_vouchers_and_orders.sql
-- One order, many products, many vouchers.
--
-- `gift_cards` becomes `vouchers` — the issued instance of a purchased gift
-- card, for both monetary and experience fulfilment. Orders become a header
-- with `order_items`, so one purchase can contain several products.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.voucher_status as enum (
    'issued',
    'claimed',
    'active',
    'partially_redeemed',
    'redeemed',
    'expired',
    'cancelled',
    'void'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending',
    'paid',
    'failed',
    'refunded',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'unpaid',
    'pending',
    'paid',
    'failed',
    'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.delivery_method as enum (
    'email',
    'sms',
    'link',
    'in_app'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- gift_cards -> vouchers
-- ---------------------------------------------------------------------------
alter table public.gift_cards rename to public.vouchers;
alter table public.vouchers rename column offer_id to product_id;
alter table public.vouchers rename column original_value_minor to initial_value_minor;

alter table public.vouchers
  alter column status type public.voucher_status
  using case status::text
    when 'issued' then 'issued'
    when 'claimed' then 'claimed'
    when 'redeemed' then 'redeemed'
    when 'expired' then 'expired'
    when 'voided' then 'void'
    else 'issued'
  end::public.voucher_status;

alter table public.vouchers
  add column if not exists voucher_code text;
alter table public.vouchers
  add column if not exists qr_payload text;
alter table public.vouchers
  add column if not exists product_variant_id uuid references public.product_variants (id) on delete set null;
alter table public.vouchers
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null;
alter table public.vouchers
  add column if not exists order_item_id uuid;
alter table public.vouchers
  add column if not exists fulfilment_type public.fulfilment_type not null default 'monetary';
alter table public.vouchers
  add column if not exists remaining_value_minor bigint;
alter table public.vouchers
  add column if not exists total_sessions integer;
alter table public.vouchers
  add column if not exists remaining_sessions integer;
alter table public.vouchers
  add column if not exists used_sessions integer not null default 0;
alter table public.vouchers
  add column if not exists currency text not null default 'QAR';
alter table public.vouchers
  add column if not exists delivery_status text;
alter table public.vouchers
  add column if not exists scheduled_for timestamptz;
alter table public.vouchers
  add column if not exists gift_message text;
alter table public.vouchers
  add column if not exists redeemed_at timestamptz;
alter table public.vouchers
  add column if not exists updated_at timestamptz not null default now();

-- A voucher is either money or sessions. Never both.
alter table public.vouchers
  drop constraint if exists vouchers_fulfilment_shape;

alter table public.vouchers
  add constraint vouchers_fulfilment_shape check (
    (fulfilment_type = 'monetary' and total_sessions is null and remaining_sessions is null) or
    (fulfilment_type = 'experience' and total_sessions > 0
       and remaining_sessions between 0 and total_sessions
       and remaining_value_minor is null)
  );

create unique index if not exists vouchers_code_idx
  on public.vouchers (voucher_code) where voucher_code is not null;
create index if not exists vouchers_product_idx on public.vouchers (product_id);
create index if not exists vouchers_vendor_idx on public.vouchers (vendor_id);
create index if not exists vouchers_buyer_idx on public.vouchers (buyer_id);
create index if not exists vouchers_status_idx on public.vouchers (status);

-- ---------------------------------------------------------------------------
-- ledger_entries: card_id -> voucher_id
-- ---------------------------------------------------------------------------
alter table public.ledger_entries rename column card_id to voucher_id;

create index if not exists ledger_entries_voucher_idx on public.ledger_entries (voucher_id);

-- ---------------------------------------------------------------------------
-- orders: header only from here on
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists order_ref text unique;
alter table public.orders
  add column if not exists currency text not null default 'QAR';
alter table public.orders
  add column if not exists subtotal_minor bigint not null default 0;
alter table public.orders
  add column if not exists discount_minor bigint not null default 0;
alter table public.orders
  add column if not exists fee_minor bigint not null default 0;
alter table public.orders
  add column if not exists total_minor bigint not null default 0;
alter table public.orders
  add column if not exists sender_name text;
alter table public.orders
  add column if not exists delivery_method public.delivery_method;
alter table public.orders
  add column if not exists scheduled_for timestamptz;
alter table public.orders
  add column if not exists payment_status public.payment_status not null default 'unpaid';
alter table public.orders
  add column if not exists payment_provider text;
alter table public.orders
  add column if not exists paid_at timestamptz;
alter table public.orders
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_variant_id uuid references public.product_variants (id) on delete set null,
  enterprise_product_id uuid references public.enterprise_products (id) on delete set null,
  vendor_id uuid references public.vendors (id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  commission_minor bigint not null default 0 check (commission_minor >= 0),
  vendor_share_minor bigint not null default 0 check (vendor_share_minor >= 0),
  currency text not null default 'QAR',
  gift_message text,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  delivery_method public.delivery_method,
  scheduled_for timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_vendor_idx on public.order_items (vendor_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- Move the existing single-item orders into items.
insert into public.order_items (
  order_id, product_id, vendor_id, quantity, unit_price_minor, total_minor,
  commission_minor, vendor_share_minor, currency, gift_message,
  recipient_name, recipient_email, recipient_phone
)
select
  o.id, o.offer_id, p.vendor_id, 1, o.amount_minor, o.amount_minor,
  o.commission_minor, o.vendor_share_minor, 'QAR', o.gift_message,
  o.recipient_name, o.recipient_email, o.recipient_phone
from public.orders o
left join public.products p on p.id = o.offer_id
where o.offer_id is not null
on conflict do nothing;

update public.orders o
set
  subtotal_minor = coalesce(o.amount_minor, 0),
  total_minor = coalesce(o.amount_minor, 0),
  order_ref = coalesce(o.order_ref, 'ORD-' || upper(substr(replace(o.id::text, '-', ''), 1, 10))),
  payment_status = case when o.status = 'paid' then 'paid'::public.payment_status else 'unpaid'::public.payment_status end,
  paid_at = case when o.status = 'paid' then o.created_at else null end;

update public.vouchers v
set order_item_id = oi.id
from public.order_items oi
where oi.order_id = v.order_id and v.order_id is not null;

-- The single-item columns now live on order_items.
-- The select policy referenced orders.offer_id, so it is dropped first.
drop policy if exists orders_select on public.orders;

alter table public.orders drop column if exists offer_id;
alter table public.orders drop column if exists amount_minor;
alter table public.orders drop column if exists commission_minor;
alter table public.orders drop column if exists vendor_share_minor;
alter table public.orders drop column if exists gift_card_id;

alter table public.vouchers
  add constraint vouchers_order_item_fk
  foreign key (order_item_id) references public.order_items (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Backfill the fulfilment columns from the ledger and the catalogue
-- ---------------------------------------------------------------------------
update public.vouchers v
set
  vendor_id = p.vendor_id,
  fulfilment_type = p.fulfilment_type,
  remaining_value_minor = coalesce((
    select sum(le.amount_minor) from public.ledger_entries le where le.voucher_id = v.id
  ), v.initial_value_minor),
  total_sessions = p.session_count,
  used_sessions = coalesce((
    select -sum(le.sessions) from public.ledger_entries le where le.voucher_id = v.id
  ), 0),
  remaining_sessions = case
    when p.fulfilment_type = 'experience'
      then greatest(0, p.session_count - coalesce((
        select -sum(le.sessions) from public.ledger_entries le where le.voucher_id = v.id
      ), 0))
    else null
  end
from public.products p
where p.id = v.product_id;

update public.vouchers
set remaining_value_minor = initial_value_minor
where remaining_value_minor is null and fulfilment_type = 'monetary';

-- ---------------------------------------------------------------------------
-- Views
--
-- Both views change shape, and Postgres cannot change a view's columns with
-- CREATE OR REPLACE, so they are dropped and rebuilt. `vendor_cards` depends
-- on `card_balances`, so it goes first.
-- ---------------------------------------------------------------------------
drop view if exists public.vendor_cards;
drop view if exists public.card_balances;

create or replace view public.card_balances
with (security_invoker = true) as
select
  v.id as voucher_id,
  v.id as card_id,
  coalesce(sum(le.amount_minor), 0)::bigint as balance_minor,
  coalesce(sum(le.sessions), 0)::integer as sessions_remaining
from public.vouchers v
left join public.ledger_entries le on le.voucher_id = v.id
group by v.id;

create or replace view public.vendor_cards
with (security_invoker = true) as
select
  v.id as card_id,
  v.id as voucher_id,
  v.product_id,
  v.vendor_id,
  v.recipient_name,
  v.recipient_email,
  v.status,
  v.fulfilment_type,
  v.total_sessions,
  v.remaining_sessions,
  v.expires_at,
  coalesce(b.balance_minor, 0)::bigint as balance_minor,
  coalesce(b.sessions_remaining, 0)::integer as sessions_remaining
from public.vouchers v
left join public.card_balances b on b.voucher_id = v.id;

-- ---------------------------------------------------------------------------
-- Redefine the functions that referenced the old table names.
-- Their bodies are plain text, so a table rename does not rewrite them.
-- ---------------------------------------------------------------------------
create or replace function public.claim_card(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.vouchers%rowtype;
  v_recent_failures int;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'invalid token';
  end if;

  select count(*) into v_recent_failures
  from public.claim_attempts
  where token_hash = p_token_hash
    and succeeded = false
    and created_at > now() - interval '1 hour';

  if v_recent_failures >= 10 then
    raise exception 'too many attempts';
  end if;

  select * into v_card
  from public.vouchers
  where claim_token_hash = p_token_hash
  for update;

  if not found then
    insert into public.claim_attempts (token_hash, succeeded) values (p_token_hash, false);
    raise exception 'invalid token';
  end if;

  if v_card.claimed_by is not null or v_card.status <> 'issued' then
    insert into public.claim_attempts (token_hash, succeeded) values (p_token_hash, false);
    raise exception 'already claimed';
  end if;

  update public.vouchers
  set status = 'claimed',
      claimed_by = auth.uid(),
      claimed_at = now(),
      claim_token_hash = null,
      updated_at = now()
  where id = v_card.id;

  insert into public.claim_attempts (token_hash, succeeded) values (p_token_hash, true);

  return v_card.id;
end;
$$;

-- The return types changed from card_status to voucher_status, and Postgres
-- cannot change a function's return type with CREATE OR REPLACE.
drop function if exists public.redeem_card(uuid, bigint);

create or replace function public.redeem_card(p_card_id uuid, p_amount_minor bigint)
returns table (card_id uuid, new_balance_minor bigint, new_status public.voucher_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.vouchers%rowtype;
  v_balance bigint;
  v_new_balance bigint;
  v_allowed boolean;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select * into v_card
  from public.vouchers
  where id = p_card_id
  for update;

  if not found then
    raise exception 'card not found';
  end if;

  select exists (
    select 1
    from public.products o
    join public.vendors v on v.id = o.vendor_id
    where o.id = v_card.product_id
      and (v.owner_id = auth.uid() or public.is_admin())
  ) into v_allowed;

  if not v_allowed then
    raise exception 'not allowed';
  end if;

  if v_card.status not in ('claimed', 'issued', 'active', 'partially_redeemed') then
    raise exception 'card not redeemable';
  end if;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.ledger_entries
  where voucher_id = p_card_id;

  if v_balance <= 0 then
    raise exception 'no balance';
  end if;

  if p_amount_minor > v_balance then
    raise exception 'insufficient balance';
  end if;

  insert into public.ledger_entries (voucher_id, entry_type, amount_minor)
  values (p_card_id, 'redeem', -p_amount_minor);

  v_new_balance := v_balance - p_amount_minor;

  if v_new_balance = 0 then
    update public.vouchers
    set status = 'redeemed', redeemed_at = now(), updated_at = now()
    where id = p_card_id;
  else
    update public.vouchers
    set status = 'partially_redeemed', updated_at = now()
    where id = p_card_id;
  end if;

  return query
    select p_card_id, v_new_balance, (select status from public.vouchers where id = p_card_id);
end;
$$;

create or replace function public.issue_gift_card(
  p_offer_id uuid,
  p_order_id uuid,
  p_buyer_id uuid,
  p_original_value_minor bigint,
  p_claim_token_hash text,
  p_recipient_name text,
  p_recipient_email text,
  p_recipient_phone text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_id uuid;
  v_vendor_id uuid;
  v_fulfilment public.fulfilment_type;
  v_sessions integer;
begin
  select vendor_id, fulfilment_type, session_count
    into v_vendor_id, v_fulfilment, v_sessions
  from public.products
  where id = p_offer_id;

  if v_fulfilment = 'experience' then
    return public.issue_session_card(
      p_offer_id, p_order_id, p_buyer_id, p_original_value_minor,
      p_claim_token_hash, p_recipient_name, p_recipient_email, p_recipient_phone, p_expires_at
    );
  end if;

  insert into public.vouchers (
    product_id, order_id, buyer_id, recipient_name, recipient_email,
    recipient_phone, initial_value_minor, remaining_value_minor,
    claim_token_hash, expires_at, vendor_id, fulfilment_type, status
  )
  values (
    p_offer_id, p_order_id, p_buyer_id, p_recipient_name, p_recipient_email,
    p_recipient_phone, p_original_value_minor, p_original_value_minor,
    p_claim_token_hash, p_expires_at, v_vendor_id, 'monetary', 'issued'
  )
  returning id into v_card_id;

  insert into public.ledger_entries (voucher_id, order_id, entry_type, amount_minor)
  values (v_card_id, p_order_id, 'issue', p_original_value_minor);

  return v_card_id;
end;
$$;

create or replace function public.issue_session_card(
  p_offer_id uuid,
  p_order_id uuid,
  p_buyer_id uuid,
  p_original_value_minor bigint,
  p_claim_token_hash text,
  p_recipient_name text,
  p_recipient_email text,
  p_recipient_phone text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_id uuid;
  v_sessions integer;
  v_vendor_id uuid;
begin
  select session_count, vendor_id into v_sessions, v_vendor_id
  from public.products
  where id = p_offer_id and fulfilment_type = 'experience';

  if v_sessions is null then
    raise exception 'offer is not a session offer';
  end if;

  insert into public.vouchers (
    product_id, order_id, buyer_id, recipient_name, recipient_email,
    recipient_phone, initial_value_minor, claim_token_hash, expires_at,
    vendor_id, fulfilment_type, status, total_sessions, remaining_sessions, used_sessions
  )
  values (
    p_offer_id, p_order_id, p_buyer_id, p_recipient_name, p_recipient_email,
    p_recipient_phone, p_original_value_minor, p_claim_token_hash, p_expires_at,
    v_vendor_id, 'experience', 'issued', v_sessions, v_sessions, 0
  )
  returning id into v_card_id;

  -- The price is money, the entitlement is sessions.
  insert into public.ledger_entries (voucher_id, order_id, entry_type, amount_minor, sessions)
  values (v_card_id, p_order_id, 'issue', p_original_value_minor, v_sessions);

  return v_card_id;
end;
$$;

-- Same reason as redeem_card: the return type changed.
drop function if exists public.redeem_session(uuid);

create or replace function public.redeem_session(p_card_id uuid)
returns table (card_id uuid, sessions_remaining integer, new_status public.voucher_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.vouchers%rowtype;
  v_remaining integer;
  v_allowed boolean;
begin
  select * into v_card
  from public.vouchers
  where id = p_card_id
  for update;

  if not found then
    raise exception 'card not found';
  end if;

  if v_card.fulfilment_type <> 'experience' then
    raise exception 'card is not a session card';
  end if;

  select exists (
    select 1
    from public.products o
    join public.vendors v on v.id = o.vendor_id
    where o.id = v_card.product_id
      and (v.owner_id = auth.uid() or public.is_admin())
  ) into v_allowed;

  if not v_allowed then
    raise exception 'not allowed';
  end if;

  if v_card.status not in ('claimed', 'issued', 'active', 'partially_redeemed') then
    raise exception 'card not redeemable';
  end if;

  select coalesce(sum(sessions), 0) into v_remaining
  from public.ledger_entries
  where voucher_id = p_card_id;

  if v_remaining <= 0 then
    raise exception 'no sessions left';
  end if;

  insert into public.ledger_entries (voucher_id, entry_type, amount_minor, sessions)
  values (p_card_id, 'redeem', 0, -1);

  v_remaining := v_remaining - 1;

  if v_remaining = 0 then
    update public.vouchers
    set status = 'redeemed', redeemed_at = now(), remaining_sessions = 0,
        used_sessions = used_sessions + 1, updated_at = now()
    where id = p_card_id;
  else
    update public.vouchers
    set status = 'partially_redeemed', remaining_sessions = v_remaining,
        used_sessions = used_sessions + 1, updated_at = now()
    where id = p_card_id;
  end if;

  return query
    select
      p_card_id,
      v_remaining,
      (select status from public.vouchers where id = p_card_id);
end;
$$;

create or replace function public.fulfill_order(
  p_provider_invoice_id text,
  p_claim_token_hash text,
  p_card_code_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_card_id uuid;
  v_expires timestamptz;
  v_item public.order_items%rowtype;
begin
  select * into v_order
  from public.orders
  where provider_invoice_id = p_provider_invoice_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  -- Already fulfilled: return the existing voucher (never create a second one).
  if v_order.status = 'paid' then
    select v.id into v_card_id
    from public.vouchers v
    join public.order_items oi on oi.id = v.order_item_id
    where oi.order_id = v_order.id
    limit 1;
    return v_card_id;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'order not payable';
  end if;

  select * into v_item
  from public.order_items
  where order_id = v_order.id
  order by created_at
  limit 1;

  if v_item.id is null then
    raise exception 'order has no items';
  end if;

  select coalesce(pv.valid_until, p.valid_until) into v_expires
  from public.products p
  left join public.product_variants pv on pv.product_id = p.id
  where p.id = v_item.product_id
  limit 1;

  update public.orders
  set status = 'paid', payment_status = 'paid', paid_at = now(), updated_at = now()
  where id = v_order.id;

  v_card_id := public.issue_gift_card(
    v_item.product_id,
    v_order.id,
    v_order.buyer_id,
    v_item.total_minor,
    p_claim_token_hash,
    v_order.recipient_name,
    v_order.recipient_email,
    v_order.recipient_phone,
    v_expires
  );

  update public.vouchers
  set card_code_hash = p_card_code_hash,
      order_item_id = v_item.id,
      updated_at = now()
  where id = v_card_id;

  return v_card_id;
end;
$$;

-- The result columns changed (offer_id -> product_id, new session columns,
-- and the status type), so the function is dropped first.
drop function if exists public.card_by_code_hash(text);

create or replace function public.card_by_code_hash(p_code_hash text)
returns table (
  card_id uuid,
  product_id uuid,
  vendor_id uuid,
  status public.voucher_status,
  initial_value_minor bigint,
  balance_minor bigint,
  total_sessions integer,
  remaining_sessions integer,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.product_id,
    v.vendor_id,
    v.status,
    v.initial_value_minor,
    coalesce(b.balance_minor, 0),
    v.total_sessions,
    coalesce(b.sessions_remaining, 0),
    v.expires_at
  from public.vouchers v
  left join public.card_balances b on b.voucher_id = v.id
  where v.card_code_hash = p_code_hash;
$$;

create or replace function public.vendor_outstanding_minor(p_vendor_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(v.remaining_value_minor), 0)::bigint
  from public.vouchers v
  where v.vendor_id = p_vendor_id
    and v.fulfilment_type = 'monetary'
    and v.status not in ('redeemed', 'expired', 'cancelled', 'void');
$$;

revoke all on function public.redeem_card(uuid, bigint) from public;
grant execute on function public.redeem_card(uuid, bigint) to authenticated;
revoke all on function public.redeem_session(uuid) from public;
grant execute on function public.redeem_session(uuid) to authenticated;
