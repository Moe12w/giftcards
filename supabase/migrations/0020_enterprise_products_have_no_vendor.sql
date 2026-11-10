-- 0020_enterprise_products_have_no_vendor.sql
-- Enterprise code products belong to a partner, not to a vendor, so the
-- catalogue row must be allowed to have no vendor. The 0011 check constraint
-- already encodes that rule; the column itself was still NOT NULL from the
-- original schema.

alter table public.products alter column vendor_id drop not null;

comment on column public.products.vendor_id is
  'The vendor that owns this product. Null for enterprise code products, which belong to a partner.';
