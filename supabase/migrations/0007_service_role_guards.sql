-- 0007_service_role_guards.sql
-- Allow the service role (Edge Functions) to perform trusted writes that the
-- admin-only triggers would otherwise block. Regular users still cannot.

create or replace function public.guard_vendor_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;

  if (new.status is distinct from old.status
      or new.commission_bps is distinct from old.commission_bps
      or new.max_unredeemed_minor is distinct from old.max_unredeemed_minor) then
    if not public.is_admin() then
      raise exception 'only admins may change vendor status, commission, or exposure limit';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_profile_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    raise exception 'only admins may change admin role';
  end if;
  return new;
end;
$$;
