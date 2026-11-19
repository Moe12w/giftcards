-- Demo data completion pass.
-- Gift cards use the business logo instead of their own artwork; every ad and
-- every business has complete imagery and display copy. Safe to re-run.

begin;

-- Gift cards no longer carry their own image — the app shows the logo.
update public.products
set image_url = null
where image_url is not null;

update public.enterprise_products
set image_url = null
where image_url is not null;

-- Every ad creative gets wide and mobile artwork plus complete copy.
update public.advertising_creatives
set
  image_url = coalesce(
    nullif(btrim(image_url), ''),
    'https://picsum.photos/seed/ad-' || replace(id::text, '-', '') || '/1200/600'
  ),
  mobile_image_url = coalesce(
    nullif(btrim(mobile_image_url), ''),
    'https://picsum.photos/seed/ad-' || replace(id::text, '-', '') || '/800/800'
  ),
  image_alt = coalesce(nullif(btrim(image_alt), ''), headline, 'Sponsored gift'),
  body = coalesce(
    nullif(btrim(body), ''),
    'A little something for every occasion. Delivered instantly as a gift card.'
  )
where image_url is null or btrim(image_url) = ''
   or mobile_image_url is null or btrim(mobile_image_url) = ''
   or image_alt is null or btrim(image_alt) = ''
   or body is null or btrim(body) = '';

-- Businesses: banner artwork also becomes the cover, plus sensible demo copy.
update public.vendors
set cover_url = banner_url
where (cover_url is null or btrim(cover_url) = '') and banner_url is not null;

update public.vendors
set description = name || ' — a Giftly partner in Qatar.'
where description is null or btrim(description) = '';

update public.vendors
set category_id = (select id from public.categories where slug = case slug
  when 'azure-spa' then 'wellness'
  when 'dune-spa' then 'wellness'
  when 'bloom-beauty' then 'beauty'
  when 'thread-and-co' then 'beauty'
  when 'cinema-nova' then 'entertainment'
  when 'desert-adventures' then 'experiences'
  when 'peak-fitness' then 'fitness'
  when 'pearl-hotel' then 'experiences'
  when 'adv_retailplusrewards' then 'shopping'
  when 'souq-kitchen' then 'dining'
  when 'sweet-avenue' then 'desserts'
  when 'the-book-nook' then 'shopping'
  else 'shopping'
end)
where category_id is null;

update public.vendors
set phone = '+974 4' || substr(replace(id::text, '-', ''), 1, 3) || ' ' || substr(replace(id::text, '-', ''), 4, 4)
where phone is null or btrim(phone) = '';

update public.vendors
set email = 'hello@' || coalesce(nullif(slug, ''), replace(lower(name), ' ', '-')) || '.qa'
where email is null or btrim(email) = '';

update public.enterprise_partners
set website = coalesce(nullif(btrim(website), ''), 'https://giftly.qa/partners/' || slug)
where website is null or btrim(website) = '';

-- Products: description and category always present.
update public.products
set description = 'A Giftly gift card — ' || title
where description is null or btrim(description) = '';

update public.products
set category_id = (select id from public.categories where slug = 'shopping')
where category_id is null;

commit;
