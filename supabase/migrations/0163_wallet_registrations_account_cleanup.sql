-- 0163_wallet_registrations_account_cleanup.sql
-- Apple Wallet device tokens outlived the account they belonged to.
--
-- wallet_pass_registrations (0159) is keyed by voucher, not by user, so deleting
-- the auth user cascades away the profile, push tokens and addresses but leaves
-- the device_library_id / push_token pairs registered for the passes that user
-- held. Those tokens are personal data: a device identifier plus a token that
-- Apple uses to push updates to that device. They must go with the account.
--
-- A registration is attributed to whoever bought or claimed the pass, which is
-- the only link those rows have to a person. One consequence is deliberate: a
-- gift the user bought and someone else claimed loses that recipient's device
-- registration too. The recipient can add the pass to Wallet again and it will
-- re-register; a push token belonging to a closed account cannot be recovered,
-- so privacy wins over the convenience of a stale pass.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Staff and partner accounts are removed by the business that owns them.
  if coalesce(public.is_admin(), false) then
    raise exception 'admin_account';
  end if;

  if exists (select 1 from public.vendors where owner_id = v_uid)
     or exists (
       select 1 from public.vendor_members
       where user_id = v_uid and active
     ) then
    raise exception 'vendor_account';
  end if;

  if exists (
    select 1 from public.enterprise_members
    where user_id = v_uid and active
  ) then
    raise exception 'enterprise_account';
  end if;

  if exists (
       select 1 from public.business_accounts
       where user_id = v_uid and status = 'approved'
     )
     or exists (select 1 from public.bulk_orders where buyer_user_id = v_uid) then
    raise exception 'business_account';
  end if;

  -- A shared basket holds other people's contributions; deleting the creator
  -- would delete their gifts too.
  if exists (
    select 1
    from public.gift_baskets b
    where b.creator_id = v_uid
      and exists (
        select 1
        from public.gift_basket_participants p
        where p.basket_id = b.id
          and p.user_id <> v_uid
      )
  ) then
    raise exception 'shared_basket';
  end if;

  -- Apple Wallet device tokens for the passes this user held. The vouchers
  -- themselves survive (they belong to the recipient or the vendor), so this
  -- cannot be left to the voucher cascade.
  delete from public.wallet_pass_registrations r
  using public.vouchers v
  where v.id = r.voucher_id
    and (v.buyer_id = v_uid or v.claimed_by = v_uid);

  -- Cascades to profiles, memberships, tokens, addresses, recipients,
  -- favourites, notifications and the customer's own baskets.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
