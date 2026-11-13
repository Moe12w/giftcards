-- 0049_advertising_admin_operations.sql
-- Admin review, overrides, credits, maintenance wrapper and function grants.

-- ---------------------------------------------------------------------------
-- 1. Approval workflow
-- ---------------------------------------------------------------------------

create or replace function public.advertising_review_campaign(
  p_campaign_id uuid,
  p_approve boolean,
  p_note text default null,
  p_checklist jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if c.status not in ('pending_approval', 'pending_payment', 'scheduled', 'paused', 'active') then
    raise exception 'campaign_not_reviewable';
  end if;

  insert into public.advertising_approvals
    (campaign_id, status, reviewed_by, reviewed_at, note, checklist)
  values
    (c.id, case when p_approve then 'approved' else 'rejected' end,
     auth.uid(), now(), p_note, coalesce(p_checklist, '{}'::jsonb));

  if p_approve then
    update public.advertising_campaigns
    set approved_at = now(), approved_by = auth.uid(),
        rejected_at = null, rejection_reason = null,
        status = case when payment_status = 'paid' then status else 'pending_payment' end,
        updated_at = now()
    where id = c.id;

    if c.payment_status = 'paid' then
      perform public.advertising_try_activate(c.id);
    end if;

    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'approved',
      'Campaign approved',
      'Campaign ' || c.name || ' has been approved.',
      jsonb_build_object('campaign_id', c.id, 'note', p_note));
  else
    update public.advertising_campaigns
    set status = 'rejected', rejected_at = now(),
        rejection_reason = coalesce(nullif(p_note, ''), 'Rejected by admin'),
        updated_at = now()
    where id = c.id;

    perform public.advertising_release_inventory(c.id);
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'rejected',
      'Campaign rejected',
      'Campaign ' || c.name || ' was rejected. ' || coalesce(p_note, ''),
      jsonb_build_object('campaign_id', c.id, 'note', p_note));
  end if;

  perform public.advertising_audit(
    case when p_approve then 'campaign_approved' else 'campaign_rejected' end,
    'advertising_campaign', c.id,
    jsonb_build_object('note', p_note, 'checklist', p_checklist));

  select * into c from public.advertising_campaigns where id = p_campaign_id;
  return jsonb_build_object('campaign_id', c.id, 'status', c.status);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Manual overrides
-- ---------------------------------------------------------------------------

