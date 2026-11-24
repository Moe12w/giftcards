-- 0120_myfatoorah_giftcard_payments.sql
--
-- Phase 2: connects real MyFatoorah payments to the existing gift-card order
-- and voucher system. Provider-managed commission only: we allocate the full
-- invoice share to the supplier and record (never invent) provider fees/shares.

-- ---------------------------------------------------------------------------
-- Order payment-link fields (reusable across checkout attempts)
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists payment_url text,
  add column if not exists payment_link_expires_at timestamptz,
  add column if not exists provider_payment_id text;

create index if not exists orders_provider_payment_idx
  on public.orders (provider_payment_id)
  where provider_payment_id is not null;

-- ---------------------------------------------------------------------------
-- Payment, allocation and refund records
-- ---------------------------------------------------------------------------

create table if not exists public.myfatoorah_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  vendor_id uuid references public.vendors(id),
  supplier_code text,
  invoice_id text not null,
  payment_id text,
  invoice_url text,
  amount_minor bigint not null,
  currency text not null default 'QAR',
  payment_status text not null default 'pending',
  provider_response jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.myfatoorah_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.myfatoorah_payments(id) on delete cascade,
  supplier_code text not null,
  invoice_share_minor bigint not null,
  provider_share_minor bigint,
  deposit_share_minor bigint,
  settlement_status text not null default 'awaiting_settlement',
  raw_supplier jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists myfatoorah_payment_allocations_payment_supplier_key
  on public.myfatoorah_payment_allocations (payment_id, supplier_code);

