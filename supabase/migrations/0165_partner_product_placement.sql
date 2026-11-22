-- 0165_partner_product_placement.sql
-- Partner products are merchandise like vendor products: they belong in a
-- category and in one or more collections. The only difference is that the
-- codes are supplied by the partner instead of issued by Giftly.
--
-- The marketplace catalogue (public.products) already carried these fields,
-- but the partner's own record could not, so saveEnterpriseProduct() had to
-- hard-code null/empty values on every sync. These columns make the partner
-- form the source of truth for placement.

alter table public.enterprise_products
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists occasions text[] not null default '{}';

create index if not exists enterprise_products_category_idx
  on public.enterprise_products (category_id)
  where category_id is not null;

comment on column public.enterprise_products.occasions is
  'Collection slugs where this partner gift appears in the marketplace.';
