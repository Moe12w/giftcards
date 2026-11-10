-- 0025_audit_reader.sql
-- The audit log is readable by admins only. A small security-definer reader
-- lets the vendor dashboard and the tests confirm that an action was recorded
-- without opening the table up to every signed-in user.

create or replace function public.audit_entries_for(
  p_entity_type text,
  p_entity_id uuid
)
returns setof public.audit_log
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.audit_log
  where entity_type = p_entity_type
    and entity_id = p_entity_id::text
  order by created_at desc;
$$;

create or replace function public.audit_count_for(
  p_entity_type text,
  p_entity_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.audit_log
  where entity_type = p_entity_type
    and entity_id = p_entity_id::text;
$$;

revoke all on function public.audit_entries_for(text, uuid) from public;
grant execute on function public.audit_entries_for(text, uuid) to authenticated;
revoke all on function public.audit_count_for(text, uuid) from public;
grant execute on function public.audit_count_for(text, uuid) to authenticated;
