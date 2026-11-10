-- supabase/seed.sql
-- Demo data for the whole marketplace: catalogue, vendors, customers,
-- vouchers, redemptions, an enterprise partner and its code inventory.
--
-- Generated from the mobile app catalogue so both stay in sync.
-- Safe to run more than once: every insert is keyed and idempotent.

begin;

-- Clear the demo rows before inserting them again.
alter table public.ledger_entries disable trigger ledger_no_update;
alter table public.audit_log disable trigger audit_no_update;
delete from public.ledger_entries;
delete from public.audit_log;
delete from public.redemption_items;
delete from public.redemptions;
delete from public.vouchers;
delete from public.order_items;
delete from public.orders;
delete from public.product_media;
delete from public.product_variants;
delete from public.products;
delete from public.vendor_locations;
delete from public.vendor_applications;
delete from public.vendor_members;
delete from public.vendors;
delete from public.categories;
delete from public.enterprise_code_events;
delete from public.enterprise_code_inventory;
delete from public.enterprise_import_batches;
delete from public.enterprise_products;
delete from public.enterprise_members;
delete from public.enterprise_partners;
delete from public.favourites;
delete from public.recipients;
delete from public.campaign_placements;
delete from public.campaigns;
delete from public.banners;
alter table public.ledger_entries enable trigger ledger_no_update;
alter table public.audit_log enable trigger audit_no_update;

-- ---------------------------------------------------------------------
-- Test accounts (password for all of them: GiftlyTest123)
-- ---------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'customer@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Demo Customer"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'owner@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Vendor Owner"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'manager@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Vendor Manager"}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', 'staff@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Redemption Staff"}'::jsonb),
  ('55555555-5555-4555-8555-555555555555', 'partner@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Enterprise Partner"}'::jsonb),
  ('66666666-6666-4666-8666-666666666666', 'admin@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Platform Admin"}'::jsonb),
  ('72215636-34c1-4635-9479-dba62aa65c56', 'layla@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Layla"}'::jsonb),
  ('131437af-94dd-46ed-b3dd-8576e10ceaba', 'omar@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Omar"}'::jsonb),
  ('29eb9902-b88e-4490-8785-737206825852', 'noor@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Noor"}'::jsonb),
  ('77a7a268-c84b-42ac-a7db-e25fe395b6fe', 'sara@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Sara"}'::jsonb),
  ('cdca534d-1d61-46ef-a179-13588d899a74', 'mariam@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Mariam"}'::jsonb),
  ('83924abf-bf07-4e7b-8d09-9313fbbba40f', 'faris@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Faris"}'::jsonb),
  ('c20aca36-9957-41f4-9b53-9c2a415178b4', 'hind@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Hind"}'::jsonb),
  ('ff2c387d-ec50-4a87-bd8c-dd8b2e277828', 'aisha@giftly.test', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"Aisha"}'::jsonb)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), id, id::text, jsonb_build_object('sub', id, 'email', email), 'email', now(), now(), now()
from auth.users
where email in ('customer@giftly.test', 'owner@giftly.test', 'manager@giftly.test', 'staff@giftly.test', 'partner@giftly.test', 'admin@giftly.test', 'layla@giftly.test', 'omar@giftly.test', 'noor@giftly.test', 'sara@giftly.test', 'mariam@giftly.test', 'faris@giftly.test', 'hind@giftly.test', 'aisha@giftly.test')
on conflict do nothing;

insert into public.profiles (id, full_name, email, preferred_language)
select id, raw_user_meta_data ->> 'full_name', email, 'en' from auth.users
where email in ('customer@giftly.test', 'owner@giftly.test', 'manager@giftly.test', 'staff@giftly.test', 'partner@giftly.test', 'admin@giftly.test', 'layla@giftly.test', 'omar@giftly.test', 'noor@giftly.test', 'sara@giftly.test', 'mariam@giftly.test', 'faris@giftly.test', 'hind@giftly.test', 'aisha@giftly.test')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role) values
  ('66666666-6666-4666-8666-666666666666', 'admin'),
  ('55555555-5555-4555-8555-555555555555', 'enterprise_user'),
  ('11111111-1111-4111-8111-111111111111', 'customer')
on conflict (user_id) do update set role = excluded.role;

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------
insert into public.categories (id, slug, name, name_ar, icon, sort_order) values
  ('42280d18-ab46-4209-9d2b-e4f3b2ea054f', 'coffee', 'Coffee', 'قهوة', 'coffee', 1),
  ('56fbcea3-b02c-4322-9aca-c63010156a66', 'dining', 'Dining', 'مطاعم', 'dining', 2),
  ('c5f10f32-ef04-4930-9336-ea659f0581dc', 'desserts', 'Desserts', 'حلويات', 'dessert', 3),
  ('0a017db6-a633-4b21-b870-f4286da3793d', 'wellness', 'Wellness', 'عافية', 'wellness', 4),
  ('7e48017f-3145-46b5-9c70-b4a5973f9d85', 'shopping', 'Shopping', 'تسوق', 'shopping', 5),
  ('857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experiences', 'Experiences', 'تجارب', 'experiences', 6),
  ('7657fe8a-c670-4ca4-bb78-20b499b645b5', 'beauty', 'Beauty', 'جمال', 'beauty', 7),
  ('8ea15bb8-35ef-4fda-be7e-2b1a4f97a83e', 'fitness', 'Fitness', 'لياقة', 'fitness', 8),
  ('3f629d4c-b477-4ea8-bdc0-ef01cd381121', 'entertainment', 'Entertainment', 'ترفيه', 'entertainment', 9);

-- ---------------------------------------------------------------------
-- Vendors
-- ---------------------------------------------------------------------
insert into public.vendors (id, owner_id, name, name_ar, slug, description, logo_url, banner_url, status, commission_bps, rating, city, approved_at, created_at) values
  ('58852d5f-8486-42fa-a423-b199925159b0', '22222222-2222-4222-8222-222222222222', 'The Coffee House', 'بيت القهوة', 'the-coffee-house', 'A gift card for specialty coffee, fresh pastries, and a calm corner to slow down.', 'https://placehold.co/200x200/png?text=CH', 'https://placehold.co/900x300/png?text=The+Coffee+House', 'approved', 1000, 4.8, 'West Bay', now(), now()),
  ('2533ec89-f5b1-4409-9273-c87bf133d095', '22222222-2222-4222-8222-222222222222', 'Dune Spa', 'منتجع ديون', 'dune-spa', 'Treat someone to a massage, facial, or a full afternoon of quiet luxury.', 'https://placehold.co/200x200/png?text=DS', 'https://placehold.co/900x300/png?text=Dune+Spa', 'approved', 1000, 4.9, 'The Pearl', now(), now()),
  ('a010f419-3183-4fb5-bd38-e73ba7f51317', '22222222-2222-4222-8222-222222222222', 'Souq Kitchen', 'مطبخ السوق', 'souq-kitchen', 'Homemade Qatari dishes, mezze, and desserts for sharing with family.', 'https://placehold.co/200x200/png?text=SK', 'https://placehold.co/900x300/png?text=Souq+Kitchen', 'approved', 1000, 4.8, 'Souq Waqif', now(), now()),
  ('b11ee824-7866-4b02-abcd-08bc5e077018', '22222222-2222-4222-8222-222222222222', 'Bloom Beauty', 'بلوم بيوتي', 'bloom-beauty', 'Manicures, blowouts and a little pampering for someone who deserves it.', 'https://placehold.co/200x200/png?text=BB', 'https://placehold.co/900x300/png?text=Bloom+Beauty', 'approved', 1000, 4.9, 'Al Sadd', now(), now()),
  ('94666bd9-01bd-41d7-99c5-30cedea926b8', '22222222-2222-4222-8222-222222222222', 'Peak Fitness', 'بيك فيتنس', 'peak-fitness', 'A month of classes, personal training or a well-earned recovery session.', 'https://placehold.co/200x200/png?text=PF', 'https://placehold.co/900x300/png?text=Peak+Fitness', 'approved', 1000, 4.7, 'Lusail', now(), now()),
  ('128ee37e-7489-47ae-95e8-6011db656ee2', '22222222-2222-4222-8222-222222222222', 'Cinema Nova', 'سينما نوفا', 'cinema-nova', 'Tickets, popcorn and a big-screen night out for two.', 'https://placehold.co/200x200/png?text=CN', 'https://placehold.co/900x300/png?text=CinemaNova', 'approved', 1000, 4.6, 'Msheireb', now(), now()),
  ('32e841cf-effd-4eec-86ae-21c1dd586d3d', '22222222-2222-4222-8222-222222222222', 'The Book Nook', 'ركن الكتاب', 'the-book-nook', 'A cosy independent bookshop with new releases, stationery and coffee.', 'https://placehold.co/200x200/png?text=BN', 'https://placehold.co/900x300/png?text=The+Book+Nook', 'approved', 1000, 4.8, 'Al Waab', now(), now()),
  ('70456ad2-cdab-47e2-a21c-02048addfc38', '22222222-2222-4222-8222-222222222222', 'Desert Adventures', 'مغامرات الصحراء', 'desert-adventures', 'Dune drives, camel rides and sunset dinners under the stars.', 'https://placehold.co/200x200/png?text=DA', 'https://placehold.co/900x300/png?text=Desert+Adventures', 'approved', 1000, 4.9, 'Sealine', now(), now()),
  ('c1b1dbb8-0f25-4708-8065-00a2cbf3d36e', '22222222-2222-4222-8222-222222222222', 'Azure Spa', 'أزور سبا', 'azure-spa', 'A full wellness escape in one voucher: hammam, deep-tissue massage and ritual facial. The gift giver redeems it however they like.', 'https://placehold.co/200x200/png?text=AS', 'https://placehold.co/900x300/png?text=Azure+Spa', 'approved', 1000, 4.9, 'West Bay', now(), now()),
  ('66d93941-ca8d-45f2-8af4-eea9c97d6c05', '22222222-2222-4222-8222-222222222222', 'Pearl Hotel', 'فندق البور', 'pearl-hotel', 'One night at the Pearl Hotel with sea-view room and breakfast for two. A once-in-a-lifetime experience gift.', 'https://placehold.co/200x200/png?text=PH', 'https://placehold.co/900x300/png?text=Pearl+Hotel', 'approved', 1000, 4.9, 'The Pearl', now(), now()),
  ('f314429d-12c0-4e3a-8530-ce8a926bdbad', '22222222-2222-4222-8222-222222222222', 'Sweet Avenue', 'سويت أفينيو', 'sweet-avenue', 'Cakes, macarons and celebration boxes made fresh every morning. Perfect for birthdays and thank-yous.', 'https://placehold.co/200x200/png?text=SA', 'https://placehold.co/900x300/png?text=Sweet+Avenue', 'approved', 1000, 4.9, 'Msheireb', now(), now()),
  ('6e1c69d0-03ed-4901-9e43-e791b30b9d11', '22222222-2222-4222-8222-222222222222', 'Thread & Co.', 'ثريد آند كو', 'thread-and-co', 'Contemporary fashion, accessories and timeless pieces from local and regional designers.', 'https://placehold.co/200x200/png?text=TC', 'https://placehold.co/900x300/png?text=Thread+%26+Co.', 'approved', 1000, 4.8, 'Msheireb', now(), now());

insert into public.vendor_members (vendor_id, user_id, role, permissions) values
  ('58852d5f-8486-42fa-a423-b199925159b0', '22222222-2222-4222-8222-222222222222', 'owner', '{"all":true}'::jsonb),
  ('58852d5f-8486-42fa-a423-b199925159b0', '33333333-3333-4333-8333-333333333333', 'manager', '{"products":true,"redeem":true,"staff":true}'::jsonb),
  ('58852d5f-8486-42fa-a423-b199925159b0', '44444444-4444-4444-8444-444444444444', 'redemption_staff', '{"redeem":true}'::jsonb),
  ('2533ec89-f5b1-4409-9273-c87bf133d095', '22222222-2222-4222-8222-222222222222', 'owner', '{"all":true}'::jsonb)
on conflict (vendor_id, user_id) do update set role = excluded.role, permissions = excluded.permissions;

insert into public.vendor_locations (id, vendor_id, area, address, hours) values
  ('f966ee39-b3e8-4f7c-807c-d740135e8e29', '58852d5f-8486-42fa-a423-b199925159b0', 'West Bay', 'Al Corniche Street, West Bay, Doha', '7:00 – 23:00'),
  ('c30bd5f6-2be7-49da-a679-8e64accd868c', '58852d5f-8486-42fa-a423-b199925159b0', 'The Pearl', 'Porto Arabia Drive, The Pearl, Doha', '8:00 – 23:00'),
  ('f8a6c2db-468b-470e-8694-7e4e8beb00bc', '2533ec89-f5b1-4409-9273-c87bf133d095', 'The Pearl', 'La Croisette, The Pearl, Doha', '10:00 – 22:00'),
  ('f236ad0a-245f-443d-890a-e258dbeb7e25', 'a010f419-3183-4fb5-bd38-e73ba7f51317', 'Souq Waqif', 'Souq Waqif, Doha', '12:00 – 00:00'),
  ('6e10cd2e-79a9-4693-8317-a2cbe7e06be3', 'c1b1dbb8-0f25-4708-8065-00a2cbf3d36e', 'West Bay', 'Azure Tower, West Bay, Doha', '10:00 – 22:00'),
  ('e7fa972c-0b33-4d12-8e6a-a34e839c45fc', '66d93941-ca8d-45f2-8af4-eea9c97d6c05', 'The Pearl', 'Pearl Marina, The Pearl, Doha', '24 hours'),
  ('0ff6f87a-f540-44d6-85c8-c7ae382cb72e', 'f314429d-12c0-4e3a-8530-ce8a926bdbad', 'Msheireb', 'Msheireb Downtown, Doha', '8:00 – 22:00'),
  ('2f4b439f-9cf4-483b-aa84-182df4f9db4e', '6e1c69d0-03ed-4901-9e43-e791b30b9d11', 'Msheireb', 'Galleria Mall, Msheireb, Doha', '10:00 – 22:00');

