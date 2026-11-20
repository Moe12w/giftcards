-- 0136_owner_ledger_and_partner_order_reads.sql
--
-- C2: vendors and partners saw QAR 0.00 on their own financial pages.
--
-- financial_ledger had exactly one policy, `for select using (is_admin())`, and
-- the balance views are security_invoker, so a vendor querying its own ledger
-- got zero rows and FinancialsView rendered an empty table and a nil balance.
--
-- The owner of the money can now read its own entries. Read is granted to any
-- active member of the business (the financial page is reachable by every team
-- member in the dashboard), not just owners and managers. Inserts, updates and
-- deletes stay closed: the ledger is written only by the security-definer
-- functions, and the append-only trigger still blocks mutation.
--
-- Partners also could not see the orders behind those entries: can_see_order
-- only recognised buyers, admins and the vendor on an item, and there was no
-- order_items policy for partner-owned catalogue products. Both are added here,
-- limited to the partner's own products.

-- ---------------------------------------------------------------------------
-- 1. Let a business read the money that belongs to it
-- ---------------------------------------------------------------------------

drop policy if exists financial_ledger_owner_read on public.financial_ledger;
create policy financial_ledger_owner_read on public.financial_ledger
  for select using (
    (vendor_id is not null and public.is_vendor_member(vendor_id))
    or (partner_id is not null and public.is_enterprise_member(partner_id))
  );

-- The financial page lists the latest 100 entries for one owner, newest first.
create index if not exists financial_ledger_vendor_created_idx
  on public.financial_ledger (vendor_id, created_at desc)
  where vendor_id is not null;

create index if not exists financial_ledger_partner_created_idx
  on public.financial_ledger (partner_id, created_at desc)
  where partner_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Let a partner see the orders that contain its products
-- ---------------------------------------------------------------------------

create or replace function public.can_see_order(p_order_id uuid, p_buyer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    (p_buyer_id = auth.uid())
    or public.is_admin()
    or exists (
      select 1
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.vendor_id is not null
        and public.can_redeem_for(oi.vendor_id)
    )
    or exists (
      select 1
      from public.order_items oi
      join public.products pr on pr.id = oi.product_id
      where oi.order_id = p_order_id
        and pr.partner_id is not null
        and public.is_enterprise_member(pr.partner_id)
    );
$$;

revoke all on function public.can_see_order(uuid, uuid) from public;
grant execute on function public.can_see_order(uuid, uuid) to authenticated;

-- A partner sees only its own catalogue lines, never another seller's lines on
-- the same order: the existing order_items_select policy stays untouched and
-- this one is additive.
drop policy if exists order_items_select_partner_catalog on public.order_items;
create policy order_items_select_partner_catalog on public.order_items
  for select using (
    exists (
      select 1
      from public.products pr
      where pr.id = order_items.product_id
        and pr.partner_id is not null
        and public.is_enterprise_member(pr.partner_id)
    )
  );
