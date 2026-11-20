-- 0151_retention_cleanup.sql
-- Bounded, service-role-only cleanup of high-growth telemetry/event tables.
--
-- The free tier gets 500 MB of database. Append-only event tables grow with
-- traffic regardless of how efficient the queries are, so they need a retention
-- policy. This RPC deletes at most p_max_rows_per_table rows per table per run
-- (oldest first) so one scheduled call cannot hammer the shared DB.
--
-- Safety rules:
--   * Money/ledger tables, orders, vouchers, redemptions and audit_log are NOT
--     in the list below and are never pruned.
--   * Dry-run by default. Call with p_dry_run => false from the daily cron.
--   * Only the service role (or a direct trusted DB connection, e.g. psql)
--     may execute it; anon/authenticated keys are rejected.
--
-- Dry run:
--   select jsonb_pretty(public.app_retention_cleanup(true, 5000));
-- Live (one bounded batch per table):
--   select jsonb_pretty(public.app_retention_cleanup(false, 5000));

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
  -- anon/authenticated PostgREST keys carry a role claim and are rejected.
  -- A direct psql connection has no claim and is already trusted with the DB.
  if v_role is not null and v_role <> 'service_role' then
    raise exception 'retention cleanup is service-role only';
  end if;

  -- Bound the batch so a single run cannot stall the shared free-tier DB.
  p_max_rows_per_table := least(greatest(coalesce(p_max_rows_per_table, 5000), 1), 20000);

  -- (table, timestamp column, retention window in days)
  -- Only non-financial, non-audit event/telemetry tables belong here.
  for v_table, v_col, v_days in
    select * from (values
      ('advertising_impressions', 'served_at',        30),
      ('advertising_clicks',      'clicked_at',       30),
      ('advertising_conversions', 'attributed_at',    90),
      ('webhook_events',          'created_at',       30),
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
      -- ctid keeps the batch generic across uuid/bigint primary keys and lets
      -- us delete the oldest rows first without knowing each table's key type.
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

-- Execute is granted to PUBLIC by default; take it back and give it only to
-- the service role used by the scheduled job.
revoke all on function public.app_retention_cleanup(boolean, integer) from public, anon, authenticated;
grant execute on function public.app_retention_cleanup(boolean, integer) to service_role;

-- Supporting indexes so the "oldest rows" scan stays cheap as tables grow.
create index if not exists advertising_impressions_served_at_idx
  on public.advertising_impressions (served_at);
create index if not exists advertising_clicks_clicked_at_idx
  on public.advertising_clicks (clicked_at);
create index if not exists advertising_conversions_attributed_at_idx
  on public.advertising_conversions (attributed_at);
create index if not exists webhook_events_created_at_idx
  on public.webhook_events (created_at);
create index if not exists claim_attempts_created_at_idx
  on public.claim_attempts (created_at);
create index if not exists notifications_created_at_idx
  on public.notifications (created_at);
create index if not exists enterprise_code_events_created_at_idx
  on public.enterprise_code_events (created_at);
