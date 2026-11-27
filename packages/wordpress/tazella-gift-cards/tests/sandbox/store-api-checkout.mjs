/**
 * Blocks checkout end to end, over the real WooCommerce Store API.
 *
 *   SITE_URL=http://127.0.0.1:8088 PRODUCT_ID=12 MOCK_URL=http://127.0.0.1:9099 \
 *     node store-api-checkout.mjs
 *
 * This drives the same HTTP endpoints the block checkout uses: cart → add-item →
 * checkout with `payment_data`, so the plugin's Blocks integration and the
 * `capture_block_card_code` hook are exercised for real, not just registered.
 *
 * It also proves the server refuses an order with no card code, which is the
 * backstop for the client-side validation in assets/js/blocks.js.
 */
const SITE_URL = (process.env.SITE_URL || 'http://127.0.0.1:8088').replace(/\/$/, '');
const MOCK_URL = (process.env.MOCK_URL || 'http://127.0.0.1:9099').replace(/\/$/, '');
const PRODUCT_ID = Number(process.env.PRODUCT_ID || 0);
const CARD = process.env.CARD_CODE || 'SBX-GOOD';

let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
    return true;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  return false;
}

async function mockState() {
  const response = await fetch(`${MOCK_URL}/__test/state`);
  const body = await response.json();
  return body.data ?? {};
}

async function mockReset() {
  await fetch(`${MOCK_URL}/__test/reset`);
}

function headersFrom(response, nonce, cartToken) {
  return {
    Nonce: nonce,
    'Cart-Token': cartToken,
    'Content-Type': 'application/json',
  };
}

function apiUrl(path) {
  // PHP's built-in server has no rewrite engine, so a site served with it needs
  // the query-string REST form.
  return process.env.REST_ROUTE === '1'
    ? `${SITE_URL}/index.php?rest_route=${encodeURIComponent(`/wc/store/v1${path}`)}`
    : `${SITE_URL}/wp-json/wc/store/v1${path}`;
}

async function storeRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), options);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

async function main() {
  if (!PRODUCT_ID) {
    console.error('PRODUCT_ID is required');
    process.exit(2);
  }

  await mockReset();

  const cart = await storeRequest('/cart');
  const nonce = cart.headers.get('nonce') || cart.headers.get('Nonce');
  const cartToken = cart.headers.get('cart-token') || cart.headers.get('Cart-Token');
  if (!nonce || !cartToken) {
    console.error('Store API did not return a cart nonce/token', cart.status, cart.body);
    process.exit(2);
  }

  const added = await storeRequest('/cart/add-item', {
    method: 'POST',
    headers: headersFrom(null, nonce, cartToken),
    body: JSON.stringify({ id: PRODUCT_ID, quantity: 1 }),
  });
  check('item can be added to the Store API cart', added.status === 200 || added.status === 201, `${added.status} ${JSON.stringify(added.body).slice(0, 200)}`);
  const cartTotal = added.body?.totals?.total_price;
  check('cart total is 150.00 in minor-ish Store API units', String(cartTotal) === '15000', String(cartTotal));

  const cartAfterAdd = await storeRequest('/cart', {
    headers: { Nonce: nonce, 'Cart-Token': cartToken },
  });
  // The Store API returns ids as strings here, but objects on some versions.
  const methods = (cartAfterAdd.body?.payment_methods ?? []).map((method) =>
    typeof method === 'string' ? method : method?.id,
  );
  if (methods.length > 0) {
    check('block checkout lists the Tazella payment method', methods.includes('tazella_gift_cards'), methods.join(','));
  } else {
    console.log('SKIP  cart response carries no payment_methods list; checkout below still proves registration');
  }

  const baseCheckout = {
    billing_address: {
      first_name: 'Sandbox',
      last_name: 'Buyer',
      address_1: 'Test Street 1',
      city: 'Doha',
      country: 'QA',
      email: 'buyer@example.test',
    },
    shipping_address: {
      first_name: 'Sandbox',
      last_name: 'Buyer',
      address_1: 'Test Street 1',
      city: 'Doha',
      country: 'QA',
    },
    payment_method: 'tazella_gift_cards',
  };

  const empty = await storeRequest('/checkout', {
    method: 'POST',
    headers: headersFrom(null, nonce, cartToken),
    body: JSON.stringify({
      ...baseCheckout,
      payment_data: [{ key: 'tazella_card_code', value: '' }],
    }),
  });
  const emptyMessage = JSON.stringify(empty.body ?? '');
  check('checkout with an empty card code is rejected', empty.status === 400, `${empty.status} ${emptyMessage.slice(0, 200)}`);
  let state = await mockState();
  check('a rejected checkout creates no hold', Object.keys(state.reservations ?? {}).length === 0);

  const done = await storeRequest('/checkout', {
    method: 'POST',
    headers: headersFrom(null, nonce, cartToken),
    body: JSON.stringify({
      ...baseCheckout,
      payment_data: [{ key: 'tazella_card_code', value: CARD }],
    }),
  });
  check('block checkout completes with a good card', done.status === 200, `${done.status} ${JSON.stringify(done.body).slice(0, 300)}`);
  check('block checkout returns an order id', Number(done.body?.order_id) > 0, String(done.body?.order_id));
  check('block order status is processing', done.body?.status === 'processing', String(done.body?.status));

  state = await mockState();
  const reservations = Object.values(state.reservations ?? {});
  const redemptions = Object.values(state.redemptions ?? {});
  check('one hold was created for the block checkout', reservations.length === 1, String(reservations.length));
  check('one redemption was captured', redemptions.length === 1, String(redemptions.length));
  check('applied amount matches the 150.00 total', redemptions[0]?.amount_minor === 15000, String(redemptions[0]?.amount_minor));
  check('the card code is not stored in the gateway log', !JSON.stringify(state.events ?? []).includes(CARD));

  if (process.env.ORDER_ID_CHECK) {
    console.log(`order id: ${done.body?.order_id}`);
  }

  console.log('');
  console.log(`Result: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((failure) => console.log(`  - ${failure}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
