-- 0125_remove_dead_features.sql
--
-- Removes objects that are confirmed to have no callers after the team-access
-- and direct-account creation changes. Historical migrations are left intact.

drop function if exists public.create_vendor_invite(uuid, text, public.vendor_member_role);
drop function if exists public.accept_vendor_invite(text);
drop function if exists public.register_vendor_account(text, text, text, text, text, text, text);
drop function if exists public.audit_entries_for(text, uuid);
drop function if exists public.audit_count_for(text, uuid);
drop function if exists public.create_enterprise_api_key(uuid, text);
drop function if exists public.revoke_enterprise_api_key(uuid);
drop function if exists public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, integer, jsonb);
drop function if exists public.advertising_create_campaign(uuid, text, uuid, text, timestamptz, timestamptz, bigint, bigint, integer, jsonb, integer);
drop function if exists public.advertising_submit_campaign(uuid);
drop function if exists public.fulfill_order(text, text, text);
drop table if exists public.vendor_invites;
