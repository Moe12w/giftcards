-- 0043_bulk_registration_approval_setting.sql
-- Lets the platform decide whether a new business account needs a human
-- approval before it can see bulk pricing.

create or replace function public.bulk_registration_requires_approval()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when jsonb_typeof(s.value) = 'boolean' then (s.value #>> '{}')::boolean
        else lower(coalesce(s.value #>> '{}', '')) = 'true'
      end
      from public.system_settings s
      where s.key = 'bulk_registration_requires_approval'
    ),
    true
  );
$$;

grant execute on function public.bulk_registration_requires_approval() to anon, authenticated;
