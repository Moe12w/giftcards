-- 0126_enterprise_product_images.sql
-- Enterprise products can carry their own image, like vendor gift cards.

alter table public.enterprise_products
  add column if not exists image_url text;
