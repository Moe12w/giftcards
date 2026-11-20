-- 0149_myfatoorah_sync_statuses_batch.sql
-- One RPC for a whole GetSuppliers response instead of one HTTP round-trip per
-- supplier. Each row is still validated by the existing vendor/partner sync
-- functions, so authorisation and status rules are unchanged.
create or replace function public.myfatoorah_sync_statuses(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_synced integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    begin
      if item->>'owner_type' = 'vendor' then
        perform public.myfatoorah_supplier_synced(
          (item->>'owner_id')::uuid,
          item->>'status',
          nullif(item->>'comment', ''),
          nullif(item->>'deposit_terms', ''),
          (item->>'commission_percentage')::numeric,
          (item->>'commission_value')::numeric,
          item->'raw'
        );
      elsif item->>'owner_type' = 'partner' then
        perform public.myfatoorah_partner_synced(
          (item->>'owner_id')::uuid,
          item->>'status',
          nullif(item->>'comment', ''),
          nullif(item->>'deposit_terms', ''),
          (item->>'commission_percentage')::numeric,
          (item->>'commission_value')::numeric,
          item->'raw'
        );
      else
        raise exception 'invalid_owner_type';
      end if;
      v_synced := v_synced + 1;
    exception when others then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'owner_id', item->>'owner_id',
        'error', left(sqlerrm, 300)
      ));
    end;
  end loop;

  return jsonb_build_object('synced', v_synced, 'errors', v_errors);
end;
$$;

revoke all on function public.myfatoorah_sync_statuses(jsonb) from public, anon, authenticated;
grant execute on function public.myfatoorah_sync_statuses(jsonb) to service_role;
