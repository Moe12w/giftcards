-- 0137_restrict_voucher_updates_to_admin.sql
--
-- C6: `vouchers_update_vendor` granted `for update` to can_manage_vendor(...)
-- without column limits, so a vendor could rewrite every field of a sold card
-- from the browser: status, remaining_value_minor, voucher_code, expires_at,
-- buyer_id, claimed_by. The ledger stayed correct (redemption reads the
-- append-only ledger, not this row), but a vendor could void a customer's card,
-- overwrite its code, or desynchronise the displayed balance from the money.
--
-- No vendor flow writes this table directly. Vendor redemption goes through
-- redeem_voucher_by_code / redeem_voucher_by_id, and the delivery, bulk and
-- admin tools use the service role or an admin session. Card state is owned by
-- the security-definer functions, so the policy is removed rather than narrowed:
-- there is no column a vendor legitimately needs to write here.
--
-- The admin void/expire tool (web/lib/actions/admin.ts) updates `status` with
-- the admin's own session, which the previous policy allowed through its
-- `or is_admin()` branch, so that path gets its own explicit policy.

drop policy if exists vouchers_update_vendor on public.vouchers;

drop policy if exists vouchers_update_admin on public.vouchers;
create policy vouchers_update_admin on public.vouchers
  for update
  using (public.is_admin())
  with check (public.is_admin());