create or replace function public.advertising_admin_override(
  p_campaign_id uuid,
  p_action text,
  p_value jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_amount bigint;
  v_refunded bigint;
  v_tx uuid;
  v_ref text;
  v_ends timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into c from public.advertising_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign_not_found';
  end if;

  if p_action = 'pause' then
    update public.advertising_campaigns
    set status = 'paused', paused_at = now(), pause_reason = 'admin_pause',
        auto_resume_at = null, updated_at = now()
    where id = c.id;
    perform public.advertising_release_inventory(c.id);
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'paused',
      'Campaign paused by admin',
      'Campaign ' || c.name || ' was paused by the platform team.',
      jsonb_build_object('campaign_id', c.id));

  elsif p_action = 'resume' then
    update public.advertising_campaigns
    set status = 'scheduled', paused_at = null, pause_reason = null,
        auto_resume_at = null, updated_at = now()
    where id = c.id;
    perform public.advertising_try_activate(c.id);

  elsif p_action = 'remove' then
    update public.advertising_campaigns
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = c.id;
    perform public.advertising_release_inventory(c.id);
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'cancelled',
      'Campaign removed',
      'Campaign ' || c.name || ' was removed by the platform team.',
      jsonb_build_object('campaign_id', c.id));

  elsif p_action = 'extend' then
    v_ends := (p_value->>'ends_at')::timestamptz;
    if v_ends is null or v_ends <= c.starts_at then
      raise exception 'invalid_end_date';
    end if;
    update public.advertising_campaigns
    set ends_at = v_ends,
        status = case when status = 'completed' and v_ends > now() then 'scheduled' else status end,
        completed_at = case when status = 'completed' and v_ends > now() then null else completed_at end,
        updated_at = now()
    where id = c.id;
    if v_ends > now() and c.payment_status = 'paid' then
      perform public.advertising_try_activate(c.id);
    end if;
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'extended',
      'Campaign extended',
      'Campaign ' || c.name || ' now runs until ' || v_ends::text || '.',
      jsonb_build_object('campaign_id', c.id, 'ends_at', v_ends));

  elsif p_action = 'capacity_override' then
    update public.advertising_campaigns
    set capacity_override = coalesce((p_value->>'enabled')::boolean, true),
        updated_at = now()
    where id = c.id;
    if coalesce((p_value->>'enabled')::boolean, true) then
      perform public.advertising_try_activate(c.id);
    end if;

  elsif p_action = 'refund' then
    if c.payment_status <> 'paid' then
      raise exception 'campaign_not_paid';
    end if;
    v_amount := coalesce((p_value->>'amount_minor')::bigint, c.quote_amount_minor);
    if v_amount <= 0 then
      raise exception 'invalid_refund_amount';
    end if;
    select coalesce(sum(amount_minor), 0) into v_refunded
    from public.advertising_transactions
    where campaign_id = c.id and kind = 'refund' and status = 'succeeded';
    if v_refunded + v_amount > c.quote_amount_minor then
      raise exception 'refund_exceeds_paid';
    end if;

    v_ref := 'REF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.advertising_transactions
      (campaign_id, vendor_id, kind, status, amount_minor, currency, provider,
       provider_reference, idempotency_key, description, raw_payload, created_by, processed_at)
    values
      (c.id, c.vendor_id, 'refund', 'succeeded', v_amount, c.currency, 'manual',
       v_ref, 'refund:' || gen_random_uuid()::text, 'Advertising refund',
       coalesce(p_value, '{}'::jsonb), auth.uid(), now())
    returning id into v_tx;

    insert into public.advertising_ledger_entries
      (transaction_id, campaign_id, vendor_id, entry_type, entry_key, direction,
       amount_minor, balance_after_minor, currency, reference, metadata)
    values
      (v_tx, c.id, c.vendor_id, 'refund', 'refund:' || v_tx::text, 'debit',
       -v_amount, greatest(0, c.quote_amount_minor - v_refunded - v_amount),
       c.currency, c.campaign_ref, coalesce(p_value, '{}'::jsonb));

    if v_refunded + v_amount >= c.quote_amount_minor then
      update public.advertising_campaigns
      set status = 'refunded', refunded_at = now(), payment_status = 'refunded',
          updated_at = now()
      where id = c.id;
      perform public.advertising_release_inventory(c.id);
    else
      update public.advertising_campaigns set updated_at = now() where id = c.id;
    end if;

    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'refunded',
      'Advertising refund',
      'A refund of ' || v_amount::text || ' minor units was recorded for ' || c.name || '.',
      jsonb_build_object('campaign_id', c.id, 'amount_minor', v_amount));

  elsif p_action = 'feature_business' then
    if c.vendor_id is null then
      raise exception 'campaign_has_no_vendor';
    end if;
    update public.vendors
    set is_featured = coalesce((p_value->>'enabled')::boolean, true),
        updated_at = now()
    where id = c.vendor_id;
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'featured',
      'Business featured',
      'Your business was ' || case when coalesce((p_value->>'enabled')::boolean, true)
        then 'featured' else 'removed from featured' end || ' by the platform team.',
      jsonb_build_object('campaign_id', c.id));

  elsif p_action = 'credit' then
    v_amount := coalesce((p_value->>'amount_minor')::bigint, 0);
    if v_amount <= 0 then
      raise exception 'invalid_credit_amount';
    end if;
    if c.vendor_id is null then
      raise exception 'campaign_has_no_vendor';
    end if;
    insert into public.advertising_promotional_credits
      (vendor_id, amount_minor, remaining_minor, currency, source, expires_at, note, granted_by)
    values
      (c.vendor_id, v_amount, v_amount, c.currency, 'admin_grant',
       (p_value->>'expires_at')::timestamptz, p_value->>'note', auth.uid());
    perform public.advertising_notify(
      'vendor', c.vendor_id, c.id, 'credit_granted',
      'Advertising credit added',
      'A credit of ' || v_amount::text || ' minor units was added to your advertising account.',
      jsonb_build_object('campaign_id', c.id, 'amount_minor', v_amount));

  else
    raise exception 'unknown_action';
  end if;

  perform public.advertising_audit(
    'admin_override:' || p_action, 'advertising_campaign', c.id,
    jsonb_build_object('value', p_value));

  select * into c from public.advertising_campaigns where id = p_campaign_id;
  return jsonb_build_object('campaign_id', c.id, 'status', c.status, 'action', p_action);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Credit grants
-- ---------------------------------------------------------------------------

