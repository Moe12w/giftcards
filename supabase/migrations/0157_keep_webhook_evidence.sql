-- 0157_keep_webhook_evidence.sql
-- webhook_events is the payment/refund webhook dedup store and the only durable
-- record of raw provider payloads. It is not disposable telemetry. Pruning it
-- after 30 days removes dedup keys and dispute evidence, so exclude it from the
-- retention cleanup entirely.

create or replace function public.app_retention_cleanup(
  p_dry_run boolean default true,
  p_max_rows_per_table integer default 5000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := current_setting('request.jwt.claim.role', true);
  v_now timestamptz := now();
  v_result jsonb := '{}'::jsonb;
  v_table text;
  v_col text;
  v_days integer;
  v_exists regclass;
  v_cutoff timestamptz;
  v_before bigint;
  v_deleted bigint;
begin
  if v_role is not null and v_role <> 'service_role' then
    raise exception 'retention cleanup is service-role only';
  end if;

  p_max_rows_per_table := least(greatest(coalesce(p_max_rows_per_table, 5000), 1), 20000);

  -- webhook_events intentionally excluded: payment/refund dedup + evidence.
  for v_table, v_col, v_days in
    select * from (values
      ('advertising_impressions', 'served_at',        30),
      ('advertising_clicks',      'clicked_at',       30),
      ('advertising_conversions', 'attributed_at',    90),
      ('auth_attempts',           'created_at',       30),
      ('claim_attempts',          'created_at',       30),
      ('notifications',           'created_at',       90),
      ('enterprise_code_events',  'created_at',      180)
    ) as t(tbl, col, days)
  loop
    v_exists := to_regclass('public.' || v_table);
    if v_exists is null then
      v_result := v_result || jsonb_build_object(v_table, jsonb_build_object('status', 'missing'));
      continue;
    end if;

    v_cutoff := v_now - (v_days || ' days')::interval;

    execute format('select count(*) from public.%I where %I < $1', v_table, v_col)
      into v_before using v_cutoff;

    if p_dry_run then
      v_result := v_result || jsonb_build_object(v_table, jsonb_build_object(
        'status', 'dry_run',
        'retention_days', v_days,
        'cutoff', v_cutoff,
        'eligible', v_before
      ));
    else
      execute format(
        'delete from public.%I where ctid in (' ||
          'select ctid from public.%I where %I < $1 order by %I asc limit $2' ||
        ')',
        v_table, v_table, v_col, v_col
      ) using v_cutoff, p_max_rows_per_table;
      get diagnostics v_deleted = row_count;
      v_result := v_result || jsonb_build_object(v_table, jsonb_build_object(
        'status', 'deleted',
        'retention_days', v_days,
        'cutoff', v_cutoff,
        'eligible_before', v_before,
        'deleted', v_deleted
      ));
    end if;
  end loop;

  v_result := v_result || jsonb_build_object(
    'dry_run', p_dry_run,
    'max_rows_per_table', p_max_rows_per_table
  );
  return v_result;
end;
$$;

revoke all on function public.app_retention_cleanup(boolean, integer) from public, anon, authenticated;
grant execute on function public.app_retention_cleanup(boolean, integer) to service_role;
