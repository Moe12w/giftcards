// Generates supabase/seed.sql from the app's own demo catalogue so the
// database and the mobile app always show the same vendors and products.
const fs = require('fs');
const path = require('path');
const ts = require('C:/Users/User/Desktop/gift-card-marketplace/node_modules/typescript');

const root = 'C:/Users/User/Desktop/gift-card-marketplace';

function loadModule(file, imports = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', js);
  fn(module.exports, (id) => {
    if (id in imports) return imports[id];
    if (id === './types') return {};
    if (id === './time') return loadModule('src/lib/time.ts');
    throw new Error(`unexpected require: ${id}`);
  }, module, file, root);
  return module.exports;
}

const time = loadModule('src/lib/time.ts');
const mock = loadModule('src/lib/mock-data.ts', { './time': time });

const { MOCK_OFFERS, MOCK_CARDS, MOCK_ORDERS, MOCK_VENDOR_CARDS, MOCK_REDEMPTIONS, MOCK_LOCATIONS, MOCK_RECIPIENTS } = mock;

const q = (value) => (value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`);

// Deterministic UUIDs so the seed is repeatable and cross-references work.
function uuidFor(key) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(`giftly-seed:${key}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

const lines = [];
const push = (line = '') => lines.push(line);

push('-- supabase/seed.sql');
push('-- Demo data for the whole marketplace: catalogue, vendors, customers,');
push('-- vouchers, redemptions, an enterprise partner and its code inventory.');
push('--');
push('-- Generated from the mobile app catalogue so both stay in sync.');
push('-- Safe to run more than once: every insert is keyed and idempotent.');
push('');
push("begin;");
push('');

// ---------------------------------------------------------------------------
// Reset the demo tables so the seed can be run again at any time.
// (This is demo data for a development project, not production content.)
// ---------------------------------------------------------------------------
push('-- Clear the demo rows before inserting them again.');
const RESET = [
  'redemption_items',
  'redemptions',
  'vouchers',
  'order_items',
  'orders',
  'product_media',
  'product_variants',
  'products',
  'vendor_locations',
  'vendor_applications',
  'vendor_members',
  'vendors',
  'categories',
  'enterprise_code_events',
  'enterprise_code_inventory',
  'enterprise_import_batches',
  'enterprise_products',
  'enterprise_members',
  'enterprise_partners',
  'favourites',
  'recipients',
  'campaign_placements',
  'campaigns',
  'banners',
];
// The append-only triggers protect live history, so they are lifted for the
// reset and restored straight afterwards. The ledger is cleared before the
// vouchers, because every voucher is referenced by it.
push('alter table public.ledger_entries disable trigger ledger_no_update;');
push('alter table public.audit_log disable trigger audit_no_update;');
push('delete from public.ledger_entries;');
push('delete from public.audit_log;');
RESET.forEach((table) => push(`delete from public.${table};`));
push('alter table public.ledger_entries enable trigger ledger_no_update;');
push('alter table public.audit_log enable trigger audit_no_update;');
push('');

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------
push('-- ---------------------------------------------------------------------');
push('-- Test accounts (password for all of them: GiftlyTest123)');
push('-- ---------------------------------------------------------------------');
const USERS = [
  ['11111111-1111-4111-8111-111111111111', 'customer@giftly.test', 'Demo Customer'],
  ['22222222-2222-4222-8222-222222222222', 'owner@giftly.test', 'Vendor Owner'],
  ['33333333-3333-4333-8333-333333333333', 'manager@giftly.test', 'Vendor Manager'],
  ['44444444-4444-4444-8444-444444444444', 'staff@giftly.test', 'Redemption Staff'],
  ['55555555-5555-4555-8555-555555555555', 'partner@giftly.test', 'Enterprise Partner'],
  ['66666666-6666-4666-8666-666666666666', 'admin@giftly.test', 'Platform Admin'],
];

// The people who bought the vouchers the vendors still have to serve.
const BUYERS = [...new Set(MOCK_VENDOR_CARDS.map((card) => card.recipient_name))].map((name) => [
  uuidFor(`buyer:${name}`),
  `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@giftly.test`,
  name,
]);
const ALL_USERS = [...USERS, ...BUYERS];

push("insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, raw_user_meta_data)");
push("values");
const userRows = ALL_USERS.map(
  ([id, email, name]) =>
    `  ('${id}', '${email}', extensions.crypt('GiftlyTest123', extensions.gen_salt('bf')), now(), now(), '{"full_name":"${name}"}'::jsonb)`,
);
push(userRows.join(',\n'));
push('on conflict (id) do nothing;');
push('');
push('insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)');
push('select');
push('  gen_random_uuid(), id, id::text, jsonb_build_object(\'sub\', id, \'email\', email), \'email\', now(), now(), now()');
push('from auth.users');
push(`where email in (${ALL_USERS.map(([, email]) => q(email)).join(', ')})`);
push('on conflict do nothing;');
push('');

push('insert into public.profiles (id, full_name, email, preferred_language)');
push('select id, raw_user_meta_data ->> \'full_name\', email, \'en\' from auth.users');
push(`where email in (${ALL_USERS.map(([, email]) => q(email)).join(', ')})`);
push('on conflict (id) do nothing;');
push('');

push("insert into public.user_roles (user_id, role) values");
push("  ('66666666-6666-4666-8666-666666666666', 'admin'),");
push("  ('55555555-5555-4555-8555-555555555555', 'enterprise_user'),");
push("  ('11111111-1111-4111-8111-111111111111', 'customer')");
push('on conflict (user_id) do update set role = excluded.role;');
push('');

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const CATEGORIES = [
  ['coffee', 'Coffee', 'قهوة', 'coffee', 1],
  ['dining', 'Dining', 'مطاعم', 'dining', 2],
  ['desserts', 'Desserts', 'حلويات', 'dessert', 3],
  ['wellness', 'Wellness', 'عافية', 'wellness', 4],
  ['shopping', 'Shopping', 'تسوق', 'shopping', 5],
  ['experiences', 'Experiences', 'تجارب', 'experiences', 6],
  ['beauty', 'Beauty', 'جمال', 'beauty', 7],
  ['fitness', 'Fitness', 'لياقة', 'fitness', 8],
  ['entertainment', 'Entertainment', 'ترفيه', 'entertainment', 9],
];
push('-- ---------------------------------------------------------------------');
push('-- Categories');
push('-- ---------------------------------------------------------------------');
push('insert into public.categories (id, slug, name, name_ar, icon, sort_order) values');
push(
  CATEGORIES.map(
    ([slug, name, nameAr, icon, order]) =>
      `  (${q(uuidFor('category:' + slug))}, ${q(slug)}, ${q(name)}, ${q(nameAr)}, ${q(icon)}, ${order})`,
  ).join(',\n') + ';',
);
push('');

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------
const vendorIds = new Map();
const vendorRows = new Map();
for (const offer of MOCK_OFFERS) {
  if (!vendorRows.has(offer.vendor_id)) {
    vendorRows.set(offer.vendor_id, offer.vendor);
    vendorIds.set(offer.vendor_id, uuidFor(offer.vendor_id));
  }
}

const slugFor = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

push('-- ---------------------------------------------------------------------');
push('-- Vendors');
push('-- ---------------------------------------------------------------------');
push('insert into public.vendors (id, owner_id, name, name_ar, slug, description, logo_url, banner_url, status, commission_bps, rating, city, approved_at, created_at) values');
const vendorValues = [...vendorRows.entries()].map(([vendorId, vendor]) => {
  const offers = MOCK_OFFERS.filter((o) => o.vendor_id === vendorId);
  const rating = Math.max(...offers.map((o) => o.rating ?? 4.8)).toFixed(1);
  const location = offers[0].location ?? null;
  return `  (${q(uuidFor(vendorId))}, '22222222-2222-4222-8222-222222222222', ${q(vendor.name)}, ${q(vendor.name_ar)}, ${q(slugFor(vendor.name))}, ${q(offers[0].description)}, ${q(vendor.logo_url)}, ${q(vendor.banner_url)}, 'approved', 1000, ${rating}, ${q(location)}, now(), now())`;
});
push(vendorValues.join(',\n') + ';');
push('');

// Vendor staff for the test accounts.
push('insert into public.vendor_members (vendor_id, user_id, role, permissions) values');
push(`  (${q(uuidFor('vendor-1'))}, '22222222-2222-4222-8222-222222222222', 'owner', '{"all":true}'::jsonb),`);
push(`  (${q(uuidFor('vendor-1'))}, '33333333-3333-4333-8333-333333333333', 'manager', '{"products":true,"redeem":true,"staff":true}'::jsonb),`);
push(`  (${q(uuidFor('vendor-1'))}, '44444444-4444-4444-8444-444444444444', 'redemption_staff', '{"redeem":true}'::jsonb),`);
push(`  (${q(uuidFor('vendor-2'))}, '22222222-2222-4222-8222-222222222222', 'owner', '{"all":true}'::jsonb)`);
push('on conflict (vendor_id, user_id) do update set role = excluded.role, permissions = excluded.permissions;');
push('');

// Vendor locations
push('insert into public.vendor_locations (id, vendor_id, area, address, hours) values');
push(
  MOCK_LOCATIONS.map(
    (loc) =>
      `  (${q(uuidFor(loc.id))}, ${q(uuidFor(loc.vendorId))}, ${q(loc.area)}, ${q(loc.address)}, ${q(loc.hours)})`,
  ).join(',\n') + ';',
);
push('');

// Vendor applications: one approved, one waiting for review.
push('insert into public.vendor_applications (vendor_id, status, step, business_name, business_category, business_description, business_email, business_phone, business_location, submitted_at) values');
push(
  `  (${q(uuidFor('vendor-1'))}, 'approved', 'review', 'The Coffee House', 'coffee', 'A speciality coffee bar in West Bay.', 'owner@giftly.test', '+974 5555 0101', 'West Bay, Doha', now()),`,
);
push(
  `  (${q(uuidFor('vendor-5'))}, 'pending_review', 'review', 'Peak Fitness', 'fitness', 'Personal training and group classes in Lusail.', 'owner@giftly.test', '+974 5555 0101', 'Lusail, Doha', now())`,
);
push('on conflict do nothing;');
push('');

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
const productUuid = new Map();
push('-- ---------------------------------------------------------------------');
push('-- Products: the shared catalogue for all three fulfilment types');
push('-- ---------------------------------------------------------------------');
push('insert into public.products (');
push('  id, vendor_id, category_id, fulfilment_type, title, title_ar, slug, description,');
push('  terms_and_conditions, redemption_instructions, booking_required,');
push('  split_session_allowed, multi_session_per_visit, session_count,');
push('  min_amount_minor, max_amount_minor, preset_amounts_minor, currency, expiry_days,');
push('  valid_until, is_active, status, icon, tone, rating, location, occasions, created_at');
push(') values');

const productValues = [];
const variantValues = [];
const firstVariantByOffer = new Map();
for (const offer of MOCK_OFFERS) {
  const productId = uuidFor(offer.id);
  productUuid.set(offer.id, productId);
  const isSession = offer.fulfilment_type === 'experience';
  const categoryId = offer.category ? uuidFor(`category:${offer.category}`) : 'null';
  const fulfilment = isSession ? 'experience' : 'monetary';
  const sessionCount = isSession ? offer.session_count : 'null';
  const slug = `${slugFor(offer.title)}-${offer.id.replace(/\D/g, '')}`;
  productValues.push(
    `  (${q(productId)}, ${q(uuidFor(offer.vendor_id))}, ${q(categoryId)}, '${fulfilment}', ${q(offer.title)}, ${q(offer.title_ar)}, ${q(slug)}, ${q(offer.description)}, ${q(`Valid for ${Math.round((new Date(offer.valid_until) - new Date()) / 86400000)} days from issue. Redeem at any ${offer.vendor.name} location.`)}, ${q(`Show the QR code at the counter. One ${offer.vendor.name} visit per redemption.`)}, ${isSession ? 'true' : 'false'}, true, true, ${sessionCount}, ${offer.min_amount_minor}, ${offer.max_amount_minor}, '{${offer.preset_amounts_minor.join(',')}}', 'QAR', 365, ${q(offer.valid_until)}, true, 'published', ${q(offer.icon)}, ${q(offer.tone)}, ${offer.rating ?? 4.8}, ${q(offer.location)}, '{${(offer.occasions ?? []).join(',')}}', ${q(offer.created_at)})`,
  );

  // Denominations for money cards, session packages for experience cards.
  if (isSession) {
    const packages = [...new Set([1, 3, offer.session_count, 5])]
      .filter((n) => n >= 1 && n <= 10)
      .sort((a, b) => a - b);
    packages.forEach((sessions, index) => {
      const variantId = uuidFor(offer.id + ':pkg:' + sessions);
      if (index === 0) firstVariantByOffer.set(offer.id, variantId);
      variantValues.push(
        `  (${q(variantId)}, ${q(productId)}, 'package', ${q(`${sessions} session${sessions === 1 ? '' : 's'}`)}, null, ${sessions}, ${offer.min_amount_minor * sessions}, 'QAR', ${q(offer.valid_until)}, true, ${index})`,
      );
    });
  } else {
    const denominations = [...new Set(offer.preset_amounts_minor)].sort((a, b) => a - b);
    denominations.forEach((amount, index) => {
      const label = 'QAR ' + (amount / 100).toFixed(2);
      const variantId = uuidFor(offer.id + ':den:' + amount);
      if (index === 0) firstVariantByOffer.set(offer.id, variantId);
      variantValues.push(
        `  (${q(variantId)}, ${q(productId)}, 'denomination', ${q(label)}, ${amount}, null, ${amount}, 'QAR', ${q(offer.valid_until)}, true, ${index})`,
      );
    });
  }
}
push(productValues.join(',\n') + ';');
push('');
push('insert into public.product_variants (');
push('  id, product_id, kind, label, amount_minor, session_count, price_minor, currency,');
push('  valid_until, active, sort_order');
push(') values');
push(variantValues.join(',\n') + ';');
push('');

// ---------------------------------------------------------------------------
// Customer, recipients, favourites
// ---------------------------------------------------------------------------
const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
push('insert into public.recipients (id, customer_id, name, email, phone, relation) values');
push(
  MOCK_RECIPIENTS.map(
    (r) => `  (${q(uuidFor(r.id))}, '${CUSTOMER_ID}', ${q(r.name)}, ${q(r.email)}, ${q(r.phone)}, ${q(r.relation)})`,
  ).join(',\n') + ';',
);
push('');

push('insert into public.favourites (id, customer_id, vendor_id, product_id) values');
push(
  [...MOCK_OFFERS]
    .slice(0, 3)
    .map((o) => `  (${q(uuidFor('fav:' + o.id))}, '${CUSTOMER_ID}', null, ${q(uuidFor(o.id))})`)
    .join(',\n') + ';',
);
push('');

push('insert into public.notification_preferences (user_id)');
push(`select '${CUSTOMER_ID}' on conflict do nothing;`);
push('');

// ---------------------------------------------------------------------------
// Orders, items, vouchers and the ledger
// ---------------------------------------------------------------------------
push('-- ---------------------------------------------------------------------');
push('-- Orders, order items, vouchers and the append-only ledger');
push('-- ---------------------------------------------------------------------');
push('insert into public.orders (');
push('  id, order_ref, buyer_id, status, currency, subtotal_minor, discount_minor, fee_minor,');
push('  total_minor, sender_name, gift_message, delivery_method, payment_status,');
push('  payment_provider, payment_reference, paid_at, created_at');
push(') values');

const orderValues = [];
const itemValues = [];
const voucherValues = [];
const ledgerValues = [];
const redemptionValues = [];
const redemptionItemValues = [];

MOCK_ORDERS.forEach((order, index) => {
  const orderId = uuidFor(order.id);
  const offer = MOCK_OFFERS.find((o) => o.id === order.offer_id);
  if (!offer) return;
  const itemId = uuidFor(`${order.id}:item`);
  const variantId = firstVariantByOffer.get(offer.id) ?? null;
  const voucherId = uuidFor(order.gift_card_id || `${order.id}:voucher`);
  const productId = uuidFor(offer.id);
  const card = MOCK_CARDS.find((c) => c.id === order.gift_card_id);

  orderValues.push(
    `  (${q(orderId)}, ${q(`ORD-${1000 + index}`)}, '${CUSTOMER_ID}', 'paid', 'QAR', ${order.amount_minor}, 0, 0, ${order.amount_minor}, ${q('Demo Customer')}, ${q(card?.message ?? null)}, 'email', 'paid', 'demo', ${q(order.payment_reference)}, ${q(order.created_at)}, ${q(order.created_at)})`,
  );
  itemValues.push(
    `  (${q(itemId)}, ${q(orderId)}, ${q(productId)}, ${q(variantId)}, ${q(uuidFor(offer.vendor_id))}, 1, ${order.amount_minor}, ${order.amount_minor}, ${order.commission_minor}, ${order.vendor_share_minor}, 'QAR', ${q(card?.message ?? null)}, ${q(card?.recipient_name ?? null)}, ${q(card?.recipient_email ?? null)}, null, 'email', null, ${q(order.created_at)})`,
  );

  const isSession = offer.fulfilment_type === 'experience';
  const totalSessions = isSession ? offer.session_count : null;
  const remaining = card ? (card.remaining_sessions ?? totalSessions ?? null) : null;
  voucherValues.push(
    `  (${q(voucherId)}, ${q(`GFT-${voucherId.slice(0, 6).toUpperCase()}`)}, ${q(`giftly:redeem:GFT-${voucherId.slice(0, 6).toUpperCase()}`)}, ${q(productId)}, ${q(variantId)}, ${q(uuidFor(offer.vendor_id))}, ${q(itemId)}, '${CUSTOMER_ID}', ${q(card?.recipient_name ?? 'Demo Customer')}, ${q(card?.recipient_email ?? null)}, ${q(card?.recipient_email ?? null)}, '${isSession ? 'experience' : 'monetary'}', 'claimed', ${order.amount_minor}, ${isSession ? 'null' : (card?.balance_minor ?? order.amount_minor)}, ${totalSessions}, ${remaining}, ${isSession ? (totalSessions - (remaining ?? 0)) : 0}, 'QAR', ${q(card?.expires_at ?? null)}, '${CUSTOMER_ID}', ${q(card?.claimed_at ?? order.created_at)}, ${q(card?.delivery_status ?? 'delivered')}, null, ${q(card?.message ?? null)}, ${q(order.created_at)}, ${q(order.created_at)})`,
  );

  ledgerValues.push(
    `  (${q(uuidFor(`${order.id}:issue`))}, ${q(voucherId)}, ${q(orderId)}, 'issue', ${order.amount_minor}, ${isSession ? totalSessions : 0}, ${q(order.created_at)})`,
  );
  if (!isSession && card && card.balance_minor !== undefined && card.balance_minor < order.amount_minor) {
    ledgerValues.push(
      `  (${q(uuidFor(`${order.id}:redeem`))}, ${q(voucherId)}, null, 'redeem', ${card.balance_minor - order.amount_minor}, 0, ${q(card.created_at)})`,
    );
  }
});

push(orderValues.join(',\n') + ';');
push('');
push('insert into public.order_items (');
push('  id, order_id, product_id, product_variant_id, vendor_id, quantity, unit_price_minor,');
push('  total_minor, commission_minor, vendor_share_minor, currency, gift_message,');
push('  recipient_name, recipient_email, recipient_phone, delivery_method, scheduled_for, created_at');
push(') values');
push(itemValues.join(',\n') + ';');
push('');
push('insert into public.vouchers (');
push('  id, voucher_code, qr_payload, product_id, product_variant_id, vendor_id, order_item_id,');
push('  buyer_id, recipient_name, recipient_email, recipient_phone, fulfilment_type, status,');
push('  initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions,');
push('  used_sessions, currency, expires_at, claimed_by, claimed_at, delivery_status,');
push('  scheduled_for, gift_message, created_at, updated_at');
push(') values');
push(voucherValues.join(',\n') + ';');
push('');
push('insert into public.ledger_entries (id, voucher_id, order_id, entry_type, amount_minor, sessions, created_at) values');
push(ledgerValues.join(',\n') + ';');
push('');

// ---------------------------------------------------------------------------
// Vendor cards that still need serving
// ---------------------------------------------------------------------------
push('-- Vouchers the vendor still has to serve');
push('insert into public.vouchers (');
push('  id, voucher_code, qr_payload, product_id, vendor_id, buyer_id, recipient_name,');
push('  recipient_email, fulfilment_type, status, initial_value_minor, remaining_value_minor,');
push('  total_sessions, remaining_sessions, used_sessions, currency, expires_at, claimed_by,');
push('  claimed_at, delivery_status, gift_message, created_at, updated_at');
push(') values');
const vendorCardValues = [];
const vendorLedgerValues = [];
const vendorRedemptionValues = [];
const vendorRedemptionItemValues = [];

for (const card of MOCK_VENDOR_CARDS) {
  const offer = MOCK_OFFERS.find((o) => o.id === card.offer_id);
  if (!offer) continue;
  const voucherId = uuidFor(card.id);
  const isSession = card.fulfilment_type === 'experience';
  const totalSessions = isSession ? card.total_sessions : null;
  const remaining = isSession ? card.remaining_sessions : null;
  const used = isSession ? totalSessions - remaining : 0;
  const code = `GFT-${voucherId.slice(0, 6).toUpperCase()}`;

  vendorCardValues.push(
    `  (${q(voucherId)}, ${q(code)}, ${q(`giftly:redeem:${code}`)}, ${q(uuidFor(offer.id))}, ${q(uuidFor(offer.vendor_id))}, ${q(uuidFor(`buyer:${card.recipient_name}`))}, ${q(card.recipient_name)}, ${q(card.recipient_email)}, '${isSession ? 'experience' : 'monetary'}', 'claimed', ${card.original_value_minor}, ${isSession ? 'null' : card.balance_minor}, ${totalSessions}, ${remaining}, ${used}, 'QAR', ${q(card.expires_at)}, ${q(uuidFor(`buyer:${card.recipient_name}`))}, ${q(card.claimed_at)}, 'opened', ${q(card.message)}, ${q(card.created_at)}, ${q(card.created_at)})`,
  );
  vendorLedgerValues.push(
    `  (${q(uuidFor(`${card.id}:issue`))}, ${q(voucherId)}, null, 'issue', ${card.original_value_minor}, ${isSession ? totalSessions : 0}, ${q(card.created_at)})`,
  );
  if (used > 0 || (!isSession && card.balance_minor !== card.original_value_minor)) {
    vendorLedgerValues.push(
      `  (${q(uuidFor(`${card.id}:used`))}, ${q(voucherId)}, null, 'redeem', ${isSession ? '0' : card.balance_minor - card.original_value_minor}, ${isSession ? -used : 0}, ${q(card.created_at)})`,
    );
  }
}

// The seeded redemption history.
for (const entry of MOCK_REDEMPTIONS) {
  const voucherId = uuidFor(entry.card_id);
  const card = MOCK_VENDOR_CARDS.find((c) => c.id === entry.card_id);
  const offer = MOCK_OFFERS.find((o) => o.id === card?.offer_id);
  const redemptionId = uuidFor(entry.id);
  const reference = `RDM-SEED-${entry.id.replace(/\D/g, '').padStart(4, '0')}`;
  vendorRedemptionValues.push(
    `  (${q(redemptionId)}, ${q(reference)}, ${q(voucherId)}, ${q(uuidFor(offer?.vendor_id ?? 'vendor-1'))}, ${q('44444444-4444-4444-8444-444444444444')}, '${entry.kind === 'session' ? 'session' : 'monetary'}', ${entry.kind === 'session' ? (entry.sessions ?? 1) : 'null'}, ${entry.kind === 'value' ? (entry.amount_minor ?? 0) : 'null'}, ${entry.kind === 'session' ? (entry.sessions ?? 1) : 1}, 'completed', ${q(offer?.title ?? null)}, ${q(entry.note ?? null)}, ${q(entry.created_at)}, ${q(entry.created_at)})`,
  );
  vendorRedemptionItemValues.push(
    `  (${q(uuidFor(`${entry.id}:item`))}, ${q(redemptionId)}, ${q(voucherId)}, ${entry.kind === 'session' ? (entry.sessions ?? 1) : 'null'}, ${entry.kind === 'value' ? (entry.amount_minor ?? 0) : 'null'}, ${q(offer?.title ?? null)}, ${q('44444444-4444-4444-8444-444444444444')}, ${q(entry.created_at)})`,
  );
}

push(vendorCardValues.join(',\n') + ';');
push('');
push('insert into public.ledger_entries (id, voucher_id, order_id, entry_type, amount_minor, sessions, created_at) values');
push(vendorLedgerValues.join(',\n') + ';');
push('');
push('insert into public.redemptions (');
push('  id, reference, voucher_id, vendor_id, staff_user_id, kind, sessions, amount_minor,');
push('  quantity, status, service_label, notes, occurred_at, created_at');
push(') values');
push(vendorRedemptionValues.join(',\n') + ';');
push('');
push('insert into public.redemption_items (id, redemption_id, voucher_id, sessions, amount_minor, service_label, staff_user_id, created_at) values');
push(vendorRedemptionItemValues.join(',\n') + ';');
push('');

// ---------------------------------------------------------------------------
// Enterprise partner and code inventory
// ---------------------------------------------------------------------------
const PARTNER_ID = uuidFor('partner:retailplus');
push('-- ---------------------------------------------------------------------');
push('-- Enterprise partner: products, imported codes and their history');
push('-- ---------------------------------------------------------------------');
push('insert into public.enterprise_partners (');
push('  id, owner_id, name, slug, website, contact_name, contact_email, contact_phone,');
push('  industry, expected_volume, status, integration_config, settlement_terms');
push(') values');
push(
  `  (${q(PARTNER_ID)}, '55555555-5555-4555-8555-555555555555', 'RetailPlus Rewards', 'retailplus-rewards', 'https://retailplus.example', 'Nadia Haddad', 'partner@giftly.test', '+974 5555 0900', 'Retail', '25,000 codes / quarter', 'active', '{}'::jsonb, '{"model":"wholesale","net_days":30}'::jsonb)`,
);
push('on conflict (id) do nothing;');
push('');

push('insert into public.enterprise_members (partner_id, user_id, role) values');
push(`  (${q(PARTNER_ID)}, '55555555-5555-4555-8555-555555555555', 'owner')`);
push('on conflict (partner_id, user_id) do nothing;');
push('');

const EP1 = uuidFor('ep:retailplus-gift-card');
const EP2 = uuidFor('ep:retailplus-voucher');
push('insert into public.enterprise_products (');
push('  id, partner_id, name, external_ref, denomination_minor, currency, selling_price_minor,');
push('  wholesale_cost_minor, commission_bps, terms_and_conditions, redemption_instructions,');
push('  expiry_days, is_active');
push(') values');
push(
  `  (${q(EP1)}, ${q(PARTNER_ID)}, 'RetailPlus Gift Card', 'RP-GC-100', 10000, 'QAR', 12000, 9000, 2500, 'Valid for 12 months from issue.', 'Enter the code at any RetailPlus checkout.', 365, true),`,
);
push(
  `  (${q(EP2)}, ${q(PARTNER_ID)}, 'RetailPlus Digital Voucher', 'RP-DV-250', 25000, 'QAR', 28000, 22000, 2000, 'Valid for 6 months from issue.', 'Redeem online with the code.', 180, true)`,
);
push('on conflict (id) do nothing;');
push('');

// Marketplace products that sell the partner codes.
push('insert into public.products (');
push('  id, vendor_id, category_id, fulfilment_type, enterprise_product_id, title, title_ar,');
push('  slug, description, terms_and_conditions, redemption_instructions, booking_required,');
push('  split_session_allowed, multi_session_per_visit, session_count, min_amount_minor,');
push('  max_amount_minor, preset_amounts_minor, currency, expiry_days, valid_until, is_active,');
push('  status, icon, tone, rating, location, occasions, created_at');
push(') values');
const EP_PRODUCTS = [
  [uuidFor('prod:ep-gc'), EP1, 'RetailPlus Gift Card', 'بطاقة هدية RetailPlus', 'shopping', 'retailplus-gift-card', 10000, 10000, 12000, 365],
  [uuidFor('prod:ep-dv'), EP2, 'RetailPlus Digital Voucher', 'بطاقة رقمية RetailPlus', 'shopping', 'retailplus-digital-voucher', 25000, 25000, 28000, 180],
];
push(
  EP_PRODUCTS.map(
    ([id, epId, title, titleAr, category, slug, denom, minAmount, price, expiryDays]) =>
      `  (${q(id)}, null, ${q(uuidFor(`category:${category}`))}, 'enterprise_code', ${q(epId)}, ${q(title)}, ${q(titleAr)}, ${q(slug)}, ${q('A digital gift card supplied by RetailPlus, redeemed at any RetailPlus checkout.')}, ${q('Valid for the stated period from issue.')}, ${q('Enter the code at checkout.')}, false, true, true, null, ${minAmount}, ${minAmount}, '{${denom}}', 'QAR', ${expiryDays}, now() + interval '${expiryDays} days', true, 'published', 'creditCard', 'gold', 4.6, 'Doha', '{just-because,thank-you}', now())`,
  ).join(',\n') + ';',
);
push('');

// The encryption key used by the seeded inventory.
push('-- The encryption key for the seeded inventory. Replace it in production.');
push("insert into public.system_settings (key, value, description, is_public)");
push("values ('enterprise.code_encryption_key', jsonb_build_object('key', 'giftly-dev-enterprise-code-key-please-rotate'), 'Development key for enterprise code encryption.', false)");
push('on conflict (key) do update set value = excluded.value;');
push('');

// Import a batch of codes straight into the inventory, encrypted.
push('insert into public.enterprise_import_batches (id, partner_id, filename, source, status, created_by) values');
push(`  (${q(uuidFor('batch:retailplus'))}, ${q(PARTNER_ID)}, 'retailplus-q1.csv', 'csv', 'completed', '55555555-5555-4555-8555-555555555555')`);
push('on conflict (id) do nothing;');
push('');

const codeRows = [];
for (let i = 1; i <= 120; i += 1) {
  const code = `RP-${String(100000 + i * 137).slice(0, 6)}-${i.toString().padStart(4, '0')}`;
  const product = i % 3 === 0 ? EP2 : EP1;
  const denomination = i % 3 === 0 ? 25000 : 10000;
  // Only codes that were never allocated may sit without an order.
  const status =
    i <= 100 ? 'available' : i <= 105 ? 'quarantined' : i <= 110 ? 'expired' : 'invalid';
  codeRows.push(
    `  ('${code}', ${q(product)}, ${denomination}, '${status}')`,
  );
}

push('insert into public.enterprise_code_inventory (');
push('  partner_id, enterprise_product_id, import_batch_id, inventory_ref, code_ciphertext,');
push('  code_fingerprint, code_last4, denomination_minor, currency, status, created_at, updated_at');
push(')');
push('select');
push(`  '${PARTNER_ID}',`);
push(`  v.enterprise_product_id::uuid,`);
push(`  ${q(uuidFor('batch:retailplus'))},`);
push(`  'INV-' || upper(substr(public.enterprise_code_fingerprint('${PARTNER_ID}', v.code), 1, 10)),`);
push('  extensions.pgp_sym_encrypt(v.code, public.enterprise_code_key()),');
push(`  public.enterprise_code_fingerprint('${PARTNER_ID}', v.code),`);
push("  right(v.code, 4),");
push('  v.denomination_minor,');
push("  'QAR',");
push('  v.status::public.inventory_status,');
push('  now(), now()');
push('from (values');
push(codeRows.join(',\n'));
push(') as v(code, enterprise_product_id, denomination_minor, status)');
push('on conflict (code_fingerprint) do nothing;');
push('');

push("insert into public.enterprise_code_events (inventory_id, partner_id, event_type, actor_user_id)");
push(`select i.id, i.partner_id, 'imported', '55555555-5555-4555-8555-555555555555'`);
push('from public.enterprise_code_inventory i');
push(`where i.partner_id = '${PARTNER_ID}'`);
push('on conflict do nothing;');
push('');

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
push('-- ---------------------------------------------------------------------');
push('-- Campaigns and featured placements');
push('-- ---------------------------------------------------------------------');
push('insert into public.campaigns (id, name, kind, status, starts_at, ends_at, priority) values');
push(
  `  (${q(uuidFor('campaign:launch'))}, 'Launch campaign', 'banner', 'live', now() - interval '7 days', now() + interval '30 days', 10),`,
);
push(
  `  (${q(uuidFor('campaign:featured'))}, 'Featured vendors', 'featured_vendor', 'live', now() - interval '7 days', now() + interval '30 days', 5)`,
);
push('on conflict (id) do nothing;');
push('');
push('insert into public.banners (id, campaign_id, title, subtitle, cta_label, cta_url, active) values');
push(
  `  (${q(uuidFor('banner:launch'))}, ${q(uuidFor('campaign:launch'))}, 'Gifts are better together', 'Start a basket and invite your friends.', 'Explore the app', '/download', true)`,
);
push('on conflict (id) do nothing;');
push('');

push('commit;');
push('');

fs.writeFileSync(path.join(root, 'supabase/seed.sql'), lines.join('\n'));
console.log('seed.sql written:', lines.length, 'lines');
console.log('products:', productValues.length, 'variants:', variantValues.length);
console.log('vouchers:', voucherValues.length + vendorCardValues.length);