create table if not exists public.myfatoorah_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.myfatoorah_payments(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  vendor_id uuid references public.vendors(id),
  refund_reference text,
  provider_refund_id text,
  amount_minor bigint not null,
  status text not null default 'pending',
  provider_response jsonb default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists myfatoorah_refunds_reference_key
  on public.myfatoorah_refunds (provider_refund_id)
  where provider_refund_id is not null;

-- Extend the existing finance ledger with running-balance and audit metadata.
alter table public.financial_ledger
  add column if not exists direction text not null default 'credit',
  add column if not exists balance_after_minor bigint,
  add column if not exists metadata jsonb default '{}'::jsonb;

drop trigger if exists financial_ledger_append_only on public.financial_ledger;
create trigger financial_ledger_append_only
  before update or delete on public.financial_ledger
  for each row execute function public.prevent_ledger_mutation();

-- Vendor running balance, derived from the immutable ledger.
create or replace view public.vendor_financial_balances
with (security_invoker = true)
as
select
  vendor_id,
  coalesce(sum(amount_minor), 0)::bigint as balance_minor,
  coalesce(sum(case when amount_minor > 0 then amount_minor else 0 end), 0)::bigint as credits_minor,
  coalesce(sum(case when amount_minor < 0 then -amount_minor else 0 end), 0)::bigint as debits_minor,
  max(created_at) as updated_at
from public.financial_ledger
where vendor_id is not null
group by vendor_id;

create or replace view public.partner_financial_balances
with (security_invoker = true)
as
select
  partner_id,
  coalesce(sum(amount_minor), 0)::bigint as balance_minor,
  coalesce(sum(case when amount_minor > 0 then amount_minor else 0 end), 0)::bigint as credits_minor,
  coalesce(sum(case when amount_minor < 0 then -amount_minor else 0 end), 0)::bigint as debits_minor,
  max(created_at) as updated_at
from public.financial_ledger
where partner_id is not null
group by partner_id;

-- ---------------------------------------------------------------------------
-- Ledger helper: append-only, with a computed running balance
-- ---------------------------------------------------------------------------

create or replace function public.myfatoorah_financial_entry(
  p_vendor_id uuid,
  p_order_id uuid,
  p_entry_type text,
  p_amount_minor bigint,
  p_reference text,
  p_metadata jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  perform set_config('mf.internal', '1', true);
  select coalesce(sum(amount_minor), 0) into v_balance
  from public.financial_ledger
  where vendor_id = p_vendor_id;
  v_balance := v_balance + p_amount_minor;

  insert into public.financial_ledger
    (entry_type, vendor_id, order_id, amount_minor, currency, reference, direction, balance_after_minor, metadata)
  values
    (p_entry_type, p_vendor_id, p_order_id, p_amount_minor, 'QAR', p_reference,
     case when p_amount_minor < 0 then 'debit' else 'credit' end,
     v_balance, coalesce(p_metadata, '{}'::jsonb));

  return v_balance;
end;
$$;

/** Append-only ledger entry for an enterprise partner's sale or refund. */
create or replace function public.myfatoorah_partner_financial_entry(
  p_partner_id uuid,
  p_order_id uuid,
  p_entry_type text,
  p_amount_minor bigint,
  p_reference text,
  p_metadata jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  perform set_config('mf.internal', '1', true);
  select coalesce(sum(amount_minor), 0) into v_balance
  from public.financial_ledger
  where partner_id = p_partner_id;
  v_balance := v_balance + p_amount_minor;

  insert into public.financial_ledger
    (entry_type, partner_id, order_id, amount_minor, currency, reference, direction, balance_after_minor, metadata)
  values
    (p_entry_type, p_partner_id, p_order_id, p_amount_minor, 'QAR', p_reference,
     case when p_amount_minor < 0 then 'debit' else 'credit' end,
     v_balance, coalesce(p_metadata, '{}'::jsonb));

  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment lifecycle RPCs (service role only)
-- ---------------------------------------------------------------------------

create or replace function public.myfatoorah_payment_recorded(
  p_order_id uuid,
  p_invoice_id text,
  p_invoice_url text,
  p_payment_url text,
  p_supplier_code text,
  p_provider_response jsonb default null
)
returns public.myfatoorah_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  p public.myfatoorah_payments;
  v_vendor uuid;
  v_amount bigint;
begin
  perform set_config('mf.internal', '1', true);
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  select vendor_id into v_vendor from public.order_items
  where order_id = p_order_id limit 1;
  v_amount := coalesce(o.total_minor, o.subtotal_minor, 0);

  update public.orders
  set provider_invoice_id = p_invoice_id,
      payment_url = p_payment_url,
      payment_link_expires_at = now() + interval '30 minutes',
      payment_status = 'pending',
      payment_provider = 'myfatoorah'
  where id = p_order_id;

  insert into public.myfatoorah_payments
    (order_id, vendor_id, supplier_code, invoice_id, invoice_url, amount_minor, currency, provider_response)
  values
    (p_order_id, v_vendor, p_supplier_code, p_invoice_id, p_invoice_url, v_amount, 'QAR', coalesce(p_provider_response, '{}'::jsonb))
  on conflict (order_id) do update
  set invoice_id = excluded.invoice_id,
      invoice_url = excluded.invoice_url,
      supplier_code = excluded.supplier_code,
      updated_at = now()
  returning * into p;

  if p is null then
    select * into p from public.myfatoorah_payments where order_id = p_order_id;
  end if;

  -- One allocation per supplier, so a multi-vendor/multi-partner invoice
  -- reconciles exactly. Vendors and partners use the same supplier model.
  insert into public.myfatoorah_payment_allocations
    (payment_id, supplier_code, invoice_share_minor)
  select p.id, supplier_code, coalesce(sum(oi.total_minor), 0)
  from (
    select oi.total_minor,
           coalesce(v.myfatoorah_supplier_code, ep.myfatoorah_supplier_code) as supplier_code
    from public.order_items oi
    left join public.vendors v on v.id = oi.vendor_id
    left join public.products pr on pr.id = oi.product_id
    left join public.enterprise_partners ep on ep.id = pr.partner_id
    where oi.order_id = p_order_id
  ) lines
  where supplier_code is not null
  group by supplier_code
  on conflict (payment_id, supplier_code) do nothing;

  return p;
end;
$$;

/** Marks a payment paid from a verified webhook + provider status inquiry. */
create or replace function public.myfatoorah_payment_confirmed(
  p_order_id uuid,
  p_payment_id text,
  p_provider_response jsonb default null,
  p_suppliers jsonb default null
)
returns public.myfatoorah_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.myfatoorah_payments;
  item record;
  v_share bigint;
  v_partner uuid;
  already_paid boolean;
  supplier_raw jsonb;
begin
  perform set_config('mf.internal', '1', true);
  select * into p from public.myfatoorah_payments where order_id = p_order_id for update;
  if not found then raise exception 'payment_not_found'; end if;

  already_paid := p.payment_status = 'paid';
  update public.myfatoorah_payments
  set payment_status = 'paid',
      payment_id = coalesce(nullif(p_payment_id, ''), payment_id),
      paid_at = now(),
      provider_response = coalesce(p_provider_response, provider_response),
      updated_at = now()
  where id = p.id
  returning * into p;

  if not already_paid then
    update public.orders
    set status = 'paid', payment_status = 'paid', paid_at = now()
    where id = p_order_id;

    if p.vendor_id is not null then
      select coalesce(sum(total_minor), 0) into v_share from public.order_items where order_id = p_order_id;
      perform public.myfatoorah_financial_entry(
        p.vendor_id, p_order_id, 'sale', v_share,
        coalesce(p_payment_id, p.invoice_id),
        jsonb_build_object('provider', 'myfatoorah', 'invoice_id', p.invoice_id)
      );
    else
      -- Partner sales own their codes; the partner receives the same ledger
      -- treatment as a vendor, with no separate platform commission.
      select pr.partner_id, coalesce(sum(oi.total_minor), 0)
        into v_partner, v_share
      from public.order_items oi
      join public.products pr on pr.id = oi.product_id
      where oi.order_id = p_order_id and pr.partner_id is not null
      group by pr.partner_id
      limit 1;
      if v_partner is not null then
        perform public.myfatoorah_partner_financial_entry(
          v_partner, p_order_id, 'sale', v_share,
          coalesce(p_payment_id, p.invoice_id),
          jsonb_build_object('provider', 'myfatoorah', 'invoice_id', p.invoice_id)
        );
      end if;
    end if;
  end if;

  if p_suppliers is not null and jsonb_typeof(p_suppliers) = 'array' then
    for supplier_raw in select value from jsonb_array_elements(p_suppliers) loop
      update public.myfatoorah_payment_allocations
      set provider_share_minor = case
            when nullif(supplier_raw->>'ProposedShare', '') is not null
              then round((supplier_raw->>'ProposedShare')::numeric * 100)::bigint
            else provider_share_minor end,
          deposit_share_minor = case
            when nullif(supplier_raw->>'DepositShare', '') is not null
              then round((supplier_raw->>'DepositShare')::numeric * 100)::bigint
            else deposit_share_minor end,
          raw_supplier = supplier_raw,
          updated_at = now()
      where payment_id = p.id
        and supplier_code in (supplier_raw->>'SupplierCode', supplier_raw->>'Code');
    end loop;
  end if;

  return p;
end;
$$;

/** Issues one card per order item, after confirmed payment. Idempotent. */
create or replace function public.myfatoorah_fulfill_order(
  p_provider_invoice_id text,
  p_hashes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  n integer := 0;
  i integer := 0;
  item record;
  h jsonb;
  v_card_id uuid;
  v_cards uuid[] := '{}';
begin
  perform set_config('mf.internal', '1', true);
  select * into o from public.orders where provider_invoice_id = p_provider_invoice_id for update;
  if not found then raise exception 'order_not_found'; end if;
  -- Idempotency is based on actual vouchers: confirming the payment marks the
  -- order paid, but that must not trick us into skipping issuance.
  select array_agg(id) into v_cards from public.vouchers where order_id = o.id;
  if coalesce(array_length(v_cards, 1), 0) > 0 then
    return jsonb_build_object('already_fulfilled', true, 'voucher_ids', to_jsonb(v_cards));
  end if;
  if o.payment_status <> 'paid' then raise exception 'payment_not_confirmed'; end if;

  select count(*) into n from public.order_items where order_id = o.id;
  if n = 0 then raise exception 'order_has_no_items'; end if;
  if jsonb_typeof(p_hashes) <> 'array' or jsonb_array_length(p_hashes) <> n then
    raise exception 'invalid_signature_array';
  end if;

  for item in
    select oi.*, pr.fulfilment_type as item_fulfilment_type,
           row_number() over (order by oi.created_at, oi.id) as rn
    from public.order_items oi
    join public.products pr on pr.id = oi.product_id
    where oi.order_id = o.id
  loop
    i := i + 1;
    h := p_hashes -> (i - 1);
    -- Partner codes are issued by the existing paid-order trigger
    -- (issue_enterprise_code). Do not create a Tazella voucher for them.
    if item.item_fulfilment_type = 'enterprise_code' then
      continue;
    end if;
    if h->>'claim_token_hash' is null or h->>'card_code_hash' is null then
      raise exception 'invalid_signature_array';
    end if;

    if item.item_fulfilment_type = 'experience' then
      select public.issue_session_card(
        item.product_id, o.id, o.buyer_id, item.total_minor,
        h->>'claim_token_hash', item.recipient_name, item.recipient_email, item.recipient_phone, o.scheduled_for
      ) into v_card_id;
    else
      select public.issue_gift_card(
        item.product_id, o.id, o.buyer_id, item.total_minor,
        h->>'claim_token_hash', item.recipient_name, item.recipient_email, item.recipient_phone, o.scheduled_for
      ) into v_card_id;
    end if;

    update public.vouchers
    set order_item_id = item.id,
        card_code_hash = h->>'card_code_hash',
        currency = coalesce(currency, o.currency)
    where id = v_card_id;

    v_cards := v_cards || v_card_id;
  end loop;

  return jsonb_build_object('already_fulfilled', false, 'voucher_ids', to_jsonb(v_cards));
end;
$$;

/** Read-only polling helper for the customer's checkout screen. */
create or replace function public.myfatoorah_payment_status(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'status', o.status,
    'payment_status', o.payment_status,
    'paid', o.payment_status::text = 'paid',
    'failed', o.payment_status::text = 'failed',
    'amount_minor', o.total_minor,
    'currency', o.currency,
    'payment_url', o.payment_url
  )
  from public.orders o
  where o.id = p_order_id
    and (public.is_admin() or o.buyer_id = auth.uid());
$$;

-- Refund: records the provider response and reverses the vendor ledger.
create or replace function public.myfatoorah_payment_refunded(
  p_order_id uuid,
  p_amount_minor bigint,
  p_refund_reference text,
  p_status text default 'completed',
  p_provider_response jsonb default null
)
returns public.myfatoorah_refunds
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.myfatoorah_payments;
  r public.myfatoorah_refunds;
  v_partner uuid;
begin
  perform set_config('mf.internal', '1', true);
  select * into p from public.myfatoorah_payments where order_id = p_order_id for update;
  if not found then raise exception 'payment_not_found'; end if;

  insert into public.myfatoorah_refunds
    (payment_id, order_id, vendor_id, refund_reference, provider_refund_id, amount_minor, status, provider_response, completed_at)
  values
    (p.id, p_order_id, p.vendor_id, p_refund_reference, p_refund_reference,
     p_amount_minor, p_status, coalesce(p_provider_response, '{}'::jsonb),
     case when p_status = 'completed' then now() else null end)
  on conflict (provider_refund_id) where provider_refund_id is not null do update
  set status = excluded.status, provider_response = excluded.provider_response
  returning * into r;

  if p_status = 'completed' and p.vendor_id is not null then
    update public.orders
    set status = 'refunded', payment_status = 'refunded'
    where id = p_order_id and payment_status <> 'refunded';
    if found then
      update public.vouchers
      set status = 'void'
      where order_id = p_order_id and status in ('issued', 'claimed', 'active');
      perform public.myfatoorah_financial_entry(
        p.vendor_id, p_order_id, 'refund', -p_amount_minor,
        p_refund_reference, jsonb_build_object('provider', 'myfatoorah')
      );
    elsif p.vendor_id is null then
      select pr.partner_id into v_partner
      from public.order_items oi
      join public.products pr on pr.id = oi.product_id
      where oi.order_id = p_order_id and pr.partner_id is not null
      limit 1;
      if v_partner is not null then
        perform public.myfatoorah_partner_financial_entry(
          v_partner, p_order_id, 'refund', -p_amount_minor,
          p_refund_reference, jsonb_build_object('provider', 'myfatoorah')
        );
      end if;
    end if;
  end if;
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

alter table public.myfatoorah_payments enable row level security;
alter table public.myfatoorah_payment_allocations enable row level security;
alter table public.myfatoorah_refunds enable row level security;

drop policy if exists myfatoorah_payments_select on public.myfatoorah_payments;
create policy myfatoorah_payments_select on public.myfatoorah_payments
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
    or (vendor_id is not null and public.is_vendor_member(vendor_id))
  );

drop policy if exists myfatoorah_allocations_select on public.myfatoorah_payment_allocations;
create policy myfatoorah_allocations_select on public.myfatoorah_payment_allocations
  for select to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.myfatoorah_payments p
      where p.id = public.myfatoorah_payment_allocations.payment_id
        and (public.is_admin() or public.is_vendor_member(p.vendor_id))
    )
  );

drop policy if exists myfatoorah_refunds_select on public.myfatoorah_refunds;
create policy myfatoorah_refunds_select on public.myfatoorah_refunds
  for select to authenticated using (
    public.is_admin()
    or public.is_vendor_member(vendor_id)
    or exists (
      select 1 from public.orders o
      join public.order_items oi on oi.order_id = o.id
      join public.products pr on pr.id = oi.product_id
      where o.id = order_id
        and pr.partner_id is not null
        and public.is_enterprise_member(pr.partner_id)
    )
  );

grant select on public.myfatoorah_payments, public.myfatoorah_payment_allocations,
  public.myfatoorah_refunds, public.vendor_financial_balances,
  public.partner_financial_balances to authenticated;

revoke all on function public.myfatoorah_financial_entry(uuid, uuid, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_partner_financial_entry(uuid, uuid, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_payment_recorded(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_payment_confirmed(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_fulfill_order(text, jsonb) from public, anon, authenticated;
revoke all on function public.myfatoorah_payment_refunded(uuid, bigint, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.myfatoorah_financial_entry(uuid, uuid, text, bigint, text, jsonb) to service_role;
grant execute on function public.myfatoorah_partner_financial_entry(uuid, uuid, text, bigint, text, jsonb) to service_role;
grant execute on function public.myfatoorah_payment_recorded(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.myfatoorah_payment_confirmed(uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.myfatoorah_fulfill_order(text, jsonb) to service_role;
grant execute on function public.myfatoorah_payment_refunded(uuid, bigint, text, text, jsonb) to service_role;

revoke all on function public.myfatoorah_payment_status(uuid) from public, anon;
grant execute on function public.myfatoorah_payment_status(uuid) to authenticated;