create or replace function public.advertising_grant_credit(
  p_vendor_id uuid,
  p_amount_minor bigint,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_currency text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_credit_amount';
  end if;

  select coalesce(max(currency), 'QAR') into v_currency
  from public.advertising_campaigns
  where vendor_id = p_vendor_id;

  insert into public.advertising_promotional_credits
    (vendor_id, amount_minor, remaining_minor, currency, source, expires_at, note, granted_by)
  values
    (p_vendor_id, p_amount_minor, p_amount_minor, coalesce(v_currency, 'QAR'),
     'admin_grant', p_expires_at, p_note, auth.uid())
  returning id into v_id;

  perform public.advertising_notify(
    'vendor', p_vendor_id, null, 'credit_granted',
    'Advertising credit added',
    'A credit of ' || p_amount_minor::text || ' minor units was added to your advertising account.',
    jsonb_build_object('credit_id', v_id, 'amount_minor', p_amount_minor));

  perform public.advertising_audit(
    'credit_granted', 'advertising_credit', v_id,
    jsonb_build_object('vendor_id', p_vendor_id, 'amount_minor', p_amount_minor,
                       'expires_at', p_expires_at));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Admin maintenance wrapper
-- ---------------------------------------------------------------------------

create or replace function public.advertising_admin_run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return public.advertising_run_maintenance();
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Function grants
--
-- Internal money/lifecycle functions are not callable from the browser.
-- Public delivery and tracking stay callable so the customer app works for
-- guests as well as signed-in users.
-- ---------------------------------------------------------------------------

revoke execute on function public.advertising_bump_stats(uuid, date, bigint, bigint, bigint, bigint) from public;
revoke execute on function public.advertising_release_inventory(uuid) from public;
revoke execute on function public.advertising_assign_inventory(uuid) from public;
revoke execute on function public.advertising_charge_campaign(uuid, bigint, text, text, jsonb) from public;
revoke execute on function public.advertising_capacity_available(uuid) from public;
revoke execute on function public.advertising_has_creative(uuid) from public;
revoke execute on function public.advertising_activation_ready(uuid) from public;
revoke execute on function public.advertising_campaign_is_eligible(uuid) from public;
revoke execute on function public.advertising_try_activate(uuid) from public;
revoke execute on function public.advertising_mark_paid(uuid, uuid) from public;
revoke execute on function public.advertising_audit(text, text, uuid, jsonb, jsonb, jsonb) from public;
revoke execute on function public.advertising_notify(text, uuid, uuid, text, text, text, jsonb) from public;
revoke execute on function public.advertising_run_maintenance() from public;
revoke execute on function public.advertising_copy_campaign(uuid, boolean) from public;
revoke execute on function public.advertising_validate_creative(jsonb, text) from public;

revoke execute on function public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb) from public;
revoke execute on function public.advertising_update_campaign(uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb) from public;
revoke execute on function public.advertising_duplicate_campaign(uuid) from public;
revoke execute on function public.advertising_renew_campaign(uuid) from public;
revoke execute on function public.advertising_pause_campaign(uuid, text) from public;
revoke execute on function public.advertising_resume_campaign(uuid) from public;
revoke execute on function public.advertising_submit_campaign(uuid) from public;
revoke execute on function public.advertising_pay_with_credit(uuid) from public;
revoke execute on function public.advertising_confirm_payment(uuid, text, text, bigint, jsonb) from public;
revoke execute on function public.advertising_review_campaign(uuid, boolean, text, jsonb) from public;
revoke execute on function public.advertising_admin_override(uuid, text, jsonb) from public;
revoke execute on function public.advertising_grant_credit(uuid, bigint, timestamptz, text) from public;
revoke execute on function public.advertising_admin_run_maintenance() from public;

grant execute on function public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb) to authenticated, service_role;
grant execute on function public.advertising_update_campaign(uuid, text, timestamptz, timestamptz, bigint, bigint, boolean, jsonb) to authenticated, service_role;
grant execute on function public.advertising_duplicate_campaign(uuid) to authenticated, service_role;
grant execute on function public.advertising_renew_campaign(uuid) to authenticated, service_role;
grant execute on function public.advertising_pause_campaign(uuid, text) to authenticated, service_role;
grant execute on function public.advertising_resume_campaign(uuid) to authenticated, service_role;
grant execute on function public.advertising_submit_campaign(uuid) to authenticated, service_role;
grant execute on function public.advertising_pay_with_credit(uuid) to authenticated, service_role;
grant execute on function public.advertising_confirm_payment(uuid, text, text, bigint, jsonb) to authenticated, service_role;
grant execute on function public.advertising_review_campaign(uuid, boolean, text, jsonb) to authenticated, service_role;
grant execute on function public.advertising_admin_override(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.advertising_grant_credit(uuid, bigint, timestamptz, text) to authenticated, service_role;
grant execute on function public.advertising_admin_run_maintenance() to authenticated, service_role;
grant execute on function public.advertising_record_audit(text, text, uuid, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.advertising_deliver(text, integer, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.advertising_track_click(uuid, text, text, text) to anon, authenticated, service_role;
grant execute on function public.advertising_track_conversion(uuid, uuid, uuid, uuid, bigint, text, text, jsonb) to authenticated, service_role;
grant execute on function public.advertising_rule_value(text) to anon, authenticated, service_role;
grant execute on function public.advertising_rule_bool(text, boolean) to anon, authenticated, service_role;
grant execute on function public.advertising_rule_int(text, integer) to anon, authenticated, service_role;
grant execute on function public.advertising_run_maintenance() to service_role;
grant execute on function public.advertising_charge_campaign(uuid, bigint, text, text, jsonb) to service_role;
grant execute on function public.advertising_mark_paid(uuid, uuid) to service_role;
grant execute on function public.advertising_try_activate(uuid) to service_role;
grant execute on function public.advertising_audit(text, text, uuid, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.advertising_notify(text, uuid, uuid, text, text, text, jsonb) to service_role;
