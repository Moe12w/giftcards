-- supabase/sandbox/seed.sql
--
-- Sandbox-only scenarios for the external-platform gift-card gateway.
-- Safe to re-run: every insert is guarded by a natural key. Run after all
-- migrations (0174-0180) on a disposable or staging database.
--
-- The sandbox credential below is public test data. Never use it in production.

do $$
declare
  v_platform uuid;
  v_vendor uuid;
  v_other_vendor uuid;
  v_product uuid;
  v_other_product uuid;
  v_mapping uuid;
  v_voucher uuid;
begin
  update public.integration_platforms
  set status = 'active', updated_at = now()
  where code = 'mock';

  select id into v_platform from public.integration_platforms where code = 'mock';

  -- Fixed sandbox credential. The plaintext is documented in the README so
  -- automated tests can sign requests without a secret store.
  if not exists (
    select 1 from public.integration_platform_credentials
    where platform_id = v_platform and environment = 'sandbox' and label = 'sandbox-e2e'
  ) then
    insert into public.integration_platform_credentials
      (platform_id, environment, label, key_prefix, key_hash, signing_secret_ciphertext)
    values (
      v_platform,
      'sandbox',
      'sandbox-e2e',
      'tz_sandbox_',
      public.integration_hash_key('tz_sandbox_mock_key_0123456789abcdef'),
      public.integration_encrypt_secret('tz_sandbox_mock_secret_0123456789abcdef')
    );
  end if;

  select id into v_vendor from public.vendors where status = 'approved' order by created_at limit 1;
  select id into v_other_vendor from public.vendors
    where status = 'approved' and id <> v_vendor order by created_at limit 1;

  if v_vendor is null then
    raise exception 'Seed needs at least one approved vendor';
  end if;

  select id into v_product from public.products
    where vendor_id = v_vendor and fulfilment_type = 'monetary' and status = 'published'
    order by created_at limit 1;
  select id into v_other_product from public.products
    where vendor_id = v_other_vendor and fulfilment_type = 'monetary' and status = 'published'
    order by created_at limit 1;

  if v_product is null then
    raise exception 'Seed needs a published monetary product';
  end if;

  if not exists (
    select 1 from public.integration_vendor_mappings
    where platform_id = v_platform and external_vendor_id = 'SBX-1001'
  ) then
    insert into public.integration_vendor_mappings (
      platform_id, business_kind, vendor_id, external_vendor_id, external_branch_id,
      status, verification_method, verification_evidence, verified_at, activated_at
    )
    values (
      v_platform, 'vendor', v_vendor, 'SBX-1001', 'SBX-1001-01',
      'active', 'documented_evidence', '{"source":"sandbox_seed"}'::jsonb, now(), now()
    )
    returning id into v_mapping;
  else
    select id into v_mapping from public.integration_vendor_mappings
      where platform_id = v_platform and external_vendor_id = 'SBX-1001';
  end if;

  -- 1. Healthy card: 500 QAR.
  if not exists (select 1 from public.vouchers where voucher_code = 'SBX-GOOD') then
    insert into public.vouchers (
      product_id, vendor_id, fulfilment_type, currency, status,
      initial_value_minor, remaining_value_minor, voucher_code
    )
    values (v_product, v_vendor, 'monetary', 'QAR', 'active', 50000, 50000, 'SBX-GOOD')
    returning id into v_voucher;
    insert into public.ledger_entries (voucher_id, entry_type, amount_minor)
    values (v_voucher, 'issue', 50000);
  end if;

  -- 2. Expired card.
  if not exists (select 1 from public.vouchers where voucher_code = 'SBX-EXPIRED') then
    insert into public.vouchers (
      product_id, vendor_id, fulfilment_type, currency, status,
      initial_value_minor, remaining_value_minor, voucher_code, expires_at
    )
    values (v_product, v_vendor, 'monetary', 'QAR', 'active', 50000, 50000, 'SBX-EXPIRED', now() - interval '1 day')
    returning id into v_voucher;
    insert into public.ledger_entries (voucher_id, entry_type, amount_minor)
    values (v_voucher, 'issue', 50000);
  end if;

  -- 3. Empty card.
  if not exists (select 1 from public.vouchers where voucher_code = 'SBX-EMPTY') then
    insert into public.vouchers (
      product_id, vendor_id, fulfilment_type, currency, status,
      initial_value_minor, remaining_value_minor, voucher_code
    )
    values (v_product, v_vendor, 'monetary', 'QAR', 'redeemed', 50000, 0, 'SBX-EMPTY')
    returning id into v_voucher;
    insert into public.ledger_entries (voucher_id, entry_type, amount_minor)
    values (v_voucher, 'issue', 50000), (v_voucher, 'redeem', -50000);
  end if;

  -- 4. Card belonging to another business (wrong-business scenario).
  if v_other_product is not null and not exists (
    select 1 from public.vouchers where voucher_code = 'SBX-OTHER'
  ) then
    insert into public.vouchers (
      product_id, vendor_id, fulfilment_type, currency, status,
      initial_value_minor, remaining_value_minor, voucher_code
    )
    values (v_other_product, v_other_vendor, 'monetary', 'QAR', 'active', 50000, 50000, 'SBX-OTHER')
    returning id into v_voucher;
    insert into public.ledger_entries (voucher_id, entry_type, amount_minor)
    values (v_voucher, 'issue', 50000);
  end if;

  -- 5. Held card: 15 QAR already reserved.
  if not exists (select 1 from public.vouchers where voucher_code = 'SBX-HELD') then
    insert into public.vouchers (
      product_id, vendor_id, fulfilment_type, currency, status,
      initial_value_minor, remaining_value_minor, voucher_code
    )
    values (v_product, v_vendor, 'monetary', 'QAR', 'active', 50000, 50000, 'SBX-HELD')
    returning id into v_voucher;
    insert into public.ledger_entries (voucher_id, entry_type, amount_minor)
    values (v_voucher, 'issue', 50000);
    insert into public.integration_reservations (
      reference, platform_id, mapping_id, voucher_id, vendor_id, external_order_id,
      amount_minor, currency, status, idempotency_key, expires_at
    )
    values (
      'RSV-SBXHELD01', v_platform, v_mapping, v_voucher, v_vendor, 'SBX-ORDER-HELD',
      15000, 'QAR', 'active', 'sbx-held-key', now() + interval '10 minutes'
    );
  end if;
end $$;
