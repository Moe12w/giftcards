-- 0173_basket_claim_preview.sql
-- Read-only preview of a basket behind a claim token, mirroring claim_preview.
-- Returns the basket's name, recipient, cover, items and a few metadata fields
-- so the claim screen can show what the recipient is about to receive.

create or replace function public.basket_claim_preview(p_token text, p_source text default null)
returns table (
  basket_id uuid,
  name text,
  recipient_name text,
  occasion text,
  cover_id text,
  creator_name text,
  note text,
  item_count integer,
  total_minor bigint,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  return query
  select
    b.id,
    b.name,
    b.recipient_name,
    b.occasion,
    b.cover_id,
    b.creator_name,
    b.note,
    (select count(*)::integer from public.gift_basket_items i where i.basket_id = b.id),
    coalesce((select sum(i.amount_minor) from public.gift_basket_items i where i.basket_id = b.id), 0::bigint),
    b.status::text
  from public.gift_baskets b
  where b.claim_token_hash = v_hash;
end;
$$;

revoke all on function public.basket_claim_preview(text, text) from public;
grant execute on function public.basket_claim_preview(text, text) to service_role;