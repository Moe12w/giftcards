-- 0107_mcp_rate_limits.sql
-- Durable rate limiting for the public MCP endpoint.
--
-- Edge Functions run in short-lived isolates, so an in-memory counter alone
-- cannot stop a caller from spreading requests across instances. This table
-- gives every isolate one shared counter. Rows are tiny and are reused per
-- bucket (IP + tool), so the table stays small.
--
-- Only the service role touches this table. The MCP function calls the
-- security-definer helper below; no customer-facing policy is needed.

create table if not exists public.mcp_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0)
);

create index if not exists mcp_rate_limits_window_idx
  on public.mcp_rate_limits (window_started_at);

alter table public.mcp_rate_limits enable row level security;

revoke all on public.mcp_rate_limits from anon, authenticated, public;
grant all on public.mcp_rate_limits to service_role;

-- Returns true when the caller is still inside its allowance. The upsert
-- locks the bucket row, so concurrent requests cannot both read the old count
-- and overwrite each other.
create or replace function public.mcp_take_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_hits integer;
begin
  if p_bucket is null
     or length(p_bucket) = 0
     or p_limit is null
     or p_limit <= 0
     or p_window_seconds is null
     or p_window_seconds <= 0 then
    return false;
  end if;

  insert into public.mcp_rate_limits (bucket, window_started_at, hits)
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update
    set hits = case
          when public.mcp_rate_limits.window_started_at
               <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.mcp_rate_limits.hits + 1
        end,
        window_started_at = case
          when public.mcp_rate_limits.window_started_at
               <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.mcp_rate_limits.window_started_at
        end
  returning hits into v_hits;

  -- Occasionally clear buckets that have been idle for a day. Doing it here
  -- avoids a separate cron job for a table that should stay tiny.
  if random() < 0.02 then
    delete from public.mcp_rate_limits
    where window_started_at < v_now - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.mcp_take_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.mcp_take_rate_limit(text, integer, integer)
  to service_role;

comment on table public.mcp_rate_limits is
  'Shared request counters for the public Giftly MCP Edge Function.';
comment on function public.mcp_take_rate_limit(text, integer, integer) is
  'Atomically counts a request in a fixed window and returns whether it is allowed.';