insert into public.vendor_applications (vendor_id, status, step, business_name, business_category, business_description, business_email, business_phone, business_location, submitted_at) values
  ('58852d5f-8486-42fa-a423-b199925159b0', 'approved', 'review', 'The Coffee House', 'coffee', 'A speciality coffee bar in West Bay.', 'owner@giftly.test', '+974 5555 0101', 'West Bay, Doha', now()),
  ('94666bd9-01bd-41d7-99c5-30cedea926b8', 'pending_review', 'review', 'Peak Fitness', 'fitness', 'Personal training and group classes in Lusail.', 'owner@giftly.test', '+974 5555 0101', 'Lusail, Doha', now())
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Products: the shared catalogue for all three fulfilment types
-- ---------------------------------------------------------------------
insert into public.products (
  id, vendor_id, category_id, fulfilment_type, title, title_ar, slug, description,
  terms_and_conditions, redemption_instructions, booking_required,
  split_session_allowed, multi_session_per_visit, session_count,
  min_amount_minor, max_amount_minor, preset_amounts_minor, currency, expiry_days,
  valid_until, is_active, status, icon, tone, rating, location, occasions, created_at
) values
  ('b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f', '58852d5f-8486-42fa-a423-b199925159b0', '42280d18-ab46-4209-9d2b-e4f3b2ea054f', 'monetary', 'The Coffee House', 'بيت القهوة', 'the-coffee-house-1', 'A gift card for specialty coffee, fresh pastries, and a calm corner to slow down.', 'Valid for 365 days from issue. Redeem at any The Coffee House location.', 'Show the QR code at the counter. One The Coffee House visit per redemption.', false, true, true, null, 2500, 50000, '{2500,5000,10000,20000}', 'QAR', 365, '2027-11-10T18:09:09.192Z', true, 'published', 'coffee', 'gold', 4.8, 'West Bay', '{just-because,thank-you,birthday}', '2026-10-11T18:09:09.192Z'),
  ('c492cf10-a6fa-47a3-8bf6-f728303fc386', '58852d5f-8486-42fa-a423-b199925159b0', '42280d18-ab46-4209-9d2b-e4f3b2ea054f', 'monetary', 'Espresso Club Card', 'بطاقة نادي الاسبريسو', 'espresso-club-card-13', 'A double-shot card for the regulars: espresso, macchiato and a pastry on the house.', 'Valid for 300 days from issue. Redeem at any The Coffee House location.', 'Show the QR code at the counter. One The Coffee House visit per redemption.', false, true, true, null, 2500, 30000, '{2500,5000,7500,15000}', 'QAR', 365, '2027-09-06T18:09:09.192Z', true, 'published', 'espresso', 'gold', 4.7, 'West Bay', '{just-because,thank-you}', '2026-10-23T18:09:09.192Z'),
  ('0fd29e1d-4794-489d-bceb-b42b52316979', '58852d5f-8486-42fa-a423-b199925159b0', '42280d18-ab46-4209-9d2b-e4f3b2ea054f', 'monetary', 'Morning Pastry Box', 'علبة المخبوزات الصباحية', 'morning-pastry-box-14', 'A box of croissants, danishes and warm bread for slow weekend mornings.', 'Valid for 120 days from issue. Redeem at any The Coffee House location.', 'Show the QR code at the counter. One The Coffee House visit per redemption.', false, true, true, null, 5000, 25000, '{5000,10000,15000,25000}', 'QAR', 365, '2027-03-10T18:09:09.192Z', true, 'published', 'pastry', 'gold', 4.6, 'The Pearl', '{birthday,just-because}', '2026-10-29T18:09:09.192Z'),
  ('8fe6ca73-c614-441c-b274-3b3ea82f47f7', '58852d5f-8486-42fa-a423-b199925159b0', 'c5f10f32-ef04-4930-9336-ea659f0581dc', 'monetary', 'Sweet Treats Card', 'بطاقة الحلويات', 'sweet-treats-card-15', 'Cookies, brownies and iced buns, boxed up to share or to keep.', 'Valid for 200 days from issue. Redeem at any The Coffee House location.', 'Show the QR code at the counter. One The Coffee House visit per redemption.', false, true, true, null, 2500, 20000, '{2500,5000,10000,20000}', 'QAR', 365, '2027-05-29T18:09:09.192Z', true, 'published', 'cookie', 'gold', 4.5, 'West Bay', '{thank-you,just-because,congratulations}', '2026-11-01T18:09:09.192Z'),
  ('e686e08e-a042-49ba-92ee-3f534a0a8033', '2533ec89-f5b1-4409-9273-c87bf133d095', '0a017db6-a633-4b21-b870-f4286da3793d', 'experience', 'Dune Spa', 'منتجع ديون', 'dune-spa-2', 'Treat someone to a massage, facial, or a full afternoon of quiet luxury.', 'Valid for 180 days from issue. Redeem at any Dune Spa location.', 'Show the QR code at the counter. One Dune Spa visit per redemption.', true, true, true, 1, 10000, 100000, '{10000,25000,50000,100000}', 'QAR', 365, '2027-05-09T18:09:09.192Z', true, 'published', 'spa', 'teal', 4.9, 'The Pearl', '{birthday,anniversary,thank-you}', '2026-10-27T18:09:09.192Z'),
  ('0d6a07fa-8673-4cea-9979-d446e4263b6b', '2533ec89-f5b1-4409-9273-c87bf133d095', '0a017db6-a633-4b21-b870-f4286da3793d', 'experience', 'Deep Tissue Massage', 'جلسة تدليك عميق', 'deep-tissue-massage-16', 'A focused 60 minute session for shoulders, back and feet.', 'Valid for 150 days from issue. Redeem at any Dune Spa location.', 'Show the QR code at the counter. One Dune Spa visit per redemption.', true, true, true, 1, 15000, 60000, '{15000,25000,40000,60000}', 'QAR', 365, '2027-04-09T18:09:09.192Z', true, 'published', 'massage', 'teal', 4.8, 'The Pearl', '{thank-you,birthday,just-because}', '2026-10-30T18:09:09.192Z'),
  ('3fc2ae1a-92d7-4b3d-bab0-28bab9e46a55', '2533ec89-f5b1-4409-9273-c87bf133d095', '0a017db6-a633-4b21-b870-f4286da3793d', 'experience', 'Hammam Ritual', 'طقس الحمام', 'hammam-ritual-17', 'Traditional hammam, body scrub and mint tea in one calm hour.', 'Valid for 200 days from issue. Redeem at any Dune Spa location.', 'Show the QR code at the counter. One Dune Spa visit per redemption.', true, true, true, 1, 20000, 70000, '{20000,35000,50000,70000}', 'QAR', 365, '2027-05-29T18:09:09.192Z', true, 'published', 'hammam', 'teal', 4.8, 'West Bay', '{anniversary,thank-you}', '2026-11-02T18:09:09.192Z'),
  ('6f73e6cd-caa0-404f-b909-713a18114e6e', '2533ec89-f5b1-4409-9273-c87bf133d095', '0a017db6-a633-4b21-b870-f4286da3793d', 'experience', 'Couples Wellness Day', 'يوم Wellness للزوجين', 'couples-wellness-day-18', 'Two massages, a shared lounge session and afternoon tea.', 'Valid for 240 days from issue. Redeem at any Dune Spa location.', 'Show the QR code at the counter. One Dune Spa visit per redemption.', true, true, true, 1, 40000, 120000, '{40000,70000,100000,120000}', 'QAR', 365, '2027-07-08T18:09:09.192Z', true, 'published', 'wellness', 'teal', 4.9, 'The Pearl', '{anniversary,wedding,birthday}', '2026-11-04T18:09:09.192Z'),
  ('d9204c2f-4436-4191-b040-c088912d8b02', 'a010f419-3183-4fb5-bd38-e73ba7f51317', '56fbcea3-b02c-4322-9aca-c63010156a66', 'monetary', 'Souq Kitchen', 'مطبخ السوق', 'souq-kitchen-3', 'Homemade Qatari dishes, mezze, and desserts for sharing with family.', 'Valid for 240 days from issue. Redeem at any Souq Kitchen location.', 'Show the QR code at the counter. One Souq Kitchen visit per redemption.', false, true, true, null, 5000, 40000, '{5000,10000,15000,30000}', 'QAR', 365, '2027-07-08T18:09:09.192Z', true, 'published', 'dining', 'pink', 4.7, 'Souq Waqif', '{wedding,thank-you,just-because}', '2026-11-03T18:09:09.192Z'),
  ('b7a1cd80-be25-472b-8425-f314bb309cd3', 'a010f419-3183-4fb5-bd38-e73ba7f51317', '56fbcea3-b02c-4322-9aca-c63010156a66', 'monetary', 'Family Mezze Feast', 'وليمة مزّة عائلية', 'family-mezze-feast-19', 'A generous spread of mezze, grills and warm bread for the table.', 'Valid for 180 days from issue. Redeem at any Souq Kitchen location.', 'Show the QR code at the counter. One Souq Kitchen visit per redemption.', false, true, true, null, 15000, 60000, '{15000,25000,40000,60000}', 'QAR', 365, '2027-05-09T18:09:09.192Z', true, 'published', 'kitchen', 'pink', 4.8, 'Souq Waqif', '{wedding,congratulations,thank-you}', '2026-11-05T18:09:09.192Z'),
  ('ea5ef201-de85-4cb0-99f4-1c04ebf38781', 'a010f419-3183-4fb5-bd38-e73ba7f51317', '56fbcea3-b02c-4322-9aca-c63010156a66', 'monetary', 'Qatari Dinner for Six', 'عشاء قطري لستة', 'qatari-dinner-for-six-20', 'Machboos, grilled fish and sweets, served for six people.', 'Valid for 210 days from issue. Redeem at any Souq Kitchen location.', 'Show the QR code at the counter. One Souq Kitchen visit per redemption.', false, true, true, null, 25000, 80000, '{25000,40000,60000,80000}', 'QAR', 365, '2027-06-08T18:09:09.192Z', true, 'published', 'dining', 'pink', 4.6, 'Souq Waqif', '{wedding,congratulations,thank-you}', '2026-11-06T18:09:09.192Z'),
  ('12a3f10f-470e-48cf-9666-8a7c30507c8d', 'a010f419-3183-4fb5-bd38-e73ba7f51317', 'c5f10f32-ef04-4930-9336-ea659f0581dc', 'monetary', 'Dessert Table', 'طاولة الحلويات', 'dessert-table-21', 'A sweet finish: kunafa, baklava and um Ali for the whole family.', 'Valid for 150 days from issue. Redeem at any Souq Kitchen location.', 'Show the QR code at the counter. One Souq Kitchen visit per redemption.', false, true, true, null, 7500, 30000, '{7500,10000,20000,30000}', 'QAR', 365, '2027-04-09T18:09:09.192Z', true, 'published', 'sweets', 'pink', 4.7, 'Souq Waqif', '{birthday,congratulations,thank-you}', '2026-11-07T18:09:09.192Z'),
  ('5eb2cf13-afd0-4cfc-8822-f31ccc3cbb89', 'b11ee824-7866-4b02-abcd-08bc5e077018', '7657fe8a-c670-4ca4-bb78-20b499b645b5', 'monetary', 'Bloom Beauty', 'بلوم بيوتي', 'bloom-beauty-4', 'Manicures, blowouts and a little pampering for someone who deserves it.', 'Valid for 200 days from issue. Redeem at any Bloom Beauty location.', 'Show the QR code at the counter. One Bloom Beauty visit per redemption.', false, true, true, null, 5000, 35000, '{5000,10000,20000,35000}', 'QAR', 365, '2027-05-29T18:09:09.192Z', true, 'published', 'beauty', 'lavender', 4.6, 'Al Sadd', '{birthday,just-because,wedding}', '2026-11-06T18:09:09.192Z'),
  ('e98fb8e2-2dae-49c5-9d24-abd80ecd9ddc', 'b11ee824-7866-4b02-abcd-08bc5e077018', '7657fe8a-c670-4ca4-bb78-20b499b645b5', 'monetary', 'Manicure & Polish', 'مانيكير وتلوين الأظافر', 'manicure-and-polish-22', 'Shape, cuticle care and a colour of your choice for two hands.', 'Valid for 160 days from issue. Redeem at any Bloom Beauty location.', 'Show the QR code at the counter. One Bloom Beauty visit per redemption.', false, true, true, null, 7500, 30000, '{7500,10000,20000,30000}', 'QAR', 365, '2027-04-19T18:09:09.192Z', true, 'published', 'beauty', 'lavender', 4.5, 'Al Sadd', '{birthday,just-because}', '2026-10-25T18:09:09.192Z'),
  ('925dea3f-51ad-47c7-8ca0-73f7c121bb4f', 'b11ee824-7866-4b02-abcd-08bc5e077018', '7657fe8a-c670-4ca4-bb78-20b499b645b5', 'monetary', 'Blowout & Style', 'تصفيف الشعر', 'blowout-and-style-23', 'Wash, treatment and a styled finish for any occasion.', 'Valid for 170 days from issue. Redeem at any Bloom Beauty location.', 'Show the QR code at the counter. One Bloom Beauty visit per redemption.', false, true, true, null, 10000, 45000, '{10000,17500,30000,45000}', 'QAR', 365, '2027-04-29T18:09:09.192Z', true, 'published', 'scissors', 'lavender', 4.6, 'Msheireb', '{birthday,wedding,congratulations}', '2026-10-28T18:09:09.192Z'),
  ('14d5caf5-b0c1-45b5-8f28-d322e065a603', 'b11ee824-7866-4b02-abcd-08bc5e077018', '7657fe8a-c670-4ca4-bb78-20b499b645b5', 'monetary', 'Bridal Makeover', 'مكياج العروس', 'bridal-makeover-24', 'A full trial and day-of package with hair and makeup.', 'Valid for 300 days from issue. Redeem at any Bloom Beauty location.', 'Show the QR code at the counter. One Bloom Beauty visit per redemption.', false, true, true, null, 30000, 120000, '{30000,60000,90000,120000}', 'QAR', 365, '2027-09-06T18:09:09.192Z', true, 'published', 'bloom', 'lavender', 4.9, 'Al Sadd', '{wedding,wedding}', '2026-11-08T18:09:09.192Z'),
  ('8b7ce14b-6487-4d08-8d04-94b7d0586f15', '94666bd9-01bd-41d7-99c5-30cedea926b8', '8ea15bb8-35ef-4fda-be7e-2b1a4f97a83e', 'experience', 'Peak Fitness', 'بيك فيتنس', 'peak-fitness-5', 'A month of classes, personal training or a well-earned recovery session.', 'Valid for 300 days from issue. Redeem at any Peak Fitness location.', 'Show the QR code at the counter. One Peak Fitness visit per redemption.', true, true, true, 8, 15000, 80000, '{15000,30000,50000,80000}', 'QAR', 365, '2027-09-06T18:09:09.192Z', true, 'published', 'fitness', 'teal', 4.5, 'Lusail', '{congratulations,just-because}', '2026-11-08T18:09:09.192Z'),
  ('1517be53-64d4-46a5-8c04-014ff805e85c', '94666bd9-01bd-41d7-99c5-30cedea926b8', '8ea15bb8-35ef-4fda-be7e-2b1a4f97a83e', 'experience', '10 Class Pass', 'بطاقة 10 حصص', '10-class-pass-25', 'Ten group classes across strength, spin, yoga and hiit.', 'Valid for 180 days from issue. Redeem at any Peak Fitness location.', 'Show the QR code at the counter. One Peak Fitness visit per redemption.', true, true, true, 10, 20000, 60000, '{20000,30000,45000,60000}', 'QAR', 365, '2027-05-09T18:09:09.192Z', true, 'published', 'fitness', 'teal', 4.6, 'Lusail', '{congratulations,birthday}', '2026-10-26T18:09:09.192Z'),
  ('d8ceb7ca-2104-4d41-91a5-00a1660833bf', '94666bd9-01bd-41d7-99c5-30cedea926b8', '8ea15bb8-35ef-4fda-be7e-2b1a4f97a83e', 'experience', 'Personal Training Session', 'حصة تدريب شخصي', 'personal-training-session-26', 'One hour with a coach and a plan built around your goals.', 'Valid for 150 days from issue. Redeem at any Peak Fitness location.', 'Show the QR code at the counter. One Peak Fitness visit per redemption.', true, true, true, 1, 15000, 40000, '{15000,20000,30000,40000}', 'QAR', 365, '2027-04-09T18:09:09.192Z', true, 'published', 'activity', 'teal', 4.7, 'Lusail', '{just-because,congratulations}', '2026-10-31T18:09:09.192Z'),
  ('3aceb184-0308-4c7b-9c4c-c116800c425b', '94666bd9-01bd-41d7-99c5-30cedea926b8', '0a017db6-a633-4b21-b870-f4286da3793d', 'experience', 'Recovery & Wellness', 'استشفاء ولياقة', 'recovery-and-wellness-27', 'Massage, sauna and a stretching class to reset after a hard month.', 'Valid for 220 days from issue. Redeem at any Peak Fitness location.', 'Show the QR code at the counter. One Peak Fitness visit per redemption.', true, true, true, 1, 25000, 70000, '{25000,40000,55000,70000}', 'QAR', 365, '2027-06-18T18:09:09.192Z', true, 'published', 'heartPulse', 'teal', 4.5, 'West Bay', '{thank-you,just-because}', '2026-11-04T18:09:09.192Z'),
  ('5500f6a0-3313-48cb-8da0-1ba7a4ffd4fd', '128ee37e-7489-47ae-95e8-6011db656ee2', '3f629d4c-b477-4ea8-bdc0-ef01cd381121', 'monetary', 'Cinema Nova', 'سينما نوفا', 'cinema-nova-6', 'Tickets, popcorn and a big-screen night out for two.', 'Valid for 150 days from issue. Redeem at any Cinema Nova location.', 'Show the QR code at the counter. One Cinema Nova visit per redemption.', false, true, true, null, 5000, 30000, '{5000,10000,20000,30000}', 'QAR', 365, '2027-04-09T18:09:09.192Z', true, 'published', 'entertainment', 'pink', 4.4, 'Msheireb', '{birthday,just-because}', '2026-11-09T18:09:09.192Z'),
  ('a785d21b-e9a1-4b8b-adfa-4d5f7e788e76', '128ee37e-7489-47ae-95e8-6011db656ee2', '3f629d4c-b477-4ea8-bdc0-ef01cd381121', 'monetary', 'Date Night for Two', 'ليلة موعد للاثنين', 'date-night-for-two-28', 'Two tickets, sharing combo and a drink, ready at the counter.', 'Valid for 140 days from issue. Redeem at any Cinema Nova location.', 'Show the QR code at the counter. One Cinema Nova visit per redemption.', false, true, true, null, 10000, 40000, '{10000,15000,25000,40000}', 'QAR', 365, '2027-03-30T18:09:09.192Z', true, 'published', 'entertainment', 'pink', 4.6, 'Msheireb', '{anniversary,birthday,just-because}', '2026-10-30T18:09:09.192Z'),
  ('2f98ef42-0b71-4c98-a972-96cd3a16e733', '128ee37e-7489-47ae-95e8-6011db656ee2', '3f629d4c-b477-4ea8-bdc0-ef01cd381121', 'monetary', 'Family Movie Pack', 'باقة أفلام عائلية', 'family-movie-pack-29', 'Four tickets with a large popcorn and drinks to share.', 'Valid for 160 days from issue. Redeem at any Cinema Nova location.', 'Show the QR code at the counter. One Cinema Nova visit per redemption.', false, true, true, null, 15000, 50000, '{15000,25000,35000,50000}', 'QAR', 365, '2027-04-19T18:09:09.192Z', true, 'published', 'popcorn', 'pink', 4.5, 'Al Sadd', '{birthday,thank-you}', '2026-11-01T18:09:09.192Z'),
  ('b22aeb9c-eb87-42d1-8ecd-1ebb33720712', '128ee37e-7489-47ae-95e8-6011db656ee2', '3f629d4c-b477-4ea8-bdc0-ef01cd381121', 'monetary', 'IMAX Premium', 'تذكرة IAX', 'imax-premium-30', 'A premium large-format seat with a dessert, on the house.', 'Valid for 130 days from issue. Redeem at any Cinema Nova location.', 'Show the QR code at the counter. One Cinema Nova visit per redemption.', false, true, true, null, 7500, 25000, '{7500,10000,15000,25000}', 'QAR', 365, '2027-03-20T18:09:09.192Z', true, 'published', 'ticket', 'pink', 4.4, 'Msheireb', '{just-because,thank-you}', '2026-11-05T18:09:09.192Z'),
  ('fb1eba99-75be-4372-b1c5-7cf8f5022d2b', '32e841cf-effd-4eec-86ae-21c1dd586d3d', '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'monetary', 'The Book Nook', 'ركن الكتاب', 'the-book-nook-7', 'A cosy independent bookshop with new releases, stationery and coffee.', 'Valid for 365 days from issue. Redeem at any The Book Nook location.', 'Show the QR code at the counter. One The Book Nook visit per redemption.', false, true, true, null, 2500, 25000, '{2500,5000,10000,25000}', 'QAR', 365, '2027-11-10T18:09:09.192Z', true, 'published', 'book', 'gold', 4.8, 'Al Waab', '{graduation,thank-you,just-because}', '2026-10-21T18:09:09.192Z'),
  ('02155264-9642-42cc-a583-c0d7ef749cef', '32e841cf-effd-4eec-86ae-21c1dd586d3d', '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'monetary', 'Book Lovers Credit', 'رصيد محبي الكتب', 'book-lovers-credit-31', 'Any book in the shop, plus the members shelf nobody else sees.', 'Valid for 365 days from issue. Redeem at any The Book Nook location.', 'Show the QR code at the counter. One The Book Nook visit per redemption.', false, true, true, null, 2500, 20000, '{2500,5000,10000,20000}', 'QAR', 365, '2027-11-10T18:09:09.192Z', true, 'published', 'book', 'gold', 4.7, 'Al Waab', '{graduation,thank-you}', '2026-10-24T18:09:09.192Z'),
  ('99377a9f-862c-4a78-b234-0e4c63b36529', '32e841cf-effd-4eec-86ae-21c1dd586d3d', '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'monetary', 'Stationery Bundle', 'حزمة أدوات الكتابة', 'stationery-bundle-32', 'Notebooks, pens and a fountain pen, wrapped in a kraft box.', 'Valid for 200 days from issue. Redeem at any The Book Nook location.', 'Show the QR code at the counter. One The Book Nook visit per redemption.', false, true, true, null, 5000, 20000, '{5000,7500,12000,20000}', 'QAR', 365, '2027-05-29T18:09:09.192Z', true, 'published', 'pen', 'gold', 4.6, 'Al Waab', '{graduation,just-because}', '2026-10-28T18:09:09.192Z'),
  ('d76d20ff-d08d-401f-a21e-d009e89d3ea3', '32e841cf-effd-4eec-86ae-21c1dd586d3d', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Poetry Evening', 'أمسية شعرية', 'poetry-evening-33', 'An open mic evening with tea and cake at the back of the shop.', 'Valid for 120 days from issue. Redeem at any The Book Nook location.', 'Show the QR code at the counter. One The Book Nook visit per redemption.', true, true, true, 1, 5000, 15000, '{5000,7500,10000,15000}', 'QAR', 365, '2027-03-10T18:09:09.192Z', true, 'published', 'notebook', 'gold', 4.5, 'Al Waab', '{just-because,thank-you}', '2026-11-04T18:09:09.192Z'),
  ('f2aa360a-8c73-4b1a-9539-64341941cafd', '70456ad2-cdab-47e2-a21c-02048addfc38', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Desert Adventures', 'مغامرات الصحراء', 'desert-adventures-8', 'Dune drives, camel rides and sunset dinners under the stars.', 'Valid for 400 days from issue. Redeem at any Desert Adventures location.', 'Show the QR code at the counter. One Desert Adventures visit per redemption.', true, true, true, 1, 20000, 150000, '{20000,50000,100000,150000}', 'QAR', 365, '2027-12-15T18:09:09.192Z', true, 'published', 'experiences', 'lavender', 4.9, 'Sealine', '{anniversary,seasonal,birthday}', '2026-10-31T18:09:09.192Z'),
  ('e479667d-cf1b-4621-8293-ed42d2230289', '70456ad2-cdab-47e2-a21c-02048addfc38', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Dune Drive Sunset', 'جولة الكثبان عند الغروب', 'dune-drive-sunset-34', 'A 4x4 across the dunes with tea in the camp at sunset.', 'Valid for 360 days from issue. Redeem at any Desert Adventures location.', 'Show the QR code at the counter. One Desert Adventures visit per redemption.', true, true, true, 1, 25000, 90000, '{25000,40000,65000,90000}', 'QAR', 365, '2027-11-05T18:09:09.192Z', true, 'published', 'desert', 'lavender', 4.8, 'Sealine', '{anniversary,just-because}', '2026-11-01T18:09:09.192Z'),
  ('5958693d-75e9-4f23-97e7-1af04df4629f', '70456ad2-cdab-47e2-a21c-02048addfc38', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Camel Ride & Dinner', 'ركوب الجمل والعشاء', 'camel-ride-and-dinner-35', 'A short camel ride into the sunset, then dinner under the stars.', 'Valid for 360 days from issue. Redeem at any Desert Adventures location.', 'Show the QR code at the counter. One Desert Adventures visit per redemption.', true, true, true, 1, 30000, 100000, '{30000,50000,75000,100000}', 'QAR', 365, '2027-11-05T18:09:09.192Z', true, 'published', 'campfire', 'lavender', 4.7, 'Sealine', '{anniversary,birthday,thank-you}', '2026-11-03T18:09:09.192Z'),
  ('b243c33a-29fa-497e-a20d-24d21475360b', '70456ad2-cdab-47e2-a21c-02048addfc38', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Stargazing Camp', 'مخيم مراقبة النجوم', 'stargazing-camp-36', 'An overnight camp with a telescope, blankets and a late dinner.', 'Valid for 400 days from issue. Redeem at any Desert Adventures location.', 'Show the QR code at the counter. One Desert Adventures visit per redemption.', true, true, true, 1, 50000, 150000, '{50000,80000,120000,150000}', 'QAR', 365, '2027-12-15T18:09:09.192Z', true, 'published', 'night', 'lavender', 4.9, 'Sealine', '{seasonal,anniversary}', '2026-11-07T18:09:09.192Z'),
  ('74afe13e-f1c7-4a31-afbe-f283e1b9e92d', 'c1b1dbb8-0f25-4708-8065-00a2cbf3d36e', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Azure Spa', 'أزور سبا', 'azure-spa-9', 'A full wellness escape in one voucher: hammam, deep-tissue massage and ritual facial. The gift giver redeems it however they like.', 'Valid for 180 days from issue. Redeem at any Azure Spa location.', 'Show the QR code at the counter. One Azure Spa visit per redemption.', true, true, true, 1, 15000, 15000, '{15000}', 'QAR', 365, '2027-05-09T18:09:09.192Z', true, 'published', 'spa', 'lavender', 4.8, 'West Bay', '{birthday,just-because,thank-you}', '2026-11-05T18:09:09.192Z'),
  ('17e13801-4be7-4d49-8bb3-e643da6fd4ee', 'c1b1dbb8-0f25-4708-8065-00a2cbf3d36e', '0a017db6-a633-4b21-b870-f4286da3793d', 'experience', 'Signature Facial', 'جلسة تجميل الوجه', 'signature-facial-37', 'Deep cleanse, mask and a 45 minute facial for one.', 'Valid for 190 days from issue. Redeem at any Azure Spa location.', 'Show the QR code at the counter. One Azure Spa visit per redemption.', true, true, true, 1, 15000, 60000, '{15000,25000,40000,60000}', 'QAR', 365, '2027-05-19T18:09:09.192Z', true, 'published', 'bloom', 'lavender', 4.7, 'West Bay', '{birthday,thank-you}', '2026-10-22T18:09:09.192Z'),
  ('f428b136-2465-4ac8-810c-f1e14621523b', 'c1b1dbb8-0f25-4708-8065-00a2cbf3d36e', '0a017db6-a633-4b21-b870-f4286da3793d', 'experience', 'Hot Stone Massage', 'تدليك بالحجارة الساخنة', 'hot-stone-massage-38', 'Warm basalt stones and slow pressure to unwind everything.', 'Valid for 200 days from issue. Redeem at any Azure Spa location.', 'Show the QR code at the counter. One Azure Spa visit per redemption.', true, true, true, 1, 20000, 70000, '{20000,35000,50000,70000}', 'QAR', 365, '2027-05-29T18:09:09.192Z', true, 'published', 'massage', 'lavender', 4.8, 'The Pearl', '{anniversary,thank-you}', '2026-10-29T18:09:09.192Z'),
  ('efc96a17-726f-42d9-a4ff-1f73fe59168f', 'c1b1dbb8-0f25-4708-8065-00a2cbf3d36e', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Full Day Wellness Pass', 'تذكرة يوم wellness', 'full-day-wellness-pass-39', 'Hammam, massage, facial and a healthy lunch in one long day.', 'Valid for 250 days from issue. Redeem at any Azure Spa location.', 'Show the QR code at the counter. One Azure Spa visit per redemption.', true, true, true, 1, 40000, 120000, '{40000,70000,100000,120000}', 'QAR', 365, '2027-07-18T18:09:09.192Z', true, 'published', 'wellness', 'lavender', 4.9, 'West Bay', '{anniversary,birthday,wedding}', '2026-11-08T18:09:09.192Z'),
  ('e858f76c-0676-4061-961e-46d0aa91c144', '66d93941-ca8d-45f2-8af4-eea9c97d6c05', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Pearl Hotel', 'فندق البور', 'pearl-hotel-10', 'One night at the Pearl Hotel with sea-view room and breakfast for two. A once-in-a-lifetime experience gift.', 'Valid for 240 days from issue. Redeem at any Pearl Hotel location.', 'Show the QR code at the counter. One Pearl Hotel visit per redemption.', true, true, true, 1, 120000, 120000, '{120000}', 'QAR', 365, '2027-07-08T18:09:09.192Z', true, 'published', 'hotel', 'sky', 4.9, 'The Pearl', '{anniversary,wedding,birthday}', '2026-11-07T18:09:09.192Z'),
  ('ab59d193-fa9d-4764-910d-0903eb9042ce', '66d93941-ca8d-45f2-8af4-eea9c97d6c05', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Sea View Suite', 'جناح بإطلالة بحرية', 'sea-view-suite-40', 'A night in a corner suite with the marina lights below.', 'Valid for 240 days from issue. Redeem at any Pearl Hotel location.', 'Show the QR code at the counter. One Pearl Hotel visit per redemption.', true, true, true, 1, 90000, 180000, '{90000,120000,150000,180000}', 'QAR', 365, '2027-07-08T18:09:09.192Z', true, 'published', 'hotel', 'sky', 4.8, 'The Pearl', '{anniversary,wedding}', '2026-10-26T18:09:09.192Z'),
  ('26114bd9-3730-4dc8-b045-d66dfe806841', '66d93941-ca8d-45f2-8af4-eea9c97d6c05', '56fbcea3-b02c-4322-9aca-c63010156a66', 'monetary', 'Breakfast in Bed', 'فطور في السرير', 'breakfast-in-bed-41', 'A slow breakfast delivered to the room, with a view.', 'Valid for 180 days from issue. Redeem at any Pearl Hotel location.', 'Show the QR code at the counter. One Pearl Hotel visit per redemption.', false, true, true, null, 25000, 60000, '{25000,35000,50000,60000}', 'QAR', 365, '2027-05-09T18:09:09.192Z', true, 'published', 'pastry', 'sky', 4.7, 'The Pearl', '{birthday,thank-you}', '2026-11-02T18:09:09.192Z'),
  ('1afce2f7-66bb-4306-a680-f31a10323784', '66d93941-ca8d-45f2-8af4-eea9c97d6c05', '857d79f0-85e3-4333-864d-c4ef7b92f7d0', 'experience', 'Spa & Stay', 'إقامة مع سبا', 'spa-and-stay-42', 'A night at the hotel with a spa treatment for two.', 'Valid for 300 days from issue. Redeem at any Pearl Hotel location.', 'Show the QR code at the counter. One Pearl Hotel visit per redemption.', true, true, true, 1, 150000, 250000, '{150000,180000,220000,250000}', 'QAR', 365, '2027-09-06T18:09:09.192Z', true, 'published', 'spa', 'sky', 4.9, 'The Pearl', '{wedding,anniversary}', '2026-11-09T18:09:09.192Z'),
  ('94aaaca7-c385-42a1-a690-53205f84d19b', 'f314429d-12c0-4e3a-8530-ce8a926bdbad', 'c5f10f32-ef04-4930-9336-ea659f0581dc', 'monetary', 'Sweet Avenue', 'سويت أفينيو', 'sweet-avenue-11', 'Cakes, macarons and celebration boxes made fresh every morning. Perfect for birthdays and thank-yous.', 'Valid for 365 days from issue. Redeem at any Sweet Avenue location.', 'Show the QR code at the counter. One Sweet Avenue visit per redemption.', false, true, true, null, 3000, 20000, '{3000,6000,12000,20000}', 'QAR', 365, '2027-11-10T18:09:09.192Z', true, 'published', 'dessert', 'pink', 4.7, 'Msheireb', '{birthday,thank-you,congratulations,just-because}', '2026-11-04T18:09:09.192Z'),
  ('4b0fe9e2-c57a-4b29-8dc6-390c8f509dbb', 'f314429d-12c0-4e3a-8530-ce8a926bdbad', 'c5f10f32-ef04-4930-9336-ea659f0581dc', 'monetary', 'Celebration Cake', 'كيكة الاحتفال', 'celebration-cake-43', 'A three-tier cake with a hand written message and candles.', 'Valid for 200 days from issue. Redeem at any Sweet Avenue location.', 'Show the QR code at the counter. One Sweet Avenue visit per redemption.', false, true, true, null, 10000, 45000, '{10000,17500,30000,45000}', 'QAR', 365, '2027-05-29T18:09:09.192Z', true, 'published', 'birthday', 'pink', 4.9, 'Msheireb', '{birthday,congratulations,wedding}', '2026-10-29T18:09:09.192Z'),
  ('58d236e7-279d-48ae-8d37-0081abaa6a46', 'f314429d-12c0-4e3a-8530-ce8a926bdbad', 'c5f10f32-ef04-4930-9336-ea659f0581dc', 'monetary', 'Macaron Box', 'علبة ماكرون', 'macaron-box-44', 'Twelve macarons in six flavours, packed flat for travel.', 'Valid for 220 days from issue. Redeem at any Sweet Avenue location.', 'Show the QR code at the counter. One Sweet Avenue visit per redemption.', false, true, true, null, 7500, 25000, '{7500,12000,18000,25000}', 'QAR', 365, '2027-06-18T18:09:09.192Z', true, 'published', 'macarons', 'pink', 4.8, 'Msheireb', '{thank-you,birthday,just-because}', '2026-10-31T18:09:09.192Z'),
  ('ac46bd6d-6c55-4013-8d5f-8388b0bb49c0', 'f314429d-12c0-4e3a-8530-ce8a926bdbad', 'c5f10f32-ef04-4930-9336-ea659f0581dc', 'monetary', 'Cakes for the Office', 'كيك للمكتب', 'cakes-for-the-office-45', 'A dozen slices for the team, with coffee on the side.', 'Valid for 150 days from issue. Redeem at any Sweet Avenue location.', 'Show the QR code at the counter. One Sweet Avenue visit per redemption.', false, true, true, null, 6000, 25000, '{6000,10000,15000,25000}', 'QAR', 365, '2027-04-09T18:09:09.192Z', true, 'published', 'sweets', 'pink', 4.6, 'Msheireb', '{thank-you,congratulations}', '2026-11-05T18:09:09.192Z'),
  ('8883b413-3483-4077-836a-67c63c73161d', '6e1c69d0-03ed-4901-9e43-e791b30b9d11', '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'monetary', 'Thread & Co.', 'ثريد آند كو', 'thread-and-co-12', 'Contemporary fashion, accessories and timeless pieces from local and regional designers.', 'Valid for 300 days from issue. Redeem at any Thread & Co. location.', 'Show the QR code at the counter. One Thread & Co. visit per redemption.', false, true, true, null, 10000, 80000, '{10000,20000,50000,80000}', 'QAR', 365, '2027-09-06T18:09:09.192Z', true, 'published', 'fashion', 'lavender', 4.6, 'Msheireb', '{birthday,anniversary,graduation,thank-you}', '2026-11-02T18:09:09.192Z'),
  ('f9cf1b26-42f3-45df-9e59-c7bf6f50a006', '6e1c69d0-03ed-4901-9e43-e791b30b9d11', '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'monetary', 'Wardrobe Credit', 'رصيد خزانة', 'wardrobe-credit-46', 'A voucher for any piece in the store, from basics to occasion.', 'Valid for 300 days from issue. Redeem at any Thread & Co. location.', 'Show the QR code at the counter. One Thread & Co. visit per redemption.', false, true, true, null, 15000, 90000, '{15000,30000,60000,90000}', 'QAR', 365, '2027-09-06T18:09:09.192Z', true, 'published', 'fashion', 'lavender', 4.7, 'Msheireb', '{birthday,anniversary,graduation}', '2026-10-28T18:09:09.192Z'),
  ('7925f484-8f54-49c8-9f18-239d79a45b18', '6e1c69d0-03ed-4901-9e43-e791b30b9d11', '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'monetary', 'Accessories Edit', 'تشكيلة الإكسسوارات', 'accessories-edit-47', 'Bags, scarves, sunglasses and small leather goods.', 'Valid for 280 days from issue. Redeem at any Thread & Co. location.', 'Show the QR code at the counter. One Thread & Co. visit per redemption.', false, true, true, null, 10000, 50000, '{10000,17500,30000,50000}', 'QAR', 365, '2027-08-17T18:09:09.192Z', true, 'published', 'bag', 'lavender', 4.5, 'Msheireb', '{thank-you,just-because}', '2026-10-30T18:09:09.192Z'),
  ('37f0c6e1-0786-436d-aa1f-3c3f268e42df', '6e1c69d0-03ed-4901-9e43-e791b30b9d11', '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'monetary', 'Made to Measure', 'تفصيل حسب المقاس', 'made-to-measure-48', 'A fitting session and a custom piece made for the person you love.', 'Valid for 320 days from issue. Redeem at any Thread & Co. location.', 'Show the QR code at the counter. One Thread & Co. visit per redemption.', false, true, true, null, 30000, 120000, '{30000,60000,90000,120000}', 'QAR', 365, '2027-09-26T18:09:09.192Z', true, 'published', 'scissors', 'lavender', 4.8, 'Msheireb', '{wedding,anniversary}', '2026-11-06T18:09:09.192Z'),
  ('fd744a39-6265-4970-9888-db8b64144a2d', '2533ec89-f5b1-4409-9273-c87bf133d095', '0a017db6-a633-4b21-b870-f4286da3793d', 'experience', 'Five Session Massage Pack', 'باقة خمس جلسات تدليك', 'five-session-massage-pack-49', 'Five deep tissue massages to use whenever you need them. Each visit uses one session and the card is finished with the last one.', 'Valid for 300 days from issue. Redeem at any Dune Spa location.', 'Show the QR code at the counter. One Dune Spa visit per redemption.', true, true, true, 5, 60000, 150000, '{60000,90000,120000,150000}', 'QAR', 365, '2027-09-06T18:09:09.192Z', true, 'published', 'massage', 'teal', 4.9, 'The Pearl', '{thank-you,birthday,just-because}', '2026-11-09T18:09:09.192Z');

insert into public.product_variants (
  id, product_id, kind, label, amount_minor, session_count, price_minor, currency,
  valid_until, active, sort_order
) values
  ('4a9a098d-ae7e-4e1a-ac25-9ed517233670', 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f', 'denomination', 'QAR 25.00', 2500, null, 2500, 'QAR', '2027-11-10T18:09:09.192Z', true, 0),
  ('314f1a91-a8c2-45d6-8fd2-a496dfaf7547', 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-11-10T18:09:09.192Z', true, 1),
  ('9736f5e0-c925-482e-abd7-f41827250117', 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-11-10T18:09:09.192Z', true, 2),
  ('7372884a-9c92-4e11-9fd4-a2bd2c77fbae', 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-11-10T18:09:09.192Z', true, 3),
  ('a51d39a8-f3d2-4db9-8dd2-d8003d5866fd', 'c492cf10-a6fa-47a3-8bf6-f728303fc386', 'denomination', 'QAR 25.00', 2500, null, 2500, 'QAR', '2027-09-06T18:09:09.192Z', true, 0),
  ('c6f3e481-a7e7-45ab-85c4-5cd7601dc1b5', 'c492cf10-a6fa-47a3-8bf6-f728303fc386', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-09-06T18:09:09.192Z', true, 1),
  ('166b7738-fe5c-4a4e-8c62-ad5f868e6a66', 'c492cf10-a6fa-47a3-8bf6-f728303fc386', 'denomination', 'QAR 75.00', 7500, null, 7500, 'QAR', '2027-09-06T18:09:09.192Z', true, 2),
  ('1a240af2-4510-4f7c-8dcb-0b4f7b9e7344', 'c492cf10-a6fa-47a3-8bf6-f728303fc386', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-09-06T18:09:09.192Z', true, 3),
  ('5f030c0f-76a9-4428-a1b6-ec4e63c58b04', '0fd29e1d-4794-489d-bceb-b42b52316979', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-03-10T18:09:09.192Z', true, 0),
  ('05b408c3-192d-4af7-a676-3853e321d0e2', '0fd29e1d-4794-489d-bceb-b42b52316979', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-03-10T18:09:09.192Z', true, 1),
  ('65783f0d-d58c-477b-932f-2649352bad69', '0fd29e1d-4794-489d-bceb-b42b52316979', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-03-10T18:09:09.192Z', true, 2),
  ('01c12ef7-f80d-4d07-bec8-f65169a4688a', '0fd29e1d-4794-489d-bceb-b42b52316979', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-03-10T18:09:09.192Z', true, 3),
  ('73db0a86-04ea-4c02-9134-75992f2f21fb', '8fe6ca73-c614-441c-b274-3b3ea82f47f7', 'denomination', 'QAR 25.00', 2500, null, 2500, 'QAR', '2027-05-29T18:09:09.192Z', true, 0),
  ('14cee656-3152-481e-9da8-55cc1a52aeb4', '8fe6ca73-c614-441c-b274-3b3ea82f47f7', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-05-29T18:09:09.192Z', true, 1),
  ('54fce834-1e54-4ab5-a094-9cb4a6da78f6', '8fe6ca73-c614-441c-b274-3b3ea82f47f7', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-05-29T18:09:09.192Z', true, 2),
  ('5929214d-72e2-4d90-8532-12084e34c737', '8fe6ca73-c614-441c-b274-3b3ea82f47f7', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-05-29T18:09:09.192Z', true, 3),
  ('16633a99-65a6-4550-b10f-bb75310645c0', 'e686e08e-a042-49ba-92ee-3f534a0a8033', 'package', '1 session', null, 1, 10000, 'QAR', '2027-05-09T18:09:09.192Z', true, 0),
  ('b9f23d8e-8c87-4cbe-9f40-de04e8cfad1c', 'e686e08e-a042-49ba-92ee-3f534a0a8033', 'package', '3 sessions', null, 3, 30000, 'QAR', '2027-05-09T18:09:09.192Z', true, 1),
  ('b1f7823f-1c5f-4a7d-ad9b-265e33c66d03', 'e686e08e-a042-49ba-92ee-3f534a0a8033', 'package', '5 sessions', null, 5, 50000, 'QAR', '2027-05-09T18:09:09.192Z', true, 2),
  ('079f14e3-1800-41af-ac87-5c98e655ae3f', '0d6a07fa-8673-4cea-9979-d446e4263b6b', 'package', '1 session', null, 1, 15000, 'QAR', '2027-04-09T18:09:09.192Z', true, 0),
  ('9fde5510-89a5-4f51-bd01-d96b79b3a488', '0d6a07fa-8673-4cea-9979-d446e4263b6b', 'package', '3 sessions', null, 3, 45000, 'QAR', '2027-04-09T18:09:09.192Z', true, 1),
  ('55553492-045f-4e98-96d5-ffc1b36e9264', '0d6a07fa-8673-4cea-9979-d446e4263b6b', 'package', '5 sessions', null, 5, 75000, 'QAR', '2027-04-09T18:09:09.192Z', true, 2),
  ('b4c4f8e6-e7b0-4a53-a6e1-c3d89ca44a34', '3fc2ae1a-92d7-4b3d-bab0-28bab9e46a55', 'package', '1 session', null, 1, 20000, 'QAR', '2027-05-29T18:09:09.192Z', true, 0),
  ('1f8d9c1f-4ab9-492e-a024-fa72c6eda25e', '3fc2ae1a-92d7-4b3d-bab0-28bab9e46a55', 'package', '3 sessions', null, 3, 60000, 'QAR', '2027-05-29T18:09:09.192Z', true, 1),
  ('0dc3aebf-0a6a-4974-9196-92cb9aad2996', '3fc2ae1a-92d7-4b3d-bab0-28bab9e46a55', 'package', '5 sessions', null, 5, 100000, 'QAR', '2027-05-29T18:09:09.192Z', true, 2),
  ('c47e72af-5bcb-42e0-b544-f71ecdf75a5a', '6f73e6cd-caa0-404f-b909-713a18114e6e', 'package', '1 session', null, 1, 40000, 'QAR', '2027-07-08T18:09:09.192Z', true, 0),
  ('12bb6e11-87d9-458a-8846-e7f9e9e4e8aa', '6f73e6cd-caa0-404f-b909-713a18114e6e', 'package', '3 sessions', null, 3, 120000, 'QAR', '2027-07-08T18:09:09.192Z', true, 1),
  ('c8a4f8f8-cbf3-470b-b971-d470a45483b1', '6f73e6cd-caa0-404f-b909-713a18114e6e', 'package', '5 sessions', null, 5, 200000, 'QAR', '2027-07-08T18:09:09.192Z', true, 2),
  ('621fc67a-f3b8-49c4-a4cd-0c6c77722f09', 'd9204c2f-4436-4191-b040-c088912d8b02', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-07-08T18:09:09.192Z', true, 0),
  ('ee28c7b4-54f3-4fb7-bfd4-6bc1b185b3f8', 'd9204c2f-4436-4191-b040-c088912d8b02', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-07-08T18:09:09.192Z', true, 1),
  ('2c684a0d-b1f8-42d1-a90e-7bef362c0ed6', 'd9204c2f-4436-4191-b040-c088912d8b02', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-07-08T18:09:09.192Z', true, 2),
  ('dac169d9-fa9d-498c-bd66-5b18683e3945', 'd9204c2f-4436-4191-b040-c088912d8b02', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-07-08T18:09:09.192Z', true, 3),
  ('dbd4151b-72e2-44bb-aac5-fe26ddd77b18', 'b7a1cd80-be25-472b-8425-f314bb309cd3', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-05-09T18:09:09.192Z', true, 0),
  ('c3e9609c-0b84-421c-a130-6ab260d6049c', 'b7a1cd80-be25-472b-8425-f314bb309cd3', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-05-09T18:09:09.192Z', true, 1),
  ('51d35474-a591-45d0-916a-46577ffaf34b', 'b7a1cd80-be25-472b-8425-f314bb309cd3', 'denomination', 'QAR 400.00', 40000, null, 40000, 'QAR', '2027-05-09T18:09:09.192Z', true, 2),
  ('d9d770fc-6f21-4464-82ef-0ab00c046357', 'b7a1cd80-be25-472b-8425-f314bb309cd3', 'denomination', 'QAR 600.00', 60000, null, 60000, 'QAR', '2027-05-09T18:09:09.192Z', true, 3),
  ('56c99b57-0fbb-4ddf-8024-0ec6a8c2fdc5', 'ea5ef201-de85-4cb0-99f4-1c04ebf38781', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-06-08T18:09:09.192Z', true, 0),
  ('1e7542a3-e5cb-4c47-8324-558cc8c55220', 'ea5ef201-de85-4cb0-99f4-1c04ebf38781', 'denomination', 'QAR 400.00', 40000, null, 40000, 'QAR', '2027-06-08T18:09:09.192Z', true, 1),
  ('16b13ed5-2c09-4cca-90f4-b9caf4a0b7f3', 'ea5ef201-de85-4cb0-99f4-1c04ebf38781', 'denomination', 'QAR 600.00', 60000, null, 60000, 'QAR', '2027-06-08T18:09:09.192Z', true, 2),
  ('2948dacc-89a3-4b17-8b82-efa7f37393bf', 'ea5ef201-de85-4cb0-99f4-1c04ebf38781', 'denomination', 'QAR 800.00', 80000, null, 80000, 'QAR', '2027-06-08T18:09:09.192Z', true, 3),
  ('1c24cd63-900a-4cf6-a830-19cd9d66cf18', '12a3f10f-470e-48cf-9666-8a7c30507c8d', 'denomination', 'QAR 75.00', 7500, null, 7500, 'QAR', '2027-04-09T18:09:09.192Z', true, 0),
  ('87d54068-1c21-4415-b732-fa12d0304e42', '12a3f10f-470e-48cf-9666-8a7c30507c8d', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-04-09T18:09:09.192Z', true, 1),
  ('f45a6bfa-62e5-4fc1-b597-ab2bf6a73ee8', '12a3f10f-470e-48cf-9666-8a7c30507c8d', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-04-09T18:09:09.192Z', true, 2),
  ('073a406a-c419-4e8a-b060-78de86d2c193', '12a3f10f-470e-48cf-9666-8a7c30507c8d', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-04-09T18:09:09.192Z', true, 3),
  ('c5cd38ce-f72c-4c1b-8d07-417a305727dd', '5eb2cf13-afd0-4cfc-8822-f31ccc3cbb89', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-05-29T18:09:09.192Z', true, 0),
  ('e7451fcd-c63b-47fa-a4d8-8909b104e6e4', '5eb2cf13-afd0-4cfc-8822-f31ccc3cbb89', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-05-29T18:09:09.192Z', true, 1),
  ('d4ecb3cf-a48d-44fd-bffe-d9d08da4ad4d', '5eb2cf13-afd0-4cfc-8822-f31ccc3cbb89', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-05-29T18:09:09.192Z', true, 2),
  ('4a74ccc8-c758-4288-9608-2e90d3ac2ce8', '5eb2cf13-afd0-4cfc-8822-f31ccc3cbb89', 'denomination', 'QAR 350.00', 35000, null, 35000, 'QAR', '2027-05-29T18:09:09.192Z', true, 3),
  ('77164280-3ce7-4d5e-af72-48f2ac9530f5', 'e98fb8e2-2dae-49c5-9d24-abd80ecd9ddc', 'denomination', 'QAR 75.00', 7500, null, 7500, 'QAR', '2027-04-19T18:09:09.192Z', true, 0),
  ('27da4df9-8a70-43d9-a48f-2a22d0e96830', 'e98fb8e2-2dae-49c5-9d24-abd80ecd9ddc', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-04-19T18:09:09.192Z', true, 1),
  ('a9090527-36ec-4c27-826d-86801f4363c5', 'e98fb8e2-2dae-49c5-9d24-abd80ecd9ddc', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-04-19T18:09:09.192Z', true, 2),
  ('49da6208-1e4c-4fab-ab05-05f966656971', 'e98fb8e2-2dae-49c5-9d24-abd80ecd9ddc', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-04-19T18:09:09.192Z', true, 3),
  ('53dcd7f2-f1db-4f5c-86cb-7c52d845df1e', '925dea3f-51ad-47c7-8ca0-73f7c121bb4f', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-04-29T18:09:09.192Z', true, 0),
  ('a03edd61-d576-405a-9f5c-aa0d18d991af', '925dea3f-51ad-47c7-8ca0-73f7c121bb4f', 'denomination', 'QAR 175.00', 17500, null, 17500, 'QAR', '2027-04-29T18:09:09.192Z', true, 1),
  ('7ba9cc96-ca0c-420d-9a2d-ecea411c4a87', '925dea3f-51ad-47c7-8ca0-73f7c121bb4f', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-04-29T18:09:09.192Z', true, 2),
  ('3fc62a2b-69b4-4f74-bae3-10f15fcb91ca', '925dea3f-51ad-47c7-8ca0-73f7c121bb4f', 'denomination', 'QAR 450.00', 45000, null, 45000, 'QAR', '2027-04-29T18:09:09.192Z', true, 3),
  ('d165918a-88a5-4425-aba1-a28d85f66986', '14d5caf5-b0c1-45b5-8f28-d322e065a603', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-09-06T18:09:09.192Z', true, 0),
  ('e704d06b-c8c5-477c-9923-11c96241bd38', '14d5caf5-b0c1-45b5-8f28-d322e065a603', 'denomination', 'QAR 600.00', 60000, null, 60000, 'QAR', '2027-09-06T18:09:09.192Z', true, 1),
  ('ec5e2b8c-9563-4fbe-aae4-d5cda3550d33', '14d5caf5-b0c1-45b5-8f28-d322e065a603', 'denomination', 'QAR 900.00', 90000, null, 90000, 'QAR', '2027-09-06T18:09:09.192Z', true, 2),
  ('fec19f05-aea6-4061-ab1b-f3d2e8a5628c', '14d5caf5-b0c1-45b5-8f28-d322e065a603', 'denomination', 'QAR 1200.00', 120000, null, 120000, 'QAR', '2027-09-06T18:09:09.192Z', true, 3),
  ('d123cac2-73a0-4e08-b1d8-b5e13c8bc13c', '8b7ce14b-6487-4d08-8d04-94b7d0586f15', 'package', '1 session', null, 1, 15000, 'QAR', '2027-09-06T18:09:09.192Z', true, 0),
  ('1869c3a6-349c-4e2c-8074-c80b34bcee9c', '8b7ce14b-6487-4d08-8d04-94b7d0586f15', 'package', '3 sessions', null, 3, 45000, 'QAR', '2027-09-06T18:09:09.192Z', true, 1),
  ('c44441cd-6ade-4c4c-979a-ec0923b97bb1', '8b7ce14b-6487-4d08-8d04-94b7d0586f15', 'package', '5 sessions', null, 5, 75000, 'QAR', '2027-09-06T18:09:09.192Z', true, 2),
  ('dc6db9e4-c96d-4dc1-bc13-10429af70a76', '8b7ce14b-6487-4d08-8d04-94b7d0586f15', 'package', '8 sessions', null, 8, 120000, 'QAR', '2027-09-06T18:09:09.192Z', true, 3),
  ('58c1de44-fc46-465c-a635-399f194e5f02', '1517be53-64d4-46a5-8c04-014ff805e85c', 'package', '1 session', null, 1, 20000, 'QAR', '2027-05-09T18:09:09.192Z', true, 0),
  ('e7ee8c33-5527-481c-ba68-be7ab0e393f2', '1517be53-64d4-46a5-8c04-014ff805e85c', 'package', '3 sessions', null, 3, 60000, 'QAR', '2027-05-09T18:09:09.192Z', true, 1),
  ('6614ae06-df39-4d4e-b96d-02e1ee206c69', '1517be53-64d4-46a5-8c04-014ff805e85c', 'package', '5 sessions', null, 5, 100000, 'QAR', '2027-05-09T18:09:09.192Z', true, 2),
  ('a62b7569-4f14-42f3-8b16-3d7b384c31db', '1517be53-64d4-46a5-8c04-014ff805e85c', 'package', '10 sessions', null, 10, 200000, 'QAR', '2027-05-09T18:09:09.192Z', true, 3),
  ('97d353ec-28d4-4383-851b-9fd6ca7c3b4d', 'd8ceb7ca-2104-4d41-91a5-00a1660833bf', 'package', '1 session', null, 1, 15000, 'QAR', '2027-04-09T18:09:09.192Z', true, 0),
  ('105ffe86-0a2e-4fad-a186-9e531cabde4e', 'd8ceb7ca-2104-4d41-91a5-00a1660833bf', 'package', '3 sessions', null, 3, 45000, 'QAR', '2027-04-09T18:09:09.192Z', true, 1),
  ('9bf8cadb-4104-4e6e-88ec-7d5a2e722cc6', 'd8ceb7ca-2104-4d41-91a5-00a1660833bf', 'package', '5 sessions', null, 5, 75000, 'QAR', '2027-04-09T18:09:09.192Z', true, 2),
  ('42070327-8d4e-4a6d-9a68-cc1a378865c9', '3aceb184-0308-4c7b-9c4c-c116800c425b', 'package', '1 session', null, 1, 25000, 'QAR', '2027-06-18T18:09:09.192Z', true, 0),
  ('9f002ca8-60a1-4a6d-abe0-fc93b943bbb1', '3aceb184-0308-4c7b-9c4c-c116800c425b', 'package', '3 sessions', null, 3, 75000, 'QAR', '2027-06-18T18:09:09.192Z', true, 1),
  ('d4ba78ff-5780-431f-9459-41c32982e2fc', '3aceb184-0308-4c7b-9c4c-c116800c425b', 'package', '5 sessions', null, 5, 125000, 'QAR', '2027-06-18T18:09:09.192Z', true, 2),
  ('b6b3a259-41e4-4515-94e3-51ba7fcecf30', '5500f6a0-3313-48cb-8da0-1ba7a4ffd4fd', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-04-09T18:09:09.192Z', true, 0),
  ('27328dd6-4271-420b-a694-a1008c66853e', '5500f6a0-3313-48cb-8da0-1ba7a4ffd4fd', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-04-09T18:09:09.192Z', true, 1),
  ('4c35b429-b605-464f-9d71-57283ac8ce33', '5500f6a0-3313-48cb-8da0-1ba7a4ffd4fd', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-04-09T18:09:09.192Z', true, 2),
  ('219105b6-e781-4e21-9b1a-09a7eb3f78ec', '5500f6a0-3313-48cb-8da0-1ba7a4ffd4fd', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-04-09T18:09:09.192Z', true, 3),
  ('6e0153d5-4afb-4eb2-b3bc-d26b2ce47f75', 'a785d21b-e9a1-4b8b-adfa-4d5f7e788e76', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-03-30T18:09:09.192Z', true, 0),
  ('117b9bc7-fd6c-4bbb-8901-5a1557cf6386', 'a785d21b-e9a1-4b8b-adfa-4d5f7e788e76', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-03-30T18:09:09.192Z', true, 1),
  ('89c5c930-b00e-4e1c-a7c9-354b4225c7c4', 'a785d21b-e9a1-4b8b-adfa-4d5f7e788e76', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-03-30T18:09:09.192Z', true, 2),
  ('5aa4ca5d-023a-41df-92ba-02571cd4225f', 'a785d21b-e9a1-4b8b-adfa-4d5f7e788e76', 'denomination', 'QAR 400.00', 40000, null, 40000, 'QAR', '2027-03-30T18:09:09.192Z', true, 3),
  ('46670ee6-cd28-4909-aeff-d8c0e45e5d29', '2f98ef42-0b71-4c98-a972-96cd3a16e733', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-04-19T18:09:09.192Z', true, 0),
  ('901874d6-0c81-4356-8ca7-e9e2ce8a46d7', '2f98ef42-0b71-4c98-a972-96cd3a16e733', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-04-19T18:09:09.192Z', true, 1),
  ('08804aca-f866-4622-834b-5494f0e98429', '2f98ef42-0b71-4c98-a972-96cd3a16e733', 'denomination', 'QAR 350.00', 35000, null, 35000, 'QAR', '2027-04-19T18:09:09.192Z', true, 2),
  ('cc0aaf0e-4458-4a52-bb0a-47a2a0b1f902', '2f98ef42-0b71-4c98-a972-96cd3a16e733', 'denomination', 'QAR 500.00', 50000, null, 50000, 'QAR', '2027-04-19T18:09:09.192Z', true, 3),
  ('a77979da-c9cf-4685-9d46-7eb9b0830e81', 'b22aeb9c-eb87-42d1-8ecd-1ebb33720712', 'denomination', 'QAR 75.00', 7500, null, 7500, 'QAR', '2027-03-20T18:09:09.192Z', true, 0),
  ('2911147e-8cb1-4b95-b2aa-1d129605628b', 'b22aeb9c-eb87-42d1-8ecd-1ebb33720712', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-03-20T18:09:09.192Z', true, 1),
  ('8e930054-06ee-4e6f-8733-5eb5b397af6b', 'b22aeb9c-eb87-42d1-8ecd-1ebb33720712', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-03-20T18:09:09.192Z', true, 2),
  ('0afdfff8-b142-412b-83e8-b17485204494', 'b22aeb9c-eb87-42d1-8ecd-1ebb33720712', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-03-20T18:09:09.192Z', true, 3),
  ('3f4e19d3-a56b-4978-b985-93a5a7848393', 'fb1eba99-75be-4372-b1c5-7cf8f5022d2b', 'denomination', 'QAR 25.00', 2500, null, 2500, 'QAR', '2027-11-10T18:09:09.192Z', true, 0),
  ('43261b50-aa5c-40fa-80b3-151b9087572a', 'fb1eba99-75be-4372-b1c5-7cf8f5022d2b', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-11-10T18:09:09.192Z', true, 1),
  ('a22e78b8-5f50-47e0-99c2-4b7516c96496', 'fb1eba99-75be-4372-b1c5-7cf8f5022d2b', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-11-10T18:09:09.192Z', true, 2),
  ('6e06c633-0c4d-465b-9cc2-8267e71a20b1', 'fb1eba99-75be-4372-b1c5-7cf8f5022d2b', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-11-10T18:09:09.192Z', true, 3),
  ('b07d8633-12ad-4101-9a86-12728e637f8b', '02155264-9642-42cc-a583-c0d7ef749cef', 'denomination', 'QAR 25.00', 2500, null, 2500, 'QAR', '2027-11-10T18:09:09.192Z', true, 0),
  ('c6f60391-12c1-4bb1-9409-4ad653ec2857', '02155264-9642-42cc-a583-c0d7ef749cef', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-11-10T18:09:09.192Z', true, 1),
  ('ef276731-7632-4f0c-aca9-2ca490435c3f', '02155264-9642-42cc-a583-c0d7ef749cef', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-11-10T18:09:09.192Z', true, 2),
  ('68169c65-dd8b-4195-88e3-b86232316e52', '02155264-9642-42cc-a583-c0d7ef749cef', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-11-10T18:09:09.192Z', true, 3),
  ('3afb6c3b-8f7f-4663-82e7-02c850e4262a', '99377a9f-862c-4a78-b234-0e4c63b36529', 'denomination', 'QAR 50.00', 5000, null, 5000, 'QAR', '2027-05-29T18:09:09.192Z', true, 0),
  ('16694dff-65ea-48c2-9102-1aebbd6990c6', '99377a9f-862c-4a78-b234-0e4c63b36529', 'denomination', 'QAR 75.00', 7500, null, 7500, 'QAR', '2027-05-29T18:09:09.192Z', true, 1),
  ('0c2332e1-5a89-4747-a6cf-fb885cf5d362', '99377a9f-862c-4a78-b234-0e4c63b36529', 'denomination', 'QAR 120.00', 12000, null, 12000, 'QAR', '2027-05-29T18:09:09.192Z', true, 2),
  ('96356188-dc2a-4baf-a38e-a0d163011f4d', '99377a9f-862c-4a78-b234-0e4c63b36529', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-05-29T18:09:09.192Z', true, 3),
  ('4e24e62a-f592-4e70-99a8-e2146157770b', 'd76d20ff-d08d-401f-a21e-d009e89d3ea3', 'package', '1 session', null, 1, 5000, 'QAR', '2027-03-10T18:09:09.192Z', true, 0),
  ('9e6b28d6-8cc3-448a-ab43-d5c9b2ec482d', 'd76d20ff-d08d-401f-a21e-d009e89d3ea3', 'package', '3 sessions', null, 3, 15000, 'QAR', '2027-03-10T18:09:09.192Z', true, 1),
  ('4ead1b74-1683-4334-a0b3-0637cd0b0116', 'd76d20ff-d08d-401f-a21e-d009e89d3ea3', 'package', '5 sessions', null, 5, 25000, 'QAR', '2027-03-10T18:09:09.192Z', true, 2),
  ('f1885f18-7820-4f4b-a428-f8b37b593119', 'f2aa360a-8c73-4b1a-9539-64341941cafd', 'package', '1 session', null, 1, 20000, 'QAR', '2027-12-15T18:09:09.192Z', true, 0),
  ('86130bdd-3f1b-4e9a-93e5-912ccfdaa030', 'f2aa360a-8c73-4b1a-9539-64341941cafd', 'package', '3 sessions', null, 3, 60000, 'QAR', '2027-12-15T18:09:09.192Z', true, 1),
  ('82e16149-28dc-4d70-944e-17c2db59245c', 'f2aa360a-8c73-4b1a-9539-64341941cafd', 'package', '5 sessions', null, 5, 100000, 'QAR', '2027-12-15T18:09:09.192Z', true, 2),
  ('200a015a-ba6c-4c68-b389-5d1da292c53a', 'e479667d-cf1b-4621-8293-ed42d2230289', 'package', '1 session', null, 1, 25000, 'QAR', '2027-11-05T18:09:09.192Z', true, 0),
  ('a5c2bfb8-b709-4970-9d92-653957e0c8b3', 'e479667d-cf1b-4621-8293-ed42d2230289', 'package', '3 sessions', null, 3, 75000, 'QAR', '2027-11-05T18:09:09.192Z', true, 1),
  ('e0a15fbb-4617-4f8d-8497-6cd0e506ce77', 'e479667d-cf1b-4621-8293-ed42d2230289', 'package', '5 sessions', null, 5, 125000, 'QAR', '2027-11-05T18:09:09.192Z', true, 2),
  ('fac7efc6-6af4-40b8-8a52-06ff898e6e59', '5958693d-75e9-4f23-97e7-1af04df4629f', 'package', '1 session', null, 1, 30000, 'QAR', '2027-11-05T18:09:09.192Z', true, 0),
  ('f2c56e50-1b30-4d28-a919-255b073f9bd7', '5958693d-75e9-4f23-97e7-1af04df4629f', 'package', '3 sessions', null, 3, 90000, 'QAR', '2027-11-05T18:09:09.192Z', true, 1),
  ('da54432d-bf97-4c6c-8426-01dde4a577af', '5958693d-75e9-4f23-97e7-1af04df4629f', 'package', '5 sessions', null, 5, 150000, 'QAR', '2027-11-05T18:09:09.192Z', true, 2),
  ('e3fafb22-754e-4763-9986-32b771b3ff93', 'b243c33a-29fa-497e-a20d-24d21475360b', 'package', '1 session', null, 1, 50000, 'QAR', '2027-12-15T18:09:09.192Z', true, 0),
  ('563baffa-d46a-45f6-abb2-e7b023f1653e', 'b243c33a-29fa-497e-a20d-24d21475360b', 'package', '3 sessions', null, 3, 150000, 'QAR', '2027-12-15T18:09:09.192Z', true, 1),
  ('0a69360e-cbab-44a0-9b51-14076bb61177', 'b243c33a-29fa-497e-a20d-24d21475360b', 'package', '5 sessions', null, 5, 250000, 'QAR', '2027-12-15T18:09:09.192Z', true, 2),
  ('e6179402-ebb8-4018-9727-5cc0e81c7e0f', '74afe13e-f1c7-4a31-afbe-f283e1b9e92d', 'package', '1 session', null, 1, 15000, 'QAR', '2027-05-09T18:09:09.192Z', true, 0),
  ('15d17113-a581-4692-a63f-a7aa65558b2f', '74afe13e-f1c7-4a31-afbe-f283e1b9e92d', 'package', '3 sessions', null, 3, 45000, 'QAR', '2027-05-09T18:09:09.192Z', true, 1),
  ('99417d0e-117e-4e46-9a38-eadf603ddec8', '74afe13e-f1c7-4a31-afbe-f283e1b9e92d', 'package', '5 sessions', null, 5, 75000, 'QAR', '2027-05-09T18:09:09.192Z', true, 2),
  ('5fe38d65-a4bd-4a56-9679-40e3c31ead88', '17e13801-4be7-4d49-8bb3-e643da6fd4ee', 'package', '1 session', null, 1, 15000, 'QAR', '2027-05-19T18:09:09.192Z', true, 0),
  ('3a20f3df-af9f-4547-b226-28c8b071046e', '17e13801-4be7-4d49-8bb3-e643da6fd4ee', 'package', '3 sessions', null, 3, 45000, 'QAR', '2027-05-19T18:09:09.192Z', true, 1),
  ('5ea1f1a2-599d-4ca3-957e-7a9b24a424e5', '17e13801-4be7-4d49-8bb3-e643da6fd4ee', 'package', '5 sessions', null, 5, 75000, 'QAR', '2027-05-19T18:09:09.192Z', true, 2),
  ('345cae02-6033-45c9-842f-bada6833fe49', 'f428b136-2465-4ac8-810c-f1e14621523b', 'package', '1 session', null, 1, 20000, 'QAR', '2027-05-29T18:09:09.192Z', true, 0),
  ('49afd404-ec8d-49ad-b0ba-ad4dce76bb24', 'f428b136-2465-4ac8-810c-f1e14621523b', 'package', '3 sessions', null, 3, 60000, 'QAR', '2027-05-29T18:09:09.192Z', true, 1),
  ('810f8038-277c-41d4-86cd-0a459918dd24', 'f428b136-2465-4ac8-810c-f1e14621523b', 'package', '5 sessions', null, 5, 100000, 'QAR', '2027-05-29T18:09:09.192Z', true, 2),
  ('8a1da0bd-9dc3-4813-b244-f8e8e128fe57', 'efc96a17-726f-42d9-a4ff-1f73fe59168f', 'package', '1 session', null, 1, 40000, 'QAR', '2027-07-18T18:09:09.192Z', true, 0),
  ('8913e840-b1fb-451b-a2ad-4e9f23d2ff3e', 'efc96a17-726f-42d9-a4ff-1f73fe59168f', 'package', '3 sessions', null, 3, 120000, 'QAR', '2027-07-18T18:09:09.192Z', true, 1),
  ('56d377bb-529c-4d14-a2b5-2ce46a359caa', 'efc96a17-726f-42d9-a4ff-1f73fe59168f', 'package', '5 sessions', null, 5, 200000, 'QAR', '2027-07-18T18:09:09.192Z', true, 2),
  ('aef83c42-060c-47d2-9ddc-f89345f69d06', 'e858f76c-0676-4061-961e-46d0aa91c144', 'package', '1 session', null, 1, 120000, 'QAR', '2027-07-08T18:09:09.192Z', true, 0),
  ('6557790a-5aa7-4e03-a030-29571a41ad68', 'e858f76c-0676-4061-961e-46d0aa91c144', 'package', '3 sessions', null, 3, 360000, 'QAR', '2027-07-08T18:09:09.192Z', true, 1),
  ('d7871730-0134-417b-a6d9-9a6ce5f790e6', 'e858f76c-0676-4061-961e-46d0aa91c144', 'package', '5 sessions', null, 5, 600000, 'QAR', '2027-07-08T18:09:09.192Z', true, 2),
  ('b15eaf64-9490-4c59-b3dc-6872efe05d43', 'ab59d193-fa9d-4764-910d-0903eb9042ce', 'package', '1 session', null, 1, 90000, 'QAR', '2027-07-08T18:09:09.192Z', true, 0),
  ('2d09e7fe-8f6e-4a06-9cb4-b1b1c0b96459', 'ab59d193-fa9d-4764-910d-0903eb9042ce', 'package', '3 sessions', null, 3, 270000, 'QAR', '2027-07-08T18:09:09.192Z', true, 1),
  ('c26d32c0-f961-47f6-bdf3-667634b3de2f', 'ab59d193-fa9d-4764-910d-0903eb9042ce', 'package', '5 sessions', null, 5, 450000, 'QAR', '2027-07-08T18:09:09.192Z', true, 2),
  ('1615f530-9155-4ca7-9c09-e29bb5ad2199', '26114bd9-3730-4dc8-b045-d66dfe806841', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-05-09T18:09:09.192Z', true, 0),
  ('061c77e4-a0e4-4e79-b241-1ccb90b41e86', '26114bd9-3730-4dc8-b045-d66dfe806841', 'denomination', 'QAR 350.00', 35000, null, 35000, 'QAR', '2027-05-09T18:09:09.192Z', true, 1),
  ('8ad8326c-10cd-4c04-9a74-4633ce4e72d8', '26114bd9-3730-4dc8-b045-d66dfe806841', 'denomination', 'QAR 500.00', 50000, null, 50000, 'QAR', '2027-05-09T18:09:09.192Z', true, 2),
  ('597deece-43d8-4728-a5c3-d977b240b3dc', '26114bd9-3730-4dc8-b045-d66dfe806841', 'denomination', 'QAR 600.00', 60000, null, 60000, 'QAR', '2027-05-09T18:09:09.192Z', true, 3),
  ('84751edc-d5ed-432f-a876-094cbb77e224', '1afce2f7-66bb-4306-a680-f31a10323784', 'package', '1 session', null, 1, 150000, 'QAR', '2027-09-06T18:09:09.192Z', true, 0),
  ('8063c999-8e28-457a-9102-c8eec2909748', '1afce2f7-66bb-4306-a680-f31a10323784', 'package', '3 sessions', null, 3, 450000, 'QAR', '2027-09-06T18:09:09.192Z', true, 1),
  ('f0ce9612-0c3f-4fc9-8363-6dc46ba87f43', '1afce2f7-66bb-4306-a680-f31a10323784', 'package', '5 sessions', null, 5, 750000, 'QAR', '2027-09-06T18:09:09.192Z', true, 2),
  ('b61fcfd0-e25a-458e-b4b5-499fad094006', '94aaaca7-c385-42a1-a690-53205f84d19b', 'denomination', 'QAR 30.00', 3000, null, 3000, 'QAR', '2027-11-10T18:09:09.192Z', true, 0),
  ('6140d243-84d6-464f-9685-c64340a49eb0', '94aaaca7-c385-42a1-a690-53205f84d19b', 'denomination', 'QAR 60.00', 6000, null, 6000, 'QAR', '2027-11-10T18:09:09.192Z', true, 1),
  ('2d15deaf-df1a-4d9f-9e07-c87a87aef165', '94aaaca7-c385-42a1-a690-53205f84d19b', 'denomination', 'QAR 120.00', 12000, null, 12000, 'QAR', '2027-11-10T18:09:09.192Z', true, 2),
  ('3a9f1ee7-4672-47fe-b260-50ba07913c22', '94aaaca7-c385-42a1-a690-53205f84d19b', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-11-10T18:09:09.192Z', true, 3),
  ('66320db6-5afa-46dd-a805-a65515b57756', '4b0fe9e2-c57a-4b29-8dc6-390c8f509dbb', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-05-29T18:09:09.192Z', true, 0),
  ('833bcd4b-10a4-409e-a3d0-39207795cd3c', '4b0fe9e2-c57a-4b29-8dc6-390c8f509dbb', 'denomination', 'QAR 175.00', 17500, null, 17500, 'QAR', '2027-05-29T18:09:09.192Z', true, 1),
  ('514c0443-393a-415e-8af8-4c706a8704b3', '4b0fe9e2-c57a-4b29-8dc6-390c8f509dbb', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-05-29T18:09:09.192Z', true, 2),
  ('04387d58-0140-4f40-bae0-8d2ddca5e286', '4b0fe9e2-c57a-4b29-8dc6-390c8f509dbb', 'denomination', 'QAR 450.00', 45000, null, 45000, 'QAR', '2027-05-29T18:09:09.192Z', true, 3),
  ('7307d3ca-8f6a-41e3-b9b3-9cf1b00b91c8', '58d236e7-279d-48ae-8d37-0081abaa6a46', 'denomination', 'QAR 75.00', 7500, null, 7500, 'QAR', '2027-06-18T18:09:09.192Z', true, 0),
  ('50dd808f-5e08-42d9-811a-c20d9fd1717e', '58d236e7-279d-48ae-8d37-0081abaa6a46', 'denomination', 'QAR 120.00', 12000, null, 12000, 'QAR', '2027-06-18T18:09:09.192Z', true, 1),
  ('f50efa19-3cfd-48a7-8586-05695defc886', '58d236e7-279d-48ae-8d37-0081abaa6a46', 'denomination', 'QAR 180.00', 18000, null, 18000, 'QAR', '2027-06-18T18:09:09.192Z', true, 2),
  ('511b376f-3da0-4e40-a424-36c8c7a6b0c4', '58d236e7-279d-48ae-8d37-0081abaa6a46', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-06-18T18:09:09.192Z', true, 3),
  ('a95ce4a2-b33c-405b-928a-f2f01f3f2e72', 'ac46bd6d-6c55-4013-8d5f-8388b0bb49c0', 'denomination', 'QAR 60.00', 6000, null, 6000, 'QAR', '2027-04-09T18:09:09.192Z', true, 0),
  ('45ec1ea4-f542-4b64-a902-3702171e9455', 'ac46bd6d-6c55-4013-8d5f-8388b0bb49c0', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-04-09T18:09:09.192Z', true, 1),
  ('25af5e8c-d05a-4fc1-8f3f-6631ff6fc2f3', 'ac46bd6d-6c55-4013-8d5f-8388b0bb49c0', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-04-09T18:09:09.192Z', true, 2),
  ('e8612e23-ddb3-40ec-be51-2dc734a588d7', 'ac46bd6d-6c55-4013-8d5f-8388b0bb49c0', 'denomination', 'QAR 250.00', 25000, null, 25000, 'QAR', '2027-04-09T18:09:09.192Z', true, 3),
  ('2f896113-1154-47b3-a1de-118fde82efab', '8883b413-3483-4077-836a-67c63c73161d', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-09-06T18:09:09.192Z', true, 0),
  ('f6901c85-ada1-44c3-b2ac-2d17e24435d3', '8883b413-3483-4077-836a-67c63c73161d', 'denomination', 'QAR 200.00', 20000, null, 20000, 'QAR', '2027-09-06T18:09:09.192Z', true, 1),
  ('db9b0e6e-6d1c-4db8-94e7-8ac045dd7ec8', '8883b413-3483-4077-836a-67c63c73161d', 'denomination', 'QAR 500.00', 50000, null, 50000, 'QAR', '2027-09-06T18:09:09.192Z', true, 2),
  ('a10950db-33c4-4617-b474-504bdedd7eba', '8883b413-3483-4077-836a-67c63c73161d', 'denomination', 'QAR 800.00', 80000, null, 80000, 'QAR', '2027-09-06T18:09:09.192Z', true, 3),
  ('16f11d13-b701-4fef-b8ae-4b95bb4c11b9', 'f9cf1b26-42f3-45df-9e59-c7bf6f50a006', 'denomination', 'QAR 150.00', 15000, null, 15000, 'QAR', '2027-09-06T18:09:09.192Z', true, 0),
  ('9d63c01f-e511-48f6-a7d5-517376b9476f', 'f9cf1b26-42f3-45df-9e59-c7bf6f50a006', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-09-06T18:09:09.192Z', true, 1),
  ('c0d6e78d-6ff8-4134-a781-0542bf31026e', 'f9cf1b26-42f3-45df-9e59-c7bf6f50a006', 'denomination', 'QAR 600.00', 60000, null, 60000, 'QAR', '2027-09-06T18:09:09.192Z', true, 2),
  ('8254c44f-b5bf-4be0-89fb-d10d72873ce3', 'f9cf1b26-42f3-45df-9e59-c7bf6f50a006', 'denomination', 'QAR 900.00', 90000, null, 90000, 'QAR', '2027-09-06T18:09:09.192Z', true, 3),
  ('ee4ac614-3e1b-4fb2-8aca-b0bfecdb40a0', '7925f484-8f54-49c8-9f18-239d79a45b18', 'denomination', 'QAR 100.00', 10000, null, 10000, 'QAR', '2027-08-17T18:09:09.192Z', true, 0),
  ('4c04e88c-dcce-4f91-9e1a-d27ff0d2dea1', '7925f484-8f54-49c8-9f18-239d79a45b18', 'denomination', 'QAR 175.00', 17500, null, 17500, 'QAR', '2027-08-17T18:09:09.192Z', true, 1),
  ('64a9b3fc-70b2-4ca5-a1a4-de688d5eeaab', '7925f484-8f54-49c8-9f18-239d79a45b18', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-08-17T18:09:09.192Z', true, 2),
  ('c7ec91ea-1eb3-4030-a89c-22133582415f', '7925f484-8f54-49c8-9f18-239d79a45b18', 'denomination', 'QAR 500.00', 50000, null, 50000, 'QAR', '2027-08-17T18:09:09.192Z', true, 3),
  ('12a584f6-6547-4f07-b182-1e799fd1061c', '37f0c6e1-0786-436d-aa1f-3c3f268e42df', 'denomination', 'QAR 300.00', 30000, null, 30000, 'QAR', '2027-09-26T18:09:09.192Z', true, 0),
  ('e2860663-8bb3-4283-9764-b9d7a0ac9b05', '37f0c6e1-0786-436d-aa1f-3c3f268e42df', 'denomination', 'QAR 600.00', 60000, null, 60000, 'QAR', '2027-09-26T18:09:09.192Z', true, 1),
  ('eaa48865-6661-4434-bf53-f4ce61b4d0c4', '37f0c6e1-0786-436d-aa1f-3c3f268e42df', 'denomination', 'QAR 900.00', 90000, null, 90000, 'QAR', '2027-09-26T18:09:09.192Z', true, 2),
  ('63e2db59-66c9-4041-a1bd-be6ab46b29c4', '37f0c6e1-0786-436d-aa1f-3c3f268e42df', 'denomination', 'QAR 1200.00', 120000, null, 120000, 'QAR', '2027-09-26T18:09:09.192Z', true, 3),
  ('6e3948ef-f7a4-4842-b16e-5e7db7b22204', 'fd744a39-6265-4970-9888-db8b64144a2d', 'package', '1 session', null, 1, 60000, 'QAR', '2027-09-06T18:09:09.192Z', true, 0),
  ('cdb9e4f0-502d-4fd2-8546-c70d9cf84ab2', 'fd744a39-6265-4970-9888-db8b64144a2d', 'package', '3 sessions', null, 3, 180000, 'QAR', '2027-09-06T18:09:09.192Z', true, 1),
  ('217930e1-1537-4888-a97b-42cc920994d9', 'fd744a39-6265-4970-9888-db8b64144a2d', 'package', '5 sessions', null, 5, 300000, 'QAR', '2027-09-06T18:09:09.192Z', true, 2);

insert into public.recipients (id, customer_id, name, email, phone, relation) values
  ('ff0242d1-70dd-4013-a7d3-0452585f2b80', '11111111-1111-4111-8111-111111111111', 'Layla Hassan', 'layla@example.com', '+974 5555 0101', 'Sister'),
  ('bf2d0b92-cd30-4d85-9c18-24687daf6371', '11111111-1111-4111-8111-111111111111', 'Omar Ali', 'omar@example.com', '+974 5555 0202', 'Friend'),
  ('d403916e-bd0a-4096-9fed-9489cb80c331', '11111111-1111-4111-8111-111111111111', 'Sara Ahmed', 'sara@example.com', '+974 5555 0303', 'Colleague'),
  ('2616a0cd-3257-4d5d-83e1-97cf77ff8979', '11111111-1111-4111-8111-111111111111', 'Ahmed Khalid', 'ahmed@example.com', '+974 5555 0404', 'Brother');

insert into public.favourites (id, customer_id, vendor_id, product_id) values
  ('4dd66813-7627-4eb3-822f-7cb9dec11d69', '11111111-1111-4111-8111-111111111111', null, 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f'),
  ('d48fcd81-157a-43dc-beb0-5f47c166169e', '11111111-1111-4111-8111-111111111111', null, 'c492cf10-a6fa-47a3-8bf6-f728303fc386'),
  ('0d268bd0-3203-410d-900c-b53d3f40f031', '11111111-1111-4111-8111-111111111111', null, '0fd29e1d-4794-489d-bceb-b42b52316979');

insert into public.notification_preferences (user_id)
select '11111111-1111-4111-8111-111111111111' on conflict do nothing;

-- ---------------------------------------------------------------------
-- Orders, order items, vouchers and the append-only ledger
-- ---------------------------------------------------------------------
insert into public.orders (
  id, order_ref, buyer_id, status, currency, subtotal_minor, discount_minor, fee_minor,
  total_minor, sender_name, gift_message, delivery_method, payment_status,
  payment_provider, payment_reference, paid_at, created_at
) values
  ('ee7e2424-161a-48ba-ac59-bfb4d393f758', 'ORD-1000', '11111111-1111-4111-8111-111111111111', 'paid', 'QAR', 20000, 0, 0, 20000, 'Demo Customer', 'Enjoy a coffee on me', 'email', 'paid', 'demo', 'MF-DEMO-1001', '2026-11-05T18:09:09.192Z', '2026-11-05T18:09:09.192Z'),
  ('3e3d09b7-5abb-41b5-ad66-5cdc0b9f8e83', 'ORD-1001', '11111111-1111-4111-8111-111111111111', 'paid', 'QAR', 50000, 0, 0, 50000, 'Demo Customer', 'A little calm for you.', 'email', 'paid', 'demo', 'MF-DEMO-1002', '2026-11-09T18:09:09.192Z', '2026-11-09T18:09:09.192Z'),
  ('524607da-420c-4941-bb22-7ab0368342ca', 'ORD-1002', '11111111-1111-4111-8111-111111111111', 'paid', 'QAR', 10000, 0, 0, 10000, 'Demo Customer', 'You deserve a treat.', 'email', 'paid', 'demo', 'MF-DEMO-1003', '2026-11-01T18:09:09.192Z', '2026-11-01T18:09:09.192Z'),
  ('1bf54457-1b71-42a6-b644-5173c48bceef', 'ORD-1003', '11111111-1111-4111-8111-111111111111', 'paid', 'QAR', 15000, 0, 0, 15000, 'Demo Customer', 'Movie night!', 'email', 'paid', 'demo', 'MF-DEMO-1004', '2026-10-19T18:09:09.192Z', '2026-10-19T18:09:09.192Z');

insert into public.order_items (
  id, order_id, product_id, product_variant_id, vendor_id, quantity, unit_price_minor,
  total_minor, commission_minor, vendor_share_minor, currency, gift_message,
  recipient_name, recipient_email, recipient_phone, delivery_method, scheduled_for, created_at
) values
  ('10005d1c-c8b7-4b1a-83bd-9286ccbfdb6c', 'ee7e2424-161a-48ba-ac59-bfb4d393f758', 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f', '4a9a098d-ae7e-4e1a-ac25-9ed517233670', '58852d5f-8486-42fa-a423-b199925159b0', 1, 20000, 20000, 2000, 18000, 'QAR', 'Enjoy a coffee on me', 'Layla', 'layla@example.com', null, 'email', null, '2026-11-05T18:09:09.192Z'),
  ('fddcc410-f9f3-4e5c-b770-1b557b4a71fd', '3e3d09b7-5abb-41b5-ad66-5cdc0b9f8e83', 'e686e08e-a042-49ba-92ee-3f534a0a8033', '16633a99-65a6-4550-b10f-bb75310645c0', '2533ec89-f5b1-4409-9273-c87bf133d095', 1, 50000, 50000, 5000, 45000, 'QAR', 'A little calm for you.', 'Omar', 'omar@example.com', null, 'email', null, '2026-11-09T18:09:09.192Z'),
  ('15cb8c1e-8c51-4334-aca9-72dc3ac75e8a', '524607da-420c-4941-bb22-7ab0368342ca', '5eb2cf13-afd0-4cfc-8822-f31ccc3cbb89', 'c5cd38ce-f72c-4c1b-8d07-417a305727dd', 'b11ee824-7866-4b02-abcd-08bc5e077018', 1, 10000, 10000, 1000, 9000, 'QAR', 'You deserve a treat.', 'Sara', 'sara@example.com', null, 'email', null, '2026-11-01T18:09:09.192Z'),
  ('775eb3c1-0631-43c7-b3fe-1878b976f6cb', '1bf54457-1b71-42a6-b644-5173c48bceef', '5500f6a0-3313-48cb-8da0-1ba7a4ffd4fd', 'b6b3a259-41e4-4515-94e3-51ba7fcecf30', '128ee37e-7489-47ae-95e8-6011db656ee2', 1, 15000, 15000, 1500, 13500, 'QAR', 'Movie night!', 'Ahmed', 'ahmed@example.com', null, 'email', null, '2026-10-19T18:09:09.192Z');

insert into public.vouchers (
  id, voucher_code, qr_payload, product_id, product_variant_id, vendor_id, order_item_id,
  buyer_id, recipient_name, recipient_email, recipient_phone, fulfilment_type, status,
  initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions,
  used_sessions, currency, expires_at, claimed_by, claimed_at, delivery_status,
  scheduled_for, gift_message, created_at, updated_at
) values
  ('2ed5a24c-32f9-4560-a149-4d03dbe90d7a', 'GFT-2ED5A2', 'giftly:redeem:GFT-2ED5A2', 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f', '4a9a098d-ae7e-4e1a-ac25-9ed517233670', '58852d5f-8486-42fa-a423-b199925159b0', '10005d1c-c8b7-4b1a-83bd-9286ccbfdb6c', '11111111-1111-4111-8111-111111111111', 'Layla', 'layla@example.com', 'layla@example.com', 'monetary', 'claimed', 20000, 14500, null, null, 0, 'QAR', '2027-11-10T18:09:09.192Z', '11111111-1111-4111-8111-111111111111', '2026-11-07T18:09:09.192Z', 'opened', null, 'Enjoy a coffee on me', '2026-11-05T18:09:09.192Z', '2026-11-05T18:09:09.192Z'),
  ('f9f1bf1c-2314-4b79-95d0-18432fe8c224', 'GFT-F9F1BF', 'giftly:redeem:GFT-F9F1BF', 'e686e08e-a042-49ba-92ee-3f534a0a8033', '16633a99-65a6-4550-b10f-bb75310645c0', '2533ec89-f5b1-4409-9273-c87bf133d095', 'fddcc410-f9f3-4e5c-b770-1b557b4a71fd', '11111111-1111-4111-8111-111111111111', 'Omar', 'omar@example.com', 'omar@example.com', 'experience', 'claimed', 50000, null, 1, 1, 0, 'QAR', '2027-05-09T18:09:09.192Z', '11111111-1111-4111-8111-111111111111', '2026-11-09T18:09:09.192Z', 'delivered', null, 'A little calm for you.', '2026-11-09T18:09:09.192Z', '2026-11-09T18:09:09.192Z'),
  ('d91c25df-a567-4102-91a5-e044eb3c5c86', 'GFT-D91C25', 'giftly:redeem:GFT-D91C25', '5eb2cf13-afd0-4cfc-8822-f31ccc3cbb89', 'c5cd38ce-f72c-4c1b-8d07-417a305727dd', 'b11ee824-7866-4b02-abcd-08bc5e077018', '15cb8c1e-8c51-4334-aca9-72dc3ac75e8a', '11111111-1111-4111-8111-111111111111', 'Sara', 'sara@example.com', 'sara@example.com', 'monetary', 'claimed', 10000, 8000, null, null, 0, 'QAR', '2027-05-29T18:09:09.192Z', '11111111-1111-4111-8111-111111111111', '2026-11-02T18:09:09.192Z', 'opened', null, 'You deserve a treat.', '2026-11-01T18:09:09.192Z', '2026-11-01T18:09:09.192Z'),
  ('cdaa4695-ccb7-4a49-a5b5-ad2db5bd165f', 'GFT-CDAA46', 'giftly:redeem:GFT-CDAA46', '5500f6a0-3313-48cb-8da0-1ba7a4ffd4fd', 'b6b3a259-41e4-4515-94e3-51ba7fcecf30', '128ee37e-7489-47ae-95e8-6011db656ee2', '775eb3c1-0631-43c7-b3fe-1878b976f6cb', '11111111-1111-4111-8111-111111111111', 'Ahmed', 'ahmed@example.com', 'ahmed@example.com', 'monetary', 'claimed', 15000, 0, null, null, 0, 'QAR', '2027-04-09T18:09:09.192Z', '11111111-1111-4111-8111-111111111111', '2026-10-21T18:09:09.192Z', 'opened', null, 'Movie night!', '2026-10-19T18:09:09.192Z', '2026-10-19T18:09:09.192Z');

insert into public.ledger_entries (id, voucher_id, order_id, entry_type, amount_minor, sessions, created_at) values
  ('b1898e4c-a9dd-41a5-8519-03318dd94d5f', '2ed5a24c-32f9-4560-a149-4d03dbe90d7a', 'ee7e2424-161a-48ba-ac59-bfb4d393f758', 'issue', 20000, 0, '2026-11-05T18:09:09.192Z'),
  ('e394d859-e036-4f31-8ecf-06c1699f097a', '2ed5a24c-32f9-4560-a149-4d03dbe90d7a', null, 'redeem', -5500, 0, '2026-11-05T18:09:09.192Z'),
  ('33d1ed2b-d721-4081-8c2c-58f9be9e394b', 'f9f1bf1c-2314-4b79-95d0-18432fe8c224', '3e3d09b7-5abb-41b5-ad66-5cdc0b9f8e83', 'issue', 50000, 1, '2026-11-09T18:09:09.192Z'),
  ('a69df453-4b13-4116-81c2-af1fac34ab67', 'd91c25df-a567-4102-91a5-e044eb3c5c86', '524607da-420c-4941-bb22-7ab0368342ca', 'issue', 10000, 0, '2026-11-01T18:09:09.192Z'),
  ('2d3544aa-8d67-4925-8460-b6ebf9fece58', 'd91c25df-a567-4102-91a5-e044eb3c5c86', null, 'redeem', -2000, 0, '2026-11-01T18:09:09.192Z'),
  ('942e2ac3-2196-49c8-a02b-56ba6477db86', 'cdaa4695-ccb7-4a49-a5b5-ad2db5bd165f', '1bf54457-1b71-42a6-b644-5173c48bceef', 'issue', 15000, 0, '2026-10-19T18:09:09.192Z'),
  ('b8ebceda-4489-4e86-bb3f-62babffcacad', 'cdaa4695-ccb7-4a49-a5b5-ad2db5bd165f', null, 'redeem', -15000, 0, '2026-10-19T18:09:09.192Z');

-- Vouchers the vendor still has to serve
insert into public.vouchers (
  id, voucher_code, qr_payload, product_id, vendor_id, buyer_id, recipient_name,
  recipient_email, fulfilment_type, status, initial_value_minor, remaining_value_minor,
  total_sessions, remaining_sessions, used_sessions, currency, expires_at, claimed_by,
  claimed_at, delivery_status, gift_message, created_at, updated_at
) values
  ('f302a7f8-7509-45ac-b671-6cd28a99dce5', 'GFT-F302A7', 'giftly:redeem:GFT-F302A7', '0d6a07fa-8673-4cea-9979-d446e4263b6b', '2533ec89-f5b1-4409-9273-c87bf133d095', '72215636-34c1-4635-9479-dba62aa65c56', 'Layla', 'layla@example.com', 'experience', 'claimed', 25000, null, 1, 1, 0, 'QAR', '2027-01-09T18:09:09.192Z', '72215636-34c1-4635-9479-dba62aa65c56', '2026-11-06T18:09:09.192Z', 'opened', 'For your shoulders.', '2026-11-04T18:09:09.192Z', '2026-11-04T18:09:09.192Z'),
  ('fd8dd38f-1749-4c27-bf6d-cbbd5b162d8b', 'GFT-FD8DD3', 'giftly:redeem:GFT-FD8DD3', 'fd744a39-6265-4970-9888-db8b64144a2d', '2533ec89-f5b1-4409-9273-c87bf133d095', '131437af-94dd-46ed-b3dd-8576e10ceaba', 'Omar', 'omar@example.com', 'experience', 'claimed', 90000, null, 5, 3, 2, 'QAR', '2027-03-10T18:09:09.192Z', '131437af-94dd-46ed-b3dd-8576e10ceaba', '2026-11-01T18:09:09.192Z', 'opened', 'Five massages, no expiry pressure.', '2026-10-29T18:09:09.192Z', '2026-10-29T18:09:09.192Z'),
  ('3c44ff0a-6126-47d3-a625-d003e8efbda3', 'GFT-3C44FF', 'giftly:redeem:GFT-3C44FF', 'f428b136-2465-4ac8-810c-f1e14621523b', 'c1b1dbb8-0f25-4708-8065-00a2cbf3d36e', '29eb9902-b88e-4490-8785-737206825852', 'Noor', 'noor@example.com', 'experience', 'claimed', 35000, null, 1, 1, 0, 'QAR', '2027-01-24T18:09:09.192Z', '29eb9902-b88e-4490-8785-737206825852', '2026-11-07T18:09:09.192Z', 'opened', 'Slow down for an hour.', '2026-11-05T18:09:09.192Z', '2026-11-05T18:09:09.192Z'),
  ('2a3db8b4-f008-408e-b4af-7224488d1c38', 'GFT-2A3DB8', 'giftly:redeem:GFT-2A3DB8', '1517be53-64d4-46a5-8c04-014ff805e85c', '94666bd9-01bd-41d7-99c5-30cedea926b8', '77a7a268-c84b-42ac-a7db-e25fe395b6fe', 'Sara', 'sara@example.com', 'experience', 'claimed', 45000, null, 10, 6, 4, 'QAR', '2027-02-08T18:09:09.192Z', '77a7a268-c84b-42ac-a7db-e25fe395b6fe', '2026-10-27T18:09:09.192Z', 'opened', 'Ten classes to burn.', '2026-10-23T18:09:09.192Z', '2026-10-23T18:09:09.192Z'),
  ('5ffc2616-ecb1-423f-a9ec-a21f4f9309b0', 'GFT-5FFC26', 'giftly:redeem:GFT-5FFC26', 'e858f76c-0676-4061-961e-46d0aa91c144', '66d93941-ca8d-45f2-8af4-eea9c97d6c05', 'cdca534d-1d61-46ef-a179-13588d899a74', 'Mariam', 'mariam@example.com', 'experience', 'claimed', 120000, null, 1, 1, 0, 'QAR', '2026-12-25T18:09:09.192Z', 'cdca534d-1d61-46ef-a179-13588d899a74', '2026-11-03T18:09:09.192Z', 'opened', 'One night with a sea view.', '2026-10-31T18:09:09.192Z', '2026-10-31T18:09:09.192Z'),
  ('3b3d323c-f5a8-433f-95b0-fdf417fbb04f', 'GFT-3B3D32', 'giftly:redeem:GFT-3B3D32', '5958693d-75e9-4f23-97e7-1af04df4629f', '70456ad2-cdab-47e2-a21c-02048addfc38', '83924abf-bf07-4e7b-8d09-9313fbbba40f', 'Faris', 'faris@example.com', 'experience', 'claimed', 50000, null, 1, 1, 0, 'QAR', '2027-04-09T18:09:09.192Z', '83924abf-bf07-4e7b-8d09-9313fbbba40f', '2026-11-05T18:09:09.192Z', 'opened', 'Dunes and dinner under the stars.', '2026-11-02T18:09:09.192Z', '2026-11-02T18:09:09.192Z'),
  ('3fd25b39-d865-4e56-9041-25184a90fa11', 'GFT-3FD25B', 'giftly:redeem:GFT-3FD25B', 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f', '58852d5f-8486-42fa-a423-b199925159b0', 'c20aca36-9957-41f4-9b53-9c2a415178b4', 'Hind', 'hind@example.com', 'monetary', 'claimed', 20000, 12000, null, null, 0, 'QAR', '2027-05-29T18:09:09.192Z', 'c20aca36-9957-41f4-9b53-9c2a415178b4', '2026-10-30T18:09:09.192Z', 'opened', 'Coffee on me.', '2026-10-26T18:09:09.192Z', '2026-10-26T18:09:09.192Z'),
  ('26067525-643a-405f-acfe-7bdfbe38cb54', 'GFT-260675', 'giftly:redeem:GFT-260675', 'd9204c2f-4436-4191-b040-c088912d8b02', 'a010f419-3183-4fb5-bd38-e73ba7f51317', 'ff2c387d-ec50-4a87-bd8c-dd8b2e277828', 'Aisha', 'aisha@example.com', 'monetary', 'claimed', 30000, 25000, null, null, 0, 'QAR', '2027-04-09T18:09:09.192Z', 'ff2c387d-ec50-4a87-bd8c-dd8b2e277828', '2026-11-01T18:09:09.192Z', 'opened', 'Dinner for the family.', '2026-10-28T18:09:09.192Z', '2026-10-28T18:09:09.192Z');

insert into public.ledger_entries (id, voucher_id, order_id, entry_type, amount_minor, sessions, created_at) values
  ('b3e22cda-a1eb-408f-8872-3c07ef5d830c', 'f302a7f8-7509-45ac-b671-6cd28a99dce5', null, 'issue', 25000, 1, '2026-11-04T18:09:09.192Z'),
  ('6822fde9-0c6d-45ef-bd22-d27db379365a', 'fd8dd38f-1749-4c27-bf6d-cbbd5b162d8b', null, 'issue', 90000, 5, '2026-10-29T18:09:09.192Z'),
  ('50202637-19af-4ebf-9191-6e52b94f9375', 'fd8dd38f-1749-4c27-bf6d-cbbd5b162d8b', null, 'redeem', 0, -2, '2026-10-29T18:09:09.192Z'),
  ('76d25c96-d5c9-4e8e-bc9a-633a047a87aa', '3c44ff0a-6126-47d3-a625-d003e8efbda3', null, 'issue', 35000, 1, '2026-11-05T18:09:09.192Z'),
  ('c2e024a2-9a62-4a7e-b199-40d641e72ee8', '2a3db8b4-f008-408e-b4af-7224488d1c38', null, 'issue', 45000, 10, '2026-10-23T18:09:09.192Z'),
  ('1f199745-c467-48e1-9efb-19311a182bb4', '2a3db8b4-f008-408e-b4af-7224488d1c38', null, 'redeem', 0, -4, '2026-10-23T18:09:09.192Z'),
  ('85f2896e-6d8e-401e-b8e4-fd11e37e5880', '5ffc2616-ecb1-423f-a9ec-a21f4f9309b0', null, 'issue', 120000, 1, '2026-10-31T18:09:09.192Z'),
  ('f28dbb20-1531-4e5f-a2d0-e742c9c59c89', '3b3d323c-f5a8-433f-95b0-fdf417fbb04f', null, 'issue', 50000, 1, '2026-11-02T18:09:09.192Z'),
  ('f199acb0-a246-4224-a471-04e163ee620e', '3fd25b39-d865-4e56-9041-25184a90fa11', null, 'issue', 20000, 0, '2026-10-26T18:09:09.192Z'),
  ('7f5cd35d-a1c1-4426-8ae9-3f5014ce3e2a', '3fd25b39-d865-4e56-9041-25184a90fa11', null, 'redeem', -8000, 0, '2026-10-26T18:09:09.192Z'),
  ('5aaf5382-59a7-48a6-ae6f-c3bb287a6684', '26067525-643a-405f-acfe-7bdfbe38cb54', null, 'issue', 30000, 0, '2026-10-28T18:09:09.192Z'),
  ('df326389-67c0-4a31-95ad-081c14452755', '26067525-643a-405f-acfe-7bdfbe38cb54', null, 'redeem', -5000, 0, '2026-10-28T18:09:09.192Z');

insert into public.redemptions (
  id, reference, voucher_id, vendor_id, staff_user_id, kind, sessions, amount_minor,
  quantity, status, service_label, notes, occurred_at, created_at
) values
  ('0713b308-0350-4746-9242-2599b61e0f6c', 'RDM-SEED-0001', 'fd8dd38f-1749-4c27-bf6d-cbbd5b162d8b', '2533ec89-f5b1-4409-9273-c87bf133d095', '44444444-4444-4444-8444-444444444444', 'session', 1, null, 1, 'completed', 'Five Session Massage Pack', 'Deep tissue massage', '2026-11-04T18:09:09.192Z', '2026-11-04T18:09:09.192Z'),
  ('9ddb0e46-7750-4268-9e2a-c6a1873b1951', 'RDM-SEED-0002', 'fd8dd38f-1749-4c27-bf6d-cbbd5b162d8b', '2533ec89-f5b1-4409-9273-c87bf133d095', '44444444-4444-4444-8444-444444444444', 'session', 1, null, 1, 'completed', 'Five Session Massage Pack', 'Deep tissue massage', '2026-11-08T18:09:09.192Z', '2026-11-08T18:09:09.192Z'),
  ('667fab77-5ee2-408e-95a9-fa54dc15a455', 'RDM-SEED-0003', '2a3db8b4-f008-408e-b4af-7224488d1c38', '94666bd9-01bd-41d7-99c5-30cedea926b8', '44444444-4444-4444-8444-444444444444', 'session', 1, null, 1, 'completed', '10 Class Pass', 'Strength class', '2026-10-31T18:09:09.192Z', '2026-10-31T18:09:09.192Z'),
  ('c9323a65-2f67-4909-abec-fb0d57e942b7', 'RDM-SEED-0004', '2a3db8b4-f008-408e-b4af-7224488d1c38', '94666bd9-01bd-41d7-99c5-30cedea926b8', '44444444-4444-4444-8444-444444444444', 'session', 1, null, 1, 'completed', '10 Class Pass', 'Spin class', '2026-11-01T18:09:09.192Z', '2026-11-01T18:09:09.192Z'),
  ('768106d2-1d28-4926-9d8e-a8182c4a8e29', 'RDM-SEED-0005', '2a3db8b4-f008-408e-b4af-7224488d1c38', '94666bd9-01bd-41d7-99c5-30cedea926b8', '44444444-4444-4444-8444-444444444444', 'session', 1, null, 1, 'completed', '10 Class Pass', 'Strength class', '2026-11-02T18:09:09.192Z', '2026-11-02T18:09:09.192Z'),
  ('88a6ae54-5a01-4760-8ef6-9052ad0af540', 'RDM-SEED-0006', '2a3db8b4-f008-408e-b4af-7224488d1c38', '94666bd9-01bd-41d7-99c5-30cedea926b8', '44444444-4444-4444-8444-444444444444', 'session', 1, null, 1, 'completed', '10 Class Pass', 'Yoga class', '2026-11-05T18:09:09.192Z', '2026-11-05T18:09:09.192Z'),
  ('ce82a840-29cf-431e-8b41-56d195e30d48', 'RDM-SEED-0007', '3fd25b39-d865-4e56-9041-25184a90fa11', '58852d5f-8486-42fa-a423-b199925159b0', '44444444-4444-4444-8444-444444444444', 'monetary', null, null, 1, 'completed', 'The Coffee House', null, '2026-11-06T18:09:09.192Z', '2026-11-06T18:09:09.192Z');

insert into public.redemption_items (id, redemption_id, voucher_id, sessions, amount_minor, service_label, staff_user_id, created_at) values
  ('9e8e5aec-9aef-4df9-ab2c-8db644014202', '0713b308-0350-4746-9242-2599b61e0f6c', 'fd8dd38f-1749-4c27-bf6d-cbbd5b162d8b', 1, null, 'Five Session Massage Pack', '44444444-4444-4444-8444-444444444444', '2026-11-04T18:09:09.192Z'),
  ('a0b467cb-1c76-49d3-bf39-a08f1f4f579d', '9ddb0e46-7750-4268-9e2a-c6a1873b1951', 'fd8dd38f-1749-4c27-bf6d-cbbd5b162d8b', 1, null, 'Five Session Massage Pack', '44444444-4444-4444-8444-444444444444', '2026-11-08T18:09:09.192Z'),
  ('8f440393-e51b-45e3-9caf-e03ae2f931d8', '667fab77-5ee2-408e-95a9-fa54dc15a455', '2a3db8b4-f008-408e-b4af-7224488d1c38', 1, null, '10 Class Pass', '44444444-4444-4444-8444-444444444444', '2026-10-31T18:09:09.192Z'),
  ('a9b5caf3-6b2d-4d89-834e-e129b6af1188', 'c9323a65-2f67-4909-abec-fb0d57e942b7', '2a3db8b4-f008-408e-b4af-7224488d1c38', 1, null, '10 Class Pass', '44444444-4444-4444-8444-444444444444', '2026-11-01T18:09:09.192Z'),
  ('6874cba5-7c1d-4a01-b57b-167c762a18af', '768106d2-1d28-4926-9d8e-a8182c4a8e29', '2a3db8b4-f008-408e-b4af-7224488d1c38', 1, null, '10 Class Pass', '44444444-4444-4444-8444-444444444444', '2026-11-02T18:09:09.192Z'),
  ('7989dbfd-8a77-4cfe-9796-84db0ca795c4', '88a6ae54-5a01-4760-8ef6-9052ad0af540', '2a3db8b4-f008-408e-b4af-7224488d1c38', 1, null, '10 Class Pass', '44444444-4444-4444-8444-444444444444', '2026-11-05T18:09:09.192Z'),
  ('a8535883-517e-4648-95d2-20ddbf11c24e', 'ce82a840-29cf-431e-8b41-56d195e30d48', '3fd25b39-d865-4e56-9041-25184a90fa11', null, null, 'The Coffee House', '44444444-4444-4444-8444-444444444444', '2026-11-06T18:09:09.192Z');

-- ---------------------------------------------------------------------
-- Enterprise partner: products, imported codes and their history
-- ---------------------------------------------------------------------
insert into public.enterprise_partners (
  id, owner_id, name, slug, website, contact_name, contact_email, contact_phone,
  industry, expected_volume, status, integration_config, settlement_terms
) values
  ('96d72e91-21e8-47bd-8298-8f991a2ca84e', '55555555-5555-4555-8555-555555555555', 'RetailPlus Rewards', 'retailplus-rewards', 'https://retailplus.example', 'Nadia Haddad', 'partner@giftly.test', '+974 5555 0900', 'Retail', '25,000 codes / quarter', 'active', '{}'::jsonb, '{"model":"wholesale","net_days":30}'::jsonb)
on conflict (id) do nothing;

insert into public.enterprise_members (partner_id, user_id, role) values
  ('96d72e91-21e8-47bd-8298-8f991a2ca84e', '55555555-5555-4555-8555-555555555555', 'owner')
on conflict (partner_id, user_id) do nothing;

insert into public.enterprise_products (
  id, partner_id, name, external_ref, denomination_minor, currency, selling_price_minor,
  wholesale_cost_minor, commission_bps, terms_and_conditions, redemption_instructions,
  expiry_days, is_active
) values
  ('552487ae-23fb-463f-b05e-f73e7cea3a6a', '96d72e91-21e8-47bd-8298-8f991a2ca84e', 'RetailPlus Gift Card', 'RP-GC-100', 10000, 'QAR', 12000, 9000, 2500, 'Valid for 12 months from issue.', 'Enter the code at any RetailPlus checkout.', 365, true),
  ('a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', '96d72e91-21e8-47bd-8298-8f991a2ca84e', 'RetailPlus Digital Voucher', 'RP-DV-250', 25000, 'QAR', 28000, 22000, 2000, 'Valid for 6 months from issue.', 'Redeem online with the code.', 180, true)
on conflict (id) do nothing;

insert into public.products (
  id, vendor_id, category_id, fulfilment_type, enterprise_product_id, title, title_ar,
  slug, description, terms_and_conditions, redemption_instructions, booking_required,
  split_session_allowed, multi_session_per_visit, session_count, min_amount_minor,
  max_amount_minor, preset_amounts_minor, currency, expiry_days, valid_until, is_active,
  status, icon, tone, rating, location, occasions, created_at
) values
  ('281f0523-5642-4d8c-9a14-1effc26d6126', null, '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'enterprise_code', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 'RetailPlus Gift Card', 'بطاقة هدية RetailPlus', 'retailplus-gift-card', 'A digital gift card supplied by RetailPlus, redeemed at any RetailPlus checkout.', 'Valid for the stated period from issue.', 'Enter the code at checkout.', false, true, true, null, 10000, 10000, '{10000}', 'QAR', 365, now() + interval '365 days', true, 'published', 'creditCard', 'gold', 4.6, 'Doha', '{just-because,thank-you}', now()),
  ('920db701-bdec-4796-80c0-43a3f16b4a9a', null, '7e48017f-3145-46b5-9c70-b4a5973f9d85', 'enterprise_code', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 'RetailPlus Digital Voucher', 'بطاقة رقمية RetailPlus', 'retailplus-digital-voucher', 'A digital gift card supplied by RetailPlus, redeemed at any RetailPlus checkout.', 'Valid for the stated period from issue.', 'Enter the code at checkout.', false, true, true, null, 25000, 25000, '{25000}', 'QAR', 180, now() + interval '180 days', true, 'published', 'creditCard', 'gold', 4.6, 'Doha', '{just-because,thank-you}', now());

-- The encryption key for the seeded inventory. Replace it in production.
insert into public.system_settings (key, value, description, is_public)
values ('enterprise.code_encryption_key', jsonb_build_object('key', 'giftly-dev-enterprise-code-key-please-rotate'), 'Development key for enterprise code encryption.', false)
on conflict (key) do update set value = excluded.value;

insert into public.enterprise_import_batches (id, partner_id, filename, source, status, created_by) values
  ('2a033201-acab-47ed-9ae1-51a703683276', '96d72e91-21e8-47bd-8298-8f991a2ca84e', 'retailplus-q1.csv', 'csv', 'completed', '55555555-5555-4555-8555-555555555555')
on conflict (id) do nothing;

insert into public.enterprise_code_inventory (
  partner_id, enterprise_product_id, import_batch_id, inventory_ref, code_ciphertext,
  code_fingerprint, code_last4, denomination_minor, currency, status, created_at, updated_at
)
select
  '96d72e91-21e8-47bd-8298-8f991a2ca84e',
  v.enterprise_product_id::uuid,
  '2a033201-acab-47ed-9ae1-51a703683276',
  'INV-' || upper(substr(public.enterprise_code_fingerprint('96d72e91-21e8-47bd-8298-8f991a2ca84e', v.code), 1, 10)),
  extensions.pgp_sym_encrypt(v.code, public.enterprise_code_key()),
  public.enterprise_code_fingerprint('96d72e91-21e8-47bd-8298-8f991a2ca84e', v.code),
  right(v.code, 4),
  v.denomination_minor,
  'QAR',
  v.status::public.inventory_status,
  now(), now()
from (values
  ('RP-100137-0001', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-100274-0002', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-100411-0003', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-100548-0004', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-100685-0005', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-100822-0006', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-100959-0007', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-101096-0008', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-101233-0009', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-101370-0010', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-101507-0011', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-101644-0012', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-101781-0013', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-101918-0014', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-102055-0015', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-102192-0016', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-102329-0017', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-102466-0018', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-102603-0019', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-102740-0020', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-102877-0021', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-103014-0022', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-103151-0023', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-103288-0024', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-103425-0025', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-103562-0026', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-103699-0027', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-103836-0028', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-103973-0029', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-104110-0030', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-104247-0031', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-104384-0032', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-104521-0033', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-104658-0034', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-104795-0035', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-104932-0036', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-105069-0037', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-105206-0038', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-105343-0039', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-105480-0040', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-105617-0041', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-105754-0042', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-105891-0043', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-106028-0044', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-106165-0045', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-106302-0046', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-106439-0047', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-106576-0048', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-106713-0049', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-106850-0050', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-106987-0051', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-107124-0052', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-107261-0053', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-107398-0054', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-107535-0055', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-107672-0056', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-107809-0057', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-107946-0058', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-108083-0059', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-108220-0060', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-108357-0061', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-108494-0062', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-108631-0063', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-108768-0064', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-108905-0065', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-109042-0066', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-109179-0067', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-109316-0068', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-109453-0069', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-109590-0070', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-109727-0071', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-109864-0072', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-110001-0073', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-110138-0074', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-110275-0075', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-110412-0076', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-110549-0077', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-110686-0078', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-110823-0079', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-110960-0080', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-111097-0081', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-111234-0082', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-111371-0083', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-111508-0084', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-111645-0085', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-111782-0086', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-111919-0087', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-112056-0088', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-112193-0089', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-112330-0090', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-112467-0091', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-112604-0092', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-112741-0093', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-112878-0094', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-113015-0095', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-113152-0096', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-113289-0097', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-113426-0098', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-113563-0099', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'available'),
  ('RP-113700-0100', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'available'),
  ('RP-113837-0101', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'quarantined'),
  ('RP-113974-0102', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'quarantined'),
  ('RP-114111-0103', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'quarantined'),
  ('RP-114248-0104', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'quarantined'),
  ('RP-114385-0105', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'quarantined'),
  ('RP-114522-0106', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'expired'),
  ('RP-114659-0107', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'expired'),
  ('RP-114796-0108', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'expired'),
  ('RP-114933-0109', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'expired'),
  ('RP-115070-0110', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'expired'),
  ('RP-115207-0111', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'invalid'),
  ('RP-115344-0112', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'invalid'),
  ('RP-115481-0113', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'invalid'),
  ('RP-115618-0114', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'invalid'),
  ('RP-115755-0115', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'invalid'),
  ('RP-115892-0116', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'invalid'),
  ('RP-116029-0117', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'invalid'),
  ('RP-116166-0118', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'invalid'),
  ('RP-116303-0119', '552487ae-23fb-463f-b05e-f73e7cea3a6a', 10000, 'invalid'),
  ('RP-116440-0120', 'a0afc6d0-fa3f-4f0f-8b45-2b0d7583da06', 25000, 'invalid')
) as v(code, enterprise_product_id, denomination_minor, status)
on conflict (code_fingerprint) do nothing;

insert into public.enterprise_code_events (inventory_id, partner_id, event_type, actor_user_id)
select i.id, i.partner_id, 'imported', '55555555-5555-4555-8555-555555555555'
from public.enterprise_code_inventory i
where i.partner_id = '96d72e91-21e8-47bd-8298-8f991a2ca84e'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Campaigns and featured placements
-- ---------------------------------------------------------------------
insert into public.campaigns (id, name, kind, status, starts_at, ends_at, priority) values
  ('0575f348-aef6-4a20-9282-4502add4581e', 'Launch campaign', 'banner', 'live', now() - interval '7 days', now() + interval '30 days', 10),
  ('04bc8a2e-b030-4689-a382-042464d43d2d', 'Featured vendors', 'featured_vendor', 'live', now() - interval '7 days', now() + interval '30 days', 5)
on conflict (id) do nothing;

insert into public.banners (id, campaign_id, title, subtitle, cta_label, cta_url, active) values
  ('18f904d9-b35a-47fa-95f8-df90e0d4ea40', '0575f348-aef6-4a20-9282-4502add4581e', 'Gifts are better together', 'Start a basket and invite your friends.', 'Explore the app', '/download', true)
on conflict (id) do nothing;

commit;
