-- 0124_mcp_payment_links.sql
--
-- Shareable MyFatoorah payment links for orders prepared by the MCP server.
-- One order can have several links over time (expired -> reissued), so the
-- link is its own record. `orders.payment_url` remains a cache of the latest.

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_id uuid references public.myfatoorah_payments(id) on delete set null,
  invoice_id text,
  payment_url text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'QAR',
  status text not null default 'active'
    check (status in ('active', 'paid', 'expired', 'cancelled')),
  channel text not null default 'link'
    check (channel in ('link', 'email', 'sms', 'all')),
  send_to_masked text,
  idempotency_key text,
  expires_at timestamptz,
  last_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_links_order_idempotency_key
  on public.payment_links (order_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payment_links_order_created_idx
  on public.payment_links (order_id, created_at desc);

create index if not exists payment_links_status_expires_idx
  on public.payment_links (status, expires_at);

drop trigger if exists payment_links_touch on public.payment_links;
create trigger payment_links_touch
  before update on public.payment_links
  for each row execute function public.touch_updated_at();

alter table public.payment_links enable row level security;

drop policy if exists payment_links_select on public.payment_links;
create policy payment_links_select on public.payment_links
  for select to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.buyer_id = auth.uid()
    )
  );

grant select on public.payment_links to authenticated;

-- Service-role writers (the MCP Edge Function) bypass RLS directly.
grant all on public.payment_links to service_role;
