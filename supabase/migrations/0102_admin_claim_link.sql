-- 0102_admin_claim_link.sql
-- Reissuing a claim link.
--
-- Only the SHA-256 hash of a claim token is stored, so an admin cannot read a
-- recipient's link back out of the database to resend it. This function mints a
-- new token for a voucher that has not been claimed yet, stores its hash and
-- returns the token once, so the link can be emailed or handed over.
--
-- It is admin-only, it refuses anything already claimed or closed (rotating
-- then would break the holder's card without warning), and the action is
-- written to the audit log.
--
-- A voucher that came from a bulk order is refused on purpose: the business's
-- dashboard keeps that recipient's link, so a new token would silently turn
-- their copy into a dead link. Those are resent from the bulk order instead.

create or replace function public.admin_rotate_claim_token(p_voucher_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_token text;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  select * into v_voucher
  from public.vouchers
  where id = p_voucher_id
  for update;

  if not found then
    raise exception 'voucher not found';
  end if;

  if v_voucher.claimed_by is not null then
    raise exception 'this voucher has already been claimed';
  end if;

  if v_voucher.status not in ('issued', 'claimed') then
    raise exception 'only a voucher that can still be claimed gets a new link';
  end if;

  if exists (select 1 from public.bulk_order_vouchers where voucher_id = p_voucher_id) then
    raise exception 'this voucher belongs to a bulk order; resend it from the business order instead';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.vouchers
  set claim_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      updated_at = now()
  where id = p_voucher_id;

  perform public.record_admin_action(
    'voucher.claim_link_rotated',
    'voucher',
    p_voucher_id,
    jsonb_build_object('status', v_voucher.status)
  );

  return v_token;
end;
$$;

revoke all on function public.admin_rotate_claim_token(uuid) from public;
grant execute on function public.admin_rotate_claim_token(uuid) to authenticated;
