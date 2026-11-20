-- 0139_myfatoorah_file_types.sql
-- Align our internal document types with MyFatoorah's documented FileType enum.
--   4  = Signature Authorization (establishment card)
--   16 = Civil Ids Of All Owners
--   17 = Civil Id Of Manager
--   26 = 3-parties contract/ agreement (the signed payment agreement)
create or replace function public.myfatoorah_file_type(p_doc_type text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_doc_type
    when 'owner_id_front' then 16
    when 'owner_id_back' then 16
    when 'commercial_license' then 2
    when 'establishment_card' then 4
    when 'logo' then 5
    when 'manager_civil_id_back' then 17
    when 'manager_civil_id_front' then 17
    when 'commercial_register' then 20
    when 'bank_account_letter' then 21
    when 'website_screenshot' then 25
    when 'three_parties_contract' then 26
    else 5
  end;
$$;

revoke all on function public.myfatoorah_file_type(text) from public, anon;
grant execute on function public.myfatoorah_file_type(text) to authenticated;
