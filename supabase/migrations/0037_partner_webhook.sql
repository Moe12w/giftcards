-- ---------------------------------------------------------------------------
-- Partner webhook & API key support
--
-- Allows an enterprise partner to create API keys and report code usage
-- via webhook. When a partner's code is used in their app, their system
-- calls our webhook, which uses the API key to identify the partner,
-- finds the inventory row and closes both the inventory and the buyer's gift.
-- ---------------------------------------------------------------------------

-- 1. Hash helper for API keys
create or replace function public.hash_enterprise_api_key(p_key text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(trim(p_key), 'sha256'), 'hex');
$$;

-- 2. Create an API key for a partner (returns the plaintext key once)
drop function if exists public.create_enterprise_api_key(uuid, text);

create or replace function public.create_enterprise_api_key(
  p_partner_id uuid,
  p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_key text;
  v_hash text;
  v_key_id uuid;
begin
  if not (public.can_manage_partner(p_partner_id) or public.is_admin()) then
    raise exception 'not allowed';
  end if;

  -- Generate a secure random token: gft_live_...
  v_raw_key := 'gft_' || encode(gen_random_bytes(24), 'hex');
  v_hash := public.hash_enterprise_api_key(v_raw_key);

  insert into public.enterprise_api_keys (partner_id, label, key_hash, created_by)
  values (p_partner_id, nullif(trim(p_label), ''), v_hash, auth.uid())
  returning id into v_key_id;

  perform public.write_audit(
    'enterprise_api_key_created', 'enterprise_api_keys', v_key_id::text,
    null, jsonb_build_object('partner_id', p_partner_id, 'label', p_label)
  );

  return jsonb_build_object(
    'id', v_key_id,
    'key', v_raw_key
  );
end;
$$;

-- 3. Revoke an API key
drop function if exists public.revoke_enterprise_api_key(uuid);

create or replace function public.revoke_enterprise_api_key(p_key_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner uuid;
begin
  select partner_id into v_partner from public.enterprise_api_keys where id = p_key_id;
  if not found then
    raise exception 'api key not found';
  end if;

  if not (public.can_manage_partner(v_partner) or public.is_admin()) then
    raise exception 'not allowed';
  end if;

  update public.enterprise_api_keys
  set revoked_at = now()
  where id = p_key_id;

  perform public.write_audit(
    'enterprise_api_key_revoked', 'enterprise_api_keys', p_key_id::text,
    null, jsonb_build_object('partner_id', v_partner)
  );

  return true;
end;
$$;

-- 4. Report code usage by webhook (closes inventory + buyer gift)
drop function if exists public.report_enterprise_code_usage(uuid, text);

create or replace function public.report_enterprise_code_usage(
  p_partner_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory uuid;
  v_voucher uuid;
  v_reference text;
begin
  select id into v_inventory
  from public.enterprise_code_inventory
  where partner_id = p_partner_id
    and (
      inventory_ref = trim(p_code)
      or code_fingerprint = public.enterprise_code_fingerprint(p_partner_id, p_code)
    )
  limit 1;

  if v_inventory is null then
    return jsonb_build_object('success', false, 'error', 'code not found');
  end if;

  -- If already redeemed, answer success with reference
  if (select status from public.enterprise_code_inventory where id = v_inventory) = 'redeemed' then
    select id into v_voucher from public.vouchers where order_item_id = (select allocated_order_item_id from public.enterprise_code_inventory where id = v_inventory) limit 1;
    return jsonb_build_object('success', true, 'status', 'redeemed', 'voucher_id', v_voucher);
  end if;

  update public.enterprise_code_inventory
  set status = 'redeemed', updated_at = now()
  where id = v_inventory;

  insert into public.enterprise_code_events (inventory_id, partner_id, event_type, order_id, payload)
  values (
    v_inventory, p_partner_id, 'reported',
    (select allocated_order_id from public.enterprise_code_inventory where id = v_inventory),
    jsonb_build_object('source', 'webhook')
  );

  select id into v_voucher
  from public.vouchers
  where order_item_id = (select allocated_order_item_id from public.enterprise_code_inventory where id = v_inventory)
    and fulfilment_type = 'enterprise_code'
  limit 1;

  if v_voucher is not null then
    update public.vouchers
    set status = 'redeemed', remaining_value_minor = 0, redeemed_at = now(), updated_at = now()
    where id = v_voucher;
  end if;

  v_reference := 'CLS-' || upper(substr(replace(public.decrypt_enterprise_code(
    (select code_ciphertext from public.enterprise_code_inventory where id = v_inventory)
  ), '-', ''), 1, 10));

  return jsonb_build_object(
    'success', true,
    'status', 'redeemed',
    'voucher_id', v_voucher,
    'reference', v_reference
  );
end;
$$;

grant execute on function public.create_enterprise_api_key(uuid, text) to authenticated;
grant execute on function public.revoke_enterprise_api_key(uuid) to authenticated;
grant execute on function public.report_enterprise_code_usage(uuid, text) to service_role;
