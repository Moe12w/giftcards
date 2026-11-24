// Generates supabase/seed-demo-data.sql with deterministic ids.
const fs = require('fs');
const crypto = require('crypto');

const ROOT = 'C:/Users/User/Desktop/gift-card-marketplace';
const USER_ID = 'a8d7bca6-22a4-47d3-9298-0d45f4e1d93c';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '66666666-6666-4666-8666-666666666666';
const COFFEE_ID = '58852d5f-8486-42fa-a423-b199925159b0';
const COFFEE_PRODUCT = 'b4b0f99f-b29c-41ce-9b2b-9ae9eebb269f';

function uuid(name) {
  const h = crypto.createHash('sha1').update('tazella-demo:' + name).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function q(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function img(seed, w = 800, h = 600) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}
// Every business in the demo set shares The Coffee House logo.
function logo() {
  return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop';
}

const shops = [
  { name: 'Oasis Café', ar: 'واحة القهوة', slug: 'oasis-cafe', city: 'West Bay', cat: 'coffee', color: 'B76E3C', icon: 'coffee', products: [
    { title: 'Oasis Coffee Card', icon: 'coffee', min: 5000, presets: [5000, 10000, 20000] },
    { title: 'Pastry & Coffee Box', icon: 'pastry', min: 12000, presets: [12000, 25000, 50000] },
  ]},
  { name: 'Doha Flower Studio', ar: 'استوديو الدوحة للزهور', slug: 'doha-flower-studio', city: 'Al Sadd', cat: 'shopping', color: 'C2185B', icon: 'flowers', products: [
    { title: 'Seasonal Bouquet Card', icon: 'flowers', min: 15000, presets: [15000, 30000, 60000] },
    { title: 'Roses & Chocolate', icon: 'gift', min: 25000, presets: [25000, 50000, 100000] },
  ]},
  { name: 'Katara Chocolate', ar: 'شوكولاتة كتارا', slug: 'katara-chocolate', city: 'Katara', cat: 'desserts', color: '5D4037', icon: 'dessert', products: [
    { title: 'Chocolate Lovers Card', icon: 'dessert', min: 8000, presets: [8000, 15000, 30000] },
    { title: 'Dates & Chocolate Box', icon: 'gift', min: 20000, presets: [20000, 40000, 80000] },
  ]},
  { name: 'Pearl Sushi House', ar: 'بيت السوشي اللؤلؤي', slug: 'pearl-sushi-house', city: 'The Pearl', cat: 'dining', color: '37474F', icon: 'dining', products: [
    { title: 'Sushi Night for Two', icon: 'dining', min: 40000, presets: [40000, 80000, 150000] },
    { title: 'Chef Tasting Card', icon: 'gift', min: 60000, presets: [60000, 120000, 250000] },
  ]},
  { name: 'Desert Rose Spa', ar: 'منتجع وردة الصحراء', slug: 'desert-rose-spa', city: 'Lusail', cat: 'wellness', color: '7B1FA2', icon: 'wellness', products: [
    { title: 'Relaxing Massage Card', icon: 'wellness', min: 35000, presets: [35000, 70000, 140000] },
    { title: 'Spa Day Escape', icon: 'sparkles', min: 80000, presets: [80000, 150000, 300000] },
  ]},
  { name: 'Lusail Cinema Club', ar: 'نادي السينما لوسيل', slug: 'lusail-cinema-club', city: 'Lusail', cat: 'entertainment', color: '1565C0', icon: 'entertainment', products: [
    { title: 'Movie Night for Two', icon: 'entertainment', min: 12000, presets: [12000, 25000, 50000] },
    { title: 'Cinema & Popcorn Card', icon: 'gift', min: 8000, presets: [8000, 16000, 32000] },
  ]},
  { name: 'Souq Art Gallery', ar: 'معرض سوق الفن', slug: 'souq-art-gallery', city: 'Souq Waqif', cat: 'shopping', color: '6D4C41', icon: 'shopping', products: [
    { title: 'Local Art Card', icon: 'shopping', min: 20000, presets: [20000, 50000, 100000] },
    { title: 'Handmade Souvenir Card', icon: 'gift', min: 10000, presets: [10000, 25000, 50000] },
  ]},
  { name: 'Qatar Adventure Co.', ar: 'شركة قطر للمغامرات', slug: 'qatar-adventure-co', city: 'Sealine', cat: 'experiences', color: '2E7D32', icon: 'experiences', products: [
    { title: 'Desert Safari Card', icon: 'experiences', min: 60000, presets: [60000, 120000, 240000] },
    { title: 'Dhow Cruise for Two', icon: 'gift', min: 45000, presets: [45000, 90000, 180000] },
  ]},
  { name: 'Doha Book Café', ar: 'مقهى الدوحة للكتب', slug: 'doha-book-cafe', city: 'Msheireb', cat: 'coffee', color: '8D6E63', icon: 'coffee', products: [
    { title: 'Book & Brew Card', icon: 'coffee', min: 7000, presets: [7000, 15000, 30000] },
    { title: 'Story Lovers Card', icon: 'gift', min: 10000, presets: [10000, 20000, 40000] },
  ]},
  { name: 'Bloom Nails & Beauty', ar: 'بلوم للأظافر والجمال', slug: 'bloom-nails-beauty', city: 'Al Waab', cat: 'beauty', color: 'AD1457', icon: 'beauty', products: [
    { title: 'Manicure Card', icon: 'beauty', min: 15000, presets: [15000, 30000, 60000] },
    { title: 'Pamper Session Card', icon: 'sparkles', min: 25000, presets: [25000, 50000, 100000] },
  ]},
  { name: 'Fitness First Doha', ar: 'فيتنس فيرست الدوحة', slug: 'fitness-first-doha', city: 'Lusail', cat: 'fitness', color: '00838F', icon: 'fitness', products: [
    { title: 'Personal Training Card', icon: 'fitness', min: 40000, presets: [40000, 80000, 160000] },
    { title: 'Gym Membership Card', icon: 'gift', min: 70000, presets: [70000, 140000, 280000] },
  ]},
  { name: 'Golden Fork Restaurant', ar: 'مطعم الشوكة الذهبية', slug: 'golden-fork', city: 'West Bay', cat: 'dining', color: 'F9A825', icon: 'dining', products: [
    { title: 'Dinner for Two Card', icon: 'dining', min: 30000, presets: [30000, 60000, 120000] },
    { title: 'Qatari Feast Card', icon: 'gift', min: 50000, presets: [50000, 100000, 200000] },
  ]},
];

const placements = [
  { key: 'homepage_hero_carousel', slots: [4, 5] },
  { key: 'homepage_featured_gift_card', slots: [2, 3, 4] },
  { key: 'marketplace_sponsored_business', slots: [1, 2, 3] },
  { key: 'search_sponsored_result', slots: [1] },
  { key: 'category_coffee', slots: [1, 2] },
  { key: 'category_dining', slots: [1, 2] },
  { key: 'category_desserts', slots: [1, 2] },
  { key: 'category_wellness', slots: [1, 2] },
  { key: 'category_shopping', slots: [1, 2] },
  { key: 'category_experiences', slots: [1, 2] },
  { key: 'category_beauty', slots: [1, 2] },
  { key: 'category_fitness', slots: [1, 2] },
  { key: 'category_entertainment', slots: [1, 2] },
  { key: 'collection_birthday', slots: [1, 2] },
  { key: 'collection_for-her', slots: [1, 2] },
  { key: 'collection_for-him', slots: [1] },
  { key: 'collection_thank-you', slots: [1] },
  { key: 'collection_just-because', slots: [1] },
  { key: 'collection_anniversary', slots: [1] },
  { key: 'collection_congratulations', slots: [1] },
];

const lines = [];
const add = (s) => lines.push(s);

add('-- Demo seed: shops, products, live ads and a test wallet.');
add('-- Generated by scripts/generate-demo-seed.cjs. Safe to re-run (fixed ids).');
add('');
add('begin;');
add('');

add('-- ---------------------------------------------------------------- shops');
shops.forEach((shop, i) => {
  const id = uuid('vendor-' + shop.slug);
  add(`insert into public.vendors (id, owner_id, name, name_ar, slug, description, logo_url, banner_url, city, category_id, status, commission_bps, rating, is_featured, approved_at, advertising_enabled, advertising_verified)`);
  add(`values (${q(id)}, ${q(OWNER_ID)}, ${q(shop.name)}, ${q(shop.ar)}, ${q(shop.slug)}, ${q(shop.name + ' — a Tazella partner in ' + shop.city + '.')},`);
  add(`  ${q(logo(shop.name, shop.color))}, ${q(img(shop.slug + '-banner', 1200, 400))}, ${q(shop.city)},`);
  add(`  (select id from public.categories where slug = ${q(shop.cat)}), 'approved', 1000, ${(4.5 + (i % 5) * 0.1).toFixed(1)}, ${i < 4 ? 'true' : 'false'}, now(), true, true)`);
  add(`on conflict (id) do nothing;`);
  add('');
});

add('-- ------------------------------------------------------------- products');
shops.forEach((shop) => {
  const vendorId = uuid('vendor-' + shop.slug);
  shop.products.forEach((product, j) => {
    const id = uuid('product-' + shop.slug + '-' + j);
    const slug = `demo-${shop.slug}-${j}`;
    const presets = '{' + product.presets.join(',') + '}';
    const max = product.presets[product.presets.length - 1] * 2;
    const tone = ['gold', 'teal', 'pink', 'lavender', 'sky'][j % 5];
    add(`insert into public.products (id, vendor_id, title, title_ar, description, image_url, min_amount_minor, max_amount_minor, preset_amounts_minor, is_active, slug, fulfilment_type, category_id, status, icon, tone, rating, location, occasions, currency, expiry_days)`);
    add(`values (${q(id)}, ${q(vendorId)}, ${q(product.title)}, ${q(product.title + ' — ' + shop.name)}, ${q('Send a ' + product.title.toLowerCase() + ' from ' + shop.name + '.')},`);
    add(`  ${q(img(slug, 900, 700))}, ${product.min}, ${max}, ${q(presets)}, true, ${q(slug)}, 'monetary',`);
    add(`  (select id from public.categories where slug = ${q(shop.cat)}), 'published', ${q(product.icon)}, ${q(tone)}, ${(4.6 + (j % 4) * 0.1).toFixed(1)}, ${q(shop.city)}, '{birthday,thank-you,just-because}', 'QAR', 365)`);
    add(`on conflict (id) do nothing;`);
    add('');
  });
});

add('-- ---------------------------------------------------------- live ads');
let campaignNo = 0;
const campaignIds = [];
placements.forEach((placement, pIndex) => {
  placement.slots.forEach((slot, sIndex) => {
    campaignNo += 1;
    const shop = shops[campaignNo % shops.length];
    const vendorId = uuid('vendor-' + shop.slug);
    const campaignId = uuid('campaign-' + campaignNo);
    const creativeId = uuid('creative-' + campaignNo);
    const ref = `DEMO-ADV-${String(campaignNo).padStart(3, '0')}`;
    campaignIds.push(campaignId);
    const headline = `${shop.name} — ${shop.products[0].title}`;
    const headlineAr = `${shop.ar} — ${shop.products[0].title}`;
    add(`insert into public.advertising_campaigns (id, campaign_ref, vendor_id, created_by, placement_id, placement_key, pricing_id, pricing_model, currency, name, status, payment_status, payment_reference, payment_provider, quote_amount_minor, fixed_price_minor, starts_at, ends_at, priority, rotation_weight, total_budget_minor, daily_budget_minor, approved_at, approved_by, activated_at, pricing_snapshot, metadata, slot_number)`);
    add(`values (${q(campaignId)}, ${q(ref)}, ${q(vendorId)}, ${q(ADMIN_ID)}, (select id from public.advertising_placements where key = ${q(placement.key)}), ${q(placement.key)},`);
    add(`  (select id from public.advertising_pricing where placement_id = (select id from public.advertising_placements where key = ${q(placement.key)}) and pricing_model = 'fixed' and is_active order by fixed_price_minor desc limit 1),`);
    add(`  'fixed', 'QAR', ${q(headline)}, 'active', 'paid', ${q('SEED-' + ref)}, 'manual', 50000, 50000,`);
    add(`  now() - interval '1 hour', now() + interval '60 days', ${100 - pIndex}, 100, 5000000, 500000, now(), ${q(ADMIN_ID)}, now(),`);
    add(`  '{"model":"fixed","price_minor":50000}'::jsonb, '{"seed":true,"batch":"demo-2026"}'::jsonb, ${slot})`);
    add(`on conflict (id) do nothing;`);
    add('');

    add(`insert into public.advertising_creatives (id, campaign_id, type, headline, headline_ar, body, body_ar, image_url, mobile_image_url, image_alt, cta_label, cta_label_ar, destination_type, destination_id, status, sort_order)`);
    add(`values (${q(creativeId)}, ${q(campaignId)}, 'image', ${q(headline)}, ${q(headlineAr)},`);
    add(`  ${q('A little something for every occasion. Delivered instantly as a gift card.')},`);
    add(`  ${q('هدية صغيرة لكل مناسبة. تُرسل فورًا كبطاقة هدية.')},`);
    add(`  ${q(img(ref + '-wide', 1200, 600))}, ${q(img(ref + '-square', 800, 800))}, ${q(shop.name)},`);
    add(`  'Get gift card', 'احصل على بطاقة', 'business', ${q(vendorId)}, 'active', 1)`);
    add(`on conflict (id) do nothing;`);
    add('');

    add(`insert into public.advertising_campaign_budgets (campaign_id, total_budget_minor, daily_budget_minor, spent_minor, daily_spent_minor, currency)`);
    add(`values (${q(campaignId)}, 5000000, 500000, 0, 0, 'QAR')`);
    add(`on conflict (campaign_id) do nothing;`);
    add('');
  });
});

add(`delete from public.advertising_inventory where campaign_id in (${campaignIds.map(q).join(',')});`);
add('');
campaignNo = 0;
placements.forEach((placement) => {
  placement.slots.forEach((slot) => {
    campaignNo += 1;
    const campaignId = uuid('campaign-' + campaignNo);
    add(`insert into public.advertising_inventory (placement_id, campaign_id, slot_index, status, starts_at, ends_at, metadata)`);
    add(`values ((select id from public.advertising_placements where key = ${q(placement.key)}), ${q(campaignId)}, ${slot}, 'occupied', now() - interval '1 hour', now() + interval '60 days', '{"seed":true}'::jsonb);`);
    add('');
  });
});

add('-- ---------------------------------------------------------- test wallet');
const orderId = uuid('order-wallet-mohmed');
add(`insert into public.orders (id, buyer_id, status, payment_reference, order_ref, currency, subtotal_minor, total_minor, sender_name, recipient_name, recipient_email, delivery_method, payment_status, payment_provider, paid_at)`);
add(`values (${q(orderId)}, ${q(USER_ID)}, 'paid', 'DEMO-WALLET-MOHMED-001', 'GR-DEMO-MOHMED-001', 'QAR', 35000, 35000, 'Tazella Demo', 'Mohmed', 'mohmed528omer@gmail.com', 'in_app', 'paid', 'manual', now())`);
add(`on conflict (id) do nothing;`);
add('');

const cards = [
  { n: 1, amount: 5000, status: 'issued', claim: 'DEMO-CLAIM-COFFEE-1', code: 'GFT-DEMO-COFFEE-001', msg: 'Your first coffee is on us.' },
  { n: 2, amount: 10000, status: 'claimed', claim: null, code: 'GFT-DEMO-COFFEE-002', msg: 'A little treat for the week.' },
  { n: 3, amount: 20000, status: 'active', claim: null, code: 'GFT-DEMO-COFFEE-003', msg: 'Coffee and pastries for two.' },
];
const voucherIds = [];
cards.forEach((card) => {
  const itemId = uuid('order-item-wallet-' + card.n);
  const voucherId = uuid('voucher-wallet-' + card.n);
  voucherIds.push(voucherId);
  add(`insert into public.order_items (id, order_id, product_id, vendor_id, quantity, unit_price_minor, total_minor, commission_minor, vendor_share_minor, currency, recipient_name, recipient_email, delivery_method)`);
  add(`values (${q(itemId)}, ${q(orderId)}, ${q(COFFEE_PRODUCT)}, ${q(COFFEE_ID)}, 1, ${card.amount}, ${card.amount}, ${Math.round(card.amount * 0.1)}, ${Math.round(card.amount * 0.9)}, 'QAR', 'Mohmed', 'mohmed528omer@gmail.com', 'in_app')`);
  add(`on conflict (id) do nothing;`);
  add('');

  const claimHash = card.claim ? `encode(extensions.digest(${q(card.claim)}, 'sha256'), 'hex')` : 'null';
  const codeHash = `encode(extensions.digest(${q(card.code)}, 'sha256'), 'hex')`;
  const claimedBy = card.status === 'issued' ? 'null' : q(USER_ID);
  const claimedAt = card.status === 'issued' ? 'null' : 'now() - interval \'1 day\'';
  add(`insert into public.vouchers (id, product_id, order_id, buyer_id, recipient_name, recipient_email, initial_value_minor, status, claim_token_hash, claimed_by, claimed_at, expires_at, card_code_hash, voucher_code, vendor_id, order_item_id, fulfilment_type, remaining_value_minor, currency, delivery_status, gift_message)`);
  add(`values (${q(voucherId)}, ${q(COFFEE_PRODUCT)}, ${q(orderId)}, ${q(USER_ID)}, 'Mohmed', 'mohmed528omer@gmail.com', ${card.amount}, '${card.status}', ${claimHash},`);
  add(`  ${claimedBy}, ${claimedAt}, now() + interval '365 days', ${codeHash}, ${q(card.code)}, ${q(COFFEE_ID)}, ${q(itemId)}, 'monetary', ${card.amount}, 'QAR', 'delivered', ${q(card.msg)})`);
  add(`on conflict (id) do nothing;`);
  add('');
});

add(`delete from public.ledger_entries where voucher_id in (${voucherIds.map(q).join(',')});`);
cards.forEach((card, i) => {
  add(`insert into public.ledger_entries (voucher_id, order_id, entry_type, amount_minor, sessions)`);
  add(`values (${q(voucherIds[i])}, ${q(orderId)}, 'issue', ${card.amount}, 0);`);
  add('');
});

add('commit;');

fs.writeFileSync(ROOT + '/supabase/seed-demo-data.sql', lines.join('\n') + '\n', 'utf8');
console.log('wrote supabase/seed-demo-data.sql', { shops: shops.length, products: shops.reduce((n, s) => n + s.products.length, 0), campaigns: campaignNo, cards: cards.length });
