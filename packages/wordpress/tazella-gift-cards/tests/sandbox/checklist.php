<?php
/**
 * Go-live checklist, executed inside a real WordPress + WooCommerce install.
 *
 *   wp eval-file tests/sandbox/checklist.php
 *
 * The WordPress site must have the plugin active and the mock gateway running
 * (tests/sandbox/mock-gateway.mjs). Every assertion prints PASS/FAIL; the
 * process exits non-zero when anything fails.
 *
 * This exercises the real gateway class, the real WC_Order objects and the
 * real HTTP client. It does not replace a browser walk through the checkout
 * form, which is covered separately by tests/sandbox/store-api-checkout.mjs.
 */

if (!class_exists('WooCommerce') || !class_exists('WC_Payment_Gateway')) {
    WP_CLI::error('WooCommerce must be active.');
}

const TAZELLA_SANDBOX_KEY = 'tz_sandbox_wp_mock_key';
const TAZELLA_SANDBOX_SECRET = 'wp_mock_secret';
const TAZELLA_MOCK = 'http://127.0.0.1:9099';

// `wp eval-file` runs the file inside a function, so top-level variables are
// not globals. Keep the counters in $GLOBALS so check() can reach them.
$GLOBALS['tazella_results'] = ['pass' => 0, 'fail' => 0, 'failures' => []];

// No mail server in a sandbox; do not let order emails spam the log.
add_filter('pre_wp_mail', static function () {
    return true;
});

// A fresh WooCommerce store defaults to USD. These checks describe a QAR shop,
// so pin the store currency instead of inheriting whatever the install chose.
if (function_exists('get_woocommerce_currency') && get_woocommerce_currency() !== 'QAR') {
    update_option('woocommerce_currency', 'QAR');
}

function check($name, $condition, $detail = '')
{
    $results = &$GLOBALS['tazella_results'];
    if ($condition) {
        $results['pass']++;
        WP_CLI::log("PASS  $name");
        return true;
    }
    $results['fail']++;
    $results['failures'][] = $name . ($detail !== '' ? " — $detail" : '');
    WP_CLI::log("FAIL  $name" . ($detail !== '' ? " — $detail" : ''));
    return false;
}

function mock_reset()
{
    return mock_call('/__test/reset');
}

function mock_call($path, $query = '')
{
    $url = TAZELLA_MOCK . $path . ($query !== '' ? '?' . $query : '');
    $response = wp_remote_get($url, ['timeout' => 10]);
    if (is_wp_error($response)) {
        return null;
    }
    $body = json_decode(wp_remote_retrieve_body($response), true);
    return is_array($body) ? ($body['data'] ?? null) : null;
}

function mock_state()
{
    return mock_call('/__test/state') ?? [];
}

function gateway($overrides = [])
{
    $settings = get_option('woocommerce_tazella_gift_cards_settings', []);
    $settings = array_merge($settings, [
        'enabled' => 'yes',
        'environment' => 'sandbox',
        'base_url' => TAZELLA_MOCK,
        'platform_code' => 'wordpress',
        'api_key' => TAZELLA_SANDBOX_KEY,
        'signing_secret' => TAZELLA_SANDBOX_SECRET,
        'currency' => 'QAR',
        'external_vendor_id' => '',
        'external_branch_id' => '',
        // Explicit: earlier sections switch split tender on, and a re-run must
        // not inherit that from wp_options.
        'partial_payments' => 'no',
        'debug' => 'yes',
    ], $overrides);
    update_option('woocommerce_tazella_gift_cards_settings', $settings);

    // WooCommerce builds its gateway instances at init. On a fresh install that
    // happens before any settings exist, so the instance the checkout, sweep and
    // refund paths use would otherwise keep empty credentials for this process.
    if (function_exists('WC') && WC()->payment_gateways()) {
        $live = WC()->payment_gateways()->payment_gateways()['tazella_gift_cards'] ?? null;
        if ($live instanceof Tazella_WooCommerce_Gateway) {
            $live->init_settings();
        }
    }

    return new Tazella_WooCommerce_Gateway();
}

function make_product($price = '150.00')
{
    $product = new WC_Product_Simple();
    $product->set_name('Sandbox gift-card product');
    $product->set_regular_price($price);
    $product->set_status('publish');
    $product->set_catalog_visibility('hidden');
    $product->save();
    return $product;
}

function make_order($price = '150.00', $card = null)
{
    static $product = null;
    if ($product === null) {
        $product = make_product();
    }
    $order = wc_create_order();
    $order->add_product($product, 1);
    $order->set_currency('QAR');
    $order->set_payment_method('tazella_gift_cards');
    $order->set_address([
        'first_name' => 'Sandbox',
        'last_name' => 'Buyer',
        'address_1' => 'Test Street 1',
        'city' => 'Doha',
        'country' => 'QA',
        'email' => 'buyer@example.test',
    ], 'billing');
    $order->calculate_totals();
    $order->save();
    if ($card !== null) {
        $order->update_meta_data('_tazella_card_code', $card);
        $order->save_meta_data();
    }
    return $order;
}

function pay($order, $gateway, $card)
{
    $_POST['tazella_card_code'] = $card;
    $result = $gateway->process_payment($order->get_id());
    unset($_POST['tazella_card_code']);
    $order = wc_get_order($order->get_id());
    return [$result, $order];
}

function notices($type = 'error')
{
    if (!function_exists('wc_get_notices') || !WC()->session) {
        return [];
    }
    return wp_list_pluck(wc_get_notices($type), 'notice');
}

function clear_notices()
{
    if (function_exists('wc_clear_notices') && WC()->session) {
        wc_clear_notices();
    }
}

function gateway_log_contents()
{
    $dir = WC_LOG_DIR ?? (WP_CONTENT_DIR . '/uploads/wc-logs/');
    $files = glob($dir . 'tazella-gift-cards-*.log');
    if (!$files) {
        return '';
    }
    sort($files);
    return implode("\n", array_map('file_get_contents', $files));
}

// The plugin-notice check reads debug.log, so start it clean: earlier runs and
// other plugins must not decide this result.
@file_put_contents(WP_CONTENT_DIR . '/debug.log', '');

WP_CLI::log('— gateway registration —————————————————————————————');

$registered = WC()->payment_gateways()->payment_gateways();
check(
    'gateway is registered with WooCommerce',
    isset($registered['tazella_gift_cards']) && $registered['tazella_gift_cards'] instanceof Tazella_WooCommerce_Gateway,
    wp_json_encode(array_keys($registered))
);

$gateway = gateway();
check('gateway id is tazella_gift_cards', $gateway->id === 'tazella_gift_cards');
check('gateway declares refunds support', $gateway->supports('refunds'));
check('gateway declares products support', $gateway->supports('products'));

WP_CLI::log('— visibility gating —————————————————————————————————');

$noCreds = gateway(['api_key' => '', 'signing_secret' => '']);
check('hidden without credentials', $noCreds->is_available() === false);

$wrongCurrency = gateway(['currency' => 'USD']);
check('hidden when store currency differs from the configured currency', $wrongCurrency->is_available() === false);

$autoCurrency = gateway(['currency' => '']);
check('empty currency falls back to the store currency', $autoCurrency->is_available() === true);

$gateway = gateway();
check('available with credentials and matching currency', $gateway->is_available() === true);
check('gateway exposes the Tazella icon', strpos($gateway->get_icon(), 'tazella-wordmark.svg') !== false, $gateway->get_icon());

WP_CLI::log('— connection check ——————————————————————————————————');

ob_start();
$gateway->admin_options();
$admin_html = ob_get_clean();
check(
    'settings page reports a verified connection',
    strpos($admin_html, 'Connection verified: wordpress (sandbox, platform active)') !== false,
    wp_strip_all_tags(substr($admin_html, 0, 300))
);

$badKey = gateway(['api_key' => 'wrong-key']);
ob_start();
$badKey->admin_options();
$badHtml = ob_get_clean();
check(
    'settings page reports UNAUTHORIZED for a wrong key',
    strpos($badHtml, 'UNAUTHORIZED') !== false,
    wp_strip_all_tags(substr($badHtml, 0, 300))
);
$gateway = gateway();

WP_CLI::log('— classic checkout field ————————————————————————————');

ob_start();
$gateway->payment_fields();
$fields = ob_get_clean();
check('card field renders in the classic checkout', strpos($fields, 'name="tazella_card_code"') !== false, $fields);
check('classic checkout renders the branded Tazella panel', strpos($fields, 'tazella-gift-card-panel') !== false, $fields);
check('classic checkout shows the Tazella wordmark', strpos($fields, 'tazella-wordmark.svg') !== false, $fields);

$_POST['tazella_card_code'] = '';
$emptyOk = $gateway->validate_fields();
unset($_POST['tazella_card_code']);
check('empty card code is rejected by validate_fields()', $emptyOk === false);

WP_CLI::log('— rejected cards ———————————————————————————————————');

mock_reset();
clear_notices();
$order = make_order();
[$result, $order] = pay($order, $gateway, 'SBX-NOPE');
check('unknown card fails the payment', ($result['result'] ?? '') === 'failure');
check('order is marked failed for an unknown card', $order->get_status() === 'failed');
check(
    'customer sees the public CARD_NOT_FOUND message',
    in_array('This gift card cannot be used here.', notices(), true),
    implode(' | ', notices())
);
$state = mock_state();
check('no reservation is created for an unknown card', count($state['reservations'] ?? []) === 0);

clear_notices();
$order = make_order();
[$result, $order] = pay($order, $gateway, 'SBX-EXPIRED');
check('expired card fails the payment', ($result['result'] ?? '') === 'failure' && $order->get_status() === 'failed');
check(
    'customer sees the CARD_EXPIRED message',
    in_array('This gift card has expired.', notices(), true),
    implode(' | ', notices())
);

clear_notices();
$order = make_order();
[$result, $order] = pay($order, $gateway, 'SBX-LOW');
check('card below the order total fails the payment', ($result['result'] ?? '') === 'failure');
check('order is not paid when the balance is too low', $order->is_paid() === false && $order->get_status() === 'failed');
check(
    'customer sees the INSUFFICIENT_BALANCE message',
    in_array('This gift card does not have enough available balance.', notices(), true),
    implode(' | ', notices())
);

WP_CLI::log('— partial hold refusal —————————————————————————————');

mock_reset();
mock_call('/__test/partial-reserve', 'value=true');
clear_notices();
$order = make_order();
[$result, $order] = pay($order, $gateway, 'SBX-GOOD');
$state = mock_state();
$reservations = array_values($state['reservations'] ?? []);
check('a reservation that applies less than the total fails the order', ($result['result'] ?? '') === 'failure');
check('the underpaid order is not marked paid', $order->is_paid() === false);
check('the partial hold is released', ($reservations[0]['status'] ?? '') === 'released', wp_json_encode($reservations));
mock_call('/__test/partial-reserve', 'value=false');

WP_CLI::log('— successful capture ———————————————————————————————');

mock_reset();
clear_notices();
$order = make_order();
$totalMinor = (int) round(((float) $order->get_total()) * 100);
[$result, $order] = pay($order, $gateway, 'SBX-GOOD');
check('good card completes the payment', ($result['result'] ?? '') === 'success', wp_json_encode($result));
check('order is paid', $order->is_paid() === true, 'status=' . $order->get_status());
check('order status is processing', $order->get_status() === 'processing', 'status=' . $order->get_status());
check('_tazella_status is captured', $order->get_meta('_tazella_status') === 'captured');
check('reservation reference is stored', (string) $order->get_meta('_tazella_reservation_reference') !== '');
check(
    'redemption id is a UUID',
    (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', (string) $order->get_meta('_tazella_redemption_id')),
    (string) $order->get_meta('_tazella_redemption_id')
);
check('redemption reference is stored', strpos((string) $order->get_meta('_tazella_redemption_reference'), 'ird_') === 0);
check('card code is not persisted after capture', $order->get_meta('_tazella_card_code') === '');
check(
    'order total equals the applied amount',
    (int) $order->get_meta('_tazella_applied_minor') === $totalMinor,
    $order->get_meta('_tazella_applied_minor') . ' vs ' . $totalMinor
);
check('order transaction id is the redemption reference', $order->get_transaction_id() === (string) $order->get_meta('_tazella_redemption_reference'));

$state = mock_state();
check('exactly one reservation was made', count($state['reservations'] ?? []) === 1, (string) count($state['reservations'] ?? []));
check('exactly one redemption exists', count($state['redemptions'] ?? []) === 1, (string) count($state['redemptions'] ?? []));

$reserveRequest = null;
foreach ($state['requests'] ?? [] as $request) {
    if ($request['path'] === '/api/integrations/v1/reservations') {
        $reserveRequest = $request;
    }
}
check('reserve sends the X-Platform-Code header', ($reserveRequest['platform'] ?? '') === 'wordpress');
check('reserve sends the X-Environment header', ($reserveRequest['environment'] ?? '') === 'sandbox');
check('reserve sends a deterministic idempotency key', strpos((string) ($reserveRequest['idempotency_key'] ?? ''), 'php_') === 0, (string) ($reserveRequest['idempotency_key'] ?? ''));
check('reserve sends the order amount in minor units', (int) ($reserveRequest['body']['order_amount_minor'] ?? 0) === $totalMinor);
check('reserve omits external_vendor_id when the setting is empty', !isset($reserveRequest['body']['external_vendor_id']));

WP_CLI::log('— idempotency / retry safety ———————————————————————');

mock_reset();
clear_notices();
$order = make_order();
mock_call('/__test/fail-next-capture');
[$result, $order] = pay($order, $gateway, 'SBX-GOOD');
check('a capture transport failure fails the order', ($result['result'] ?? '') === 'failure');
check('the hold stays recorded on the order', (string) $order->get_meta('_tazella_reservation_reference') !== '');
$state = mock_state();
$reference = array_key_first($state['reservations'] ?? []);
check('exactly one hold exists after the failure', count($state['reservations'] ?? []) === 1);

$order->set_status('pending');
$order->save();
clear_notices();
[$result, $order] = pay($order, $gateway, 'SBX-GOOD');
$state = mock_state();
check('the retry succeeds', ($result['result'] ?? '') === 'success', wp_json_encode($result));
check('the retry reuses the same hold', count($state['reservations'] ?? []) === 1 && array_key_first($state['reservations']) === $reference);
check('the retry creates exactly one redemption', count($state['redemptions'] ?? []) === 1, (string) count($state['redemptions'] ?? []));
check('the retry does not double-charge the card', (int) $order->get_meta('_tazella_applied_minor') === $totalMinor);

WP_CLI::log('— cancellation releases the hold ———————————————————');

mock_reset();
clear_notices();
$order = make_order();
mock_call('/__test/fail-next-capture');
pay($order, $gateway, 'SBX-GOOD');
$order = wc_get_order($order->get_id());
$order->update_status('cancelled', 'sandbox cancel');
$order = wc_get_order($order->get_id());
$state = mock_state();
$reservation = array_values($state['reservations'] ?? [])[0] ?? [];
check('cancelling a pending order releases the hold', ($reservation['status'] ?? '') === 'released', wp_json_encode($reservation));
check('order records the release', $order->get_meta('_tazella_status') === 'released');

WP_CLI::log('— refunds ——————————————————————————————————————————');

mock_reset();
$order = make_order();
[$result, $order] = pay($order, $gateway, 'SBX-GOOD');
$redemptionId = (string) $order->get_meta('_tazella_redemption_id');

$refund = wc_create_refund([
    'order_id' => $order->get_id(),
    'amount' => 50,
            'reason' => 'sandbox partial refund',
        // WooCommerce 11 renamed this key from api_refund to refund_payment.
        'refund_payment' => true,
    ]);
    check('first refund succeeds', !is_wp_error($refund), is_wp_error($refund) ? $refund->get_error_message() : '');
$state = mock_state();
check('the gateway recorded one reversal', count($state['refunds'] ?? []) === 1, (string) count($state['refunds'] ?? []));
check('the reversal uses the redemption UUID', ($state['refunds'][0]['redemption_id'] ?? '') === $redemptionId);
check('the reversal amount is correct', (int) ($state['refunds'][0]['amount_minor'] ?? 0) === 5000);

$second = wc_create_refund([
    'order_id' => $order->get_id(),
    'amount' => 50,
            'reason' => 'sandbox partial refund',
        'refund_payment' => true,
    ]);
    check('a second refund of the same amount succeeds', !is_wp_error($second), is_wp_error($second) ? $second->get_error_message() : '');
$state = mock_state();
check('two identical refunds create two reversals', count($state['refunds'] ?? []) === 2, (string) count($state['refunds'] ?? []));

// A refund on an order that was never captured must be refused, not guessed.
$unpaid = make_order();
$failedRefund = wc_create_refund([
    'order_id' => $unpaid->get_id(),
    'amount' => 10,
            'reason' => 'no redemption',
        'refund_payment' => true,
    ]);
check('refunding an order with no redemption is refused', is_wp_error($failedRefund) || $failedRefund === false);

WP_CLI::log('— order events ———————————————————————————————————————');

$state = mock_state();
$eventTypes = array_map(static fn ($event) => $event['event_type'] ?? '', $state['events'] ?? []);
check('an order.paid event was reported', in_array('order.paid', $eventTypes, true), implode(',', $eventTypes));
check('an order.refunded event was reported', in_array('order.refunded', $eventTypes, true), implode(',', $eventTypes));
check('no event carries a card code', strpos(wp_json_encode($state['events'] ?? []), 'SBX-GOOD') === false);

WP_CLI::log('— logging hygiene ———————————————————————————————————');

$log = gateway_log_contents();
check('the debug log exists', $log !== '');
check('the log never contains the API key', strpos($log, TAZELLA_SANDBOX_KEY) === false);
check('the log never contains the signing secret', strpos($log, TAZELLA_SANDBOX_SECRET) === false);
check('the log never contains a full card code', strpos($log, 'SBX-GOOD') === false && strpos($log, 'SBX-LOW') === false);
check('the log records error codes', strpos($log, 'CARD_NOT_FOUND') !== false || strpos($log, 'INSUFFICIENT_BALANCE') !== false);

WP_CLI::log('— classic checkout cart flow ———————————————————————');

if (!function_exists('wc_load_cart')) {
    WP_CLI::log('wc_load_cart() unavailable; skipping the cart-based classic checkout flow');
} else {
    mock_reset();
    clear_notices();
    $cartProduct = make_product('150.00');
    wc_load_cart();
    WC()->cart->empty_cart();
    WC()->cart->add_to_cart($cartProduct->get_id(), 1);
    WC()->cart->calculate_totals();

    $_POST = [
        'payment_method' => 'tazella_gift_cards',
        'billing_first_name' => 'Sandbox',
        'billing_last_name' => 'Buyer',
        'billing_address_1' => 'Test Street 1',
        'billing_city' => 'Doha',
        'billing_country' => 'QA',
        'billing_email' => 'buyer@example.test',
        'tazella_card_code' => '',
    ];

    // WC_Checkout::process_checkout() runs validate_checkout() before it creates
    // the order, and validate_checkout() calls the chosen gateway's
    // validate_fields(). That is the rejection point for an empty card code.
    $validationData = $_POST;
    $validationErrors = new WP_Error();
    $checkout = WC()->checkout();
    // validate_checkout() is protected; call it exactly as process_checkout() does.
    $validate = new ReflectionMethod($checkout, 'validate_checkout');
    $validate->setAccessible(true);
    $arguments = [&$validationData, &$validationErrors];
    $validate->invokeArgs($checkout, $arguments);
    $errorMessages = array_map(static fn ($notice) => $notice['notice'], wc_get_notices('error'));
    $errorMessages = array_merge($errorMessages, $validationErrors->get_error_messages());
    check(
        'classic checkout rejects an empty card code',
        in_array('Enter a gift card code.', $errorMessages, true),
        implode(' | ', $errorMessages)
    );
    check('the empty card code blocks the checkout with an error notice', wc_notice_count('error') > 0);

    clear_notices();
    $_POST['tazella_card_code'] = 'SBX-GOOD';
    $classicOrderId = WC()->checkout()->create_order($_POST);
    check('classic checkout creates an order with the gateway', is_numeric($classicOrderId) && $classicOrderId > 0);
    $classicOrder = wc_get_order($classicOrderId);
    check('classic order uses the Tazella payment method', $classicOrder->get_payment_method() === 'tazella_gift_cards');
    check('classic order does not persist the card code at creation', $classicOrder->get_meta('_tazella_card_code') === '');

    $result = $gateway->process_payment($classicOrderId);
    $classicOrder = wc_get_order($classicOrderId);
    check('classic checkout payment succeeds', ($result['result'] ?? '') === 'success', wp_json_encode($result));
    check('classic order is paid', $classicOrder->is_paid() === true, 'status=' . $classicOrder->get_status());
    check('classic order total equals the applied amount', (int) $classicOrder->get_meta('_tazella_applied_minor') === 15000);
    check('classic order keeps no card code after capture', $classicOrder->get_meta('_tazella_card_code') === '');
    check('classic checkout redirects to the order received page', strpos((string) ($result['redirect'] ?? ''), 'order-received') !== false, (string) ($result['redirect'] ?? ''));

    $state = mock_state();
    check('classic checkout captured through the gateway', count($state['redemptions'] ?? []) === 1, (string) count($state['redemptions'] ?? []));

    // Leave the cart clean for the Blocks/Store API test.
    WC()->cart->empty_cart();
    $_POST = [];
}

WP_CLI::log('— blocks checkout registration —————————————————————');

$blocksRegistered = class_exists('Tazella_Blocks_Payment_Method');
check('blocks payment method class is loaded', $blocksRegistered);
if ($blocksRegistered) {
    $blocks = new Tazella_Blocks_Payment_Method();
    $blocks->initialize();
    check('blocks method is active with credentials', $blocks->is_active() === true);
    $data = $blocks->get_payment_method_data();
    check('blocks data exposes the store currency', ($data['currency'] ?? '') === 'QAR', wp_json_encode($data));
    check('blocks data exposes supported features', in_array('products', $data['supports'] ?? [], true), wp_json_encode($data['supports'] ?? []));
    $handles = $blocks->get_payment_method_script_handles();
    check('blocks registers its script handle', in_array('tazella-blocks-integration', $handles, true));
    check('blocks script is registered with its registry dependency', wp_script_is('tazella-blocks-integration', 'registered'));
}

WP_CLI::log('— card-code attempt throttling —————————————————————');

$GLOBALS['tazella_test_ip'] = '203.0.113.7';
add_filter('tazella_gift_cards_client_ip', static function () {
    return $GLOBALS['tazella_test_ip'] ?? '127.0.0.1';
});
delete_transient('tazella_gc_attempts_' . md5('203.0.113.7'));
delete_transient('tazella_gc_attempts_' . md5('198.51.100.9'));

mock_reset();
$throttled = gateway(['max_attempts' => '3', 'attempt_window_minutes' => '15']);
clear_notices();
for ($attempt = 1; $attempt <= 3; $attempt++) {
    $order = make_order();
    pay($order, $throttled, 'SBX-GUESS' . $attempt);
}

$state = mock_state();
$validateCalls = static function (array $state): int {
    return count(array_filter(
        $state['requests'] ?? [],
        static fn ($request) => ($request['path'] ?? '') === '/api/integrations/v1/gift-cards/validate'
    ));
};
$validateBefore = $validateCalls($state);
check('three guessing attempts reach the gateway', $validateBefore === 3, (string) $validateBefore);

clear_notices();
$order = make_order();
[$result, $order] = pay($order, $throttled, 'SBX-GOOD');
check('an attempt over the limit fails', ($result['result'] ?? '') === 'failure');
check(
    'the customer sees the RATE_LIMITED message',
    in_array('Too many attempts. Please wait a moment.', notices(), true),
    implode(' | ', notices())
);
$state = mock_state();
check('a throttled attempt never reaches the gateway', $validateCalls($state) === $validateBefore, (string) $validateCalls($state));
check('a throttled attempt takes no hold', count($state['reservations'] ?? []) === 0);
check('a throttled attempt does not charge a good card', $order->is_paid() === false);

// The counter is per client, so one visitor must not lock out another.
$GLOBALS['tazella_test_ip'] = '198.51.100.9';
clear_notices();
$order = make_order();
[$result, $order] = pay($order, $throttled, 'SBX-GOOD');
check('a different client is unaffected by another client\'s failures', ($result['result'] ?? '') === 'success', wp_json_encode($result));
check('a successful payment clears that client\'s counter', get_transient('tazella_gc_attempts_' . md5('198.51.100.9')) === false);

$GLOBALS['tazella_test_ip'] = '127.0.0.1';
delete_transient('tazella_gc_attempts_' . md5('203.0.113.7'));
$gateway = gateway();

WP_CLI::log('— abandoned hold sweep ——————————————————————————————');

check('the hold sweep is scheduled', wp_next_scheduled('tazella_gift_cards_sweep_holds') !== false);

mock_reset();
clear_notices();
$order = make_order();
mock_call('/__test/fail-next-capture');
pay($order, $gateway, 'SBX-GOOD');
$order = wc_get_order($order->get_id());
$reference = (string) $order->get_meta('_tazella_reservation_reference');
check('an abandoned checkout leaves an active hold', $order->get_meta('_tazella_status') === 'active' && $reference !== '', wp_json_encode($order->get_meta('_tazella_status')));
check('the hold expiry is recorded', (int) $order->get_meta('_tazella_hold_expires_at') > 0);

$order->update_meta_data('_tazella_hold_expires_at', time() - 5);
$order->save_meta_data();
$swept = Tazella_WooCommerce_Gateway::sweep_expired_holds();
$order = wc_get_order($order->get_id());
$state = mock_state();
check('the sweep releases the expired hold at the gateway', ($state['reservations'][$reference]['status'] ?? '') === 'released', wp_json_encode($state['reservations'] ?? []));
check('the order records the release', $order->get_meta('_tazella_status') === 'released');
check('the sweep reports one release', $swept === 1, (string) $swept);
check('no active hold is left behind', count(array_filter($state['reservations'] ?? [], static fn ($r) => ($r['status'] ?? '') === 'active')) === 0);

$notes = wc_get_order_notes(['order_id' => $order->get_id()]);
$noteText = implode(' | ', array_map(static fn ($note) => $note->content, $notes));
check('the order explains the automatic release', strpos($noteText, 'hold expired and was released automatically') !== false, $noteText);

// A hold that has not expired, and a captured order, must survive a sweep.
mock_reset();
clear_notices();
$live = make_order();
$live->update_meta_data('_tazella_status', 'active');
$live->update_meta_data('_tazella_reservation_reference', 'rsv_not_expired');
$live->update_meta_data('_tazella_hold_expires_at', time() + 300);
$live->set_payment_method('tazella_gift_cards');
$live->save_meta_data();

$capturedOrder = make_order();
[$result, $capturedOrder] = pay($capturedOrder, $gateway, 'SBX-GOOD');
$capturedOrder->update_meta_data('_tazella_hold_expires_at', time() - 5);
$capturedOrder->save_meta_data();
$secondSweep = Tazella_WooCommerce_Gateway::sweep_expired_holds();
$live = wc_get_order($live->get_id());
$capturedOrder = wc_get_order($capturedOrder->get_id());
check('an unexpired hold is left alone', $live->get_meta('_tazella_status') === 'active');
check('a captured order is never swept', $capturedOrder->get_meta('_tazella_status') === 'captured' && $capturedOrder->is_paid() === true);
check('the second sweep releases nothing', $secondSweep === 0, (string) $secondSweep);

WP_CLI::log('— split tender (opt-in partial payment) —————————————');

mock_reset();
$split = gateway(['partial_payments' => 'yes']);
clear_notices();
$order = make_order('150.00');
$orderTotalMinor = (int) round(((float) $order->get_total()) * 100);
[$result, $order] = pay($order, $split, 'SBX-LOW');
check('split tender captures a card that cannot cover the order', ($result['result'] ?? '') === 'success', wp_json_encode($result));
check('a split-tender order is not marked paid', $order->is_paid() === false, 'status=' . $order->get_status());
check('a split-tender order waits on hold', $order->get_status() === 'on-hold', 'status=' . $order->get_status());
check('the applied amount is the available balance', (int) $order->get_meta('_tazella_applied_minor') === 1000, (string) $order->get_meta('_tazella_applied_minor'));
check('the remaining amount is recorded', (int) $order->get_meta('_tazella_remaining_minor') === $orderTotalMinor - 1000, (string) $order->get_meta('_tazella_remaining_minor'));
check('split tender keeps no card code', $order->get_meta('_tazella_card_code') === '');
check(
    'the customer is told the remainder is due',
    strpos(implode(' | ', notices('notice')), 'still due') !== false,
    implode(' | ', notices('notice'))
);

$state = mock_state();
check('split tender takes exactly one hold', count($state['reservations'] ?? []) === 1);
check('split tender captures exactly one redemption', count($state['redemptions'] ?? []) === 1);
$redemption = array_values($state['redemptions'] ?? [])[0] ?? [];
check('the redemption is for the covered amount only', (int) ($redemption['amount_minor'] ?? 0) === 1000, (string) ($redemption['amount_minor'] ?? ''));
check('split tender is not reported as a paid order', empty(array_filter(
    $state['events'] ?? [],
    static fn ($event) => ($event['event_type'] ?? '') === 'order.paid'
)));

$partialRefund = wc_create_refund([
    'order_id' => $order->get_id(),
    'amount' => 10,
    'reason' => 'split tender partial refund',
    'refund_payment' => true,
]);
check('a refund within the covered amount succeeds', !is_wp_error($partialRefund), is_wp_error($partialRefund) ? $partialRefund->get_error_message() : '');

$overRefund = wc_create_refund([
    'order_id' => $order->get_id(),
    'amount' => 145,
    'reason' => 'more than the card paid',
    'refund_payment' => true,
]);
check('a refund above the covered amount is refused', is_wp_error($overRefund) || $overRefund === false);

// Split tender is opt-in: the default must still refuse a short card.
$gateway = gateway(['partial_payments' => 'no']);
clear_notices();
$order = make_order('150.00');
[$result, $order] = pay($order, $gateway, 'SBX-LOW');
check('split tender is off by default', ($result['result'] ?? '') === 'failure' && $order->is_paid() === false);
$gateway = gateway();

WP_CLI::log('— cancellation after capture ————————————————————————');

// WooCommerce cancels unpaid orders on its own schedule. A split-tender order
// that stayed pending after the card capture (a fatal in the checkout request,
// a slow status write) must never be cancelled: the customer would be charged
// on a cancelled order. Exercise the real cron, not just the filter.
$heldStockMinutes = get_option('woocommerce_hold_stock_minutes');
$manageStock = get_option('woocommerce_manage_stock');
update_option('woocommerce_hold_stock_minutes', '60');
update_option('woocommerce_manage_stock', 'yes');

// Put an order back where the cron looks for it: pending, last updated long
// before the hold window, and created through the checkout (WooCommerce only
// cancels checkout-created orders by default).
$forcePastCron = static function ($order) {
    $order->set_created_via('store-api');
    $order->set_status('pending');
    $order->save();
    $order->set_date_modified(gmdate('Y-m-d H:i:s', time() - 3 * HOUR_IN_SECONDS));
    $order->save();

    // HPOS stores date_modified as given, but legacy post storage rewrites
    // post_modified on every save. Set the columns the unpaid-order query
    // reads so the cron sees a genuinely backdated order on both stores.
    $usesHpos = wc_get_container()->get(
        Automattic\WooCommerce\Internal\DataStores\Orders\CustomOrdersTableController::class
    )->custom_orders_table_usage_is_enabled();
    if (!$usesHpos) {
        global $wpdb;
        $past = gmdate('Y-m-d H:i:s', time() - 3 * HOUR_IN_SECONDS);
        $wpdb->update(
            $wpdb->posts,
            ['post_modified' => $past, 'post_modified_gmt' => $past],
            ['ID' => $order->get_id()]
        );
        clean_post_cache($order->get_id());
    }

    return wc_get_order($order->get_id());
};

$dataStore = WC_Data_Store::load('order');
$cronEligible = static function ($orderId) use ($dataStore) {
    $ids = array_map('intval', (array) $dataStore->get_unpaid_orders(strtotime('-60 MINUTES')));
    return in_array((int) $orderId, $ids, true);
};

mock_reset();
$split = gateway(['partial_payments' => 'yes']);
clear_notices();
$order = make_order('150.00');
[$result, $order] = pay($order, $split, 'SBX-LOW');
check('split tender captured before the cancellation test', ($result['result'] ?? '') === 'success' && (int) $order->get_meta('_tazella_applied_minor') === 1000);

$order = $forcePastCron($order);
$splitId = $order->get_id();
$splitRedemptionId = (string) $order->get_meta('_tazella_redemption_id');
check('the cron considers the pending captured order unpaid', $cronEligible($splitId), 'order ' . $splitId);

wc_cancel_unpaid_orders();
$order = wc_get_order($splitId);
check(
    'the unpaid-order cron does not cancel a split-tender order after capture',
    $order->get_status() !== 'cancelled',
    'status=' . $order->get_status()
);
check('the blocked cancellation is recorded on the order', $order->get_meta('_tazella_cancel_blocked') === 'yes');
check(
    'the capture survives the cron',
    $order->get_meta('_tazella_status') === 'partially_captured'
    && (int) $order->get_meta('_tazella_applied_minor') === 1000
);
$notes = wc_get_order_notes(['order_id' => $splitId]);
$noteText = implode(' | ', array_map(static fn ($note) => $note->content, $notes));
check('the order explains why it was not cancelled', strpos($noteText, 'did not cancel this unpaid order automatically') !== false, $noteText);
$state = mock_state();
check('the cron does not reverse the capture', count($state['refunds'] ?? []) === 0, wp_json_encode($state['refunds'] ?? []));

// An administrator cancelling anyway must return the card's money, not keep it.
$order->update_status('cancelled', 'sandbox admin cancel');
$order = wc_get_order($splitId);
$state = mock_state();
$cancelRefunds = array_values(array_filter(
    $state['refunds'] ?? [],
    static fn ($refund) => ($refund['redemption_id'] ?? '') === $splitRedemptionId
));
check(
    'cancelling after capture returns the captured amount to the card',
    count($cancelRefunds) === 1 && (int) ($cancelRefunds[0]['amount_minor'] ?? 0) === 1000,
    wp_json_encode($state['refunds'] ?? [])
);
check(
    'the order records the reversal',
    $order->get_meta('_tazella_status') === 'reversed' && (int) $order->get_meta('_tazella_refunded_minor') === 1000,
    $order->get_meta('_tazella_status') . ' / ' . $order->get_meta('_tazella_refunded_minor')
);
check('a cancelled split-tender order leaves nothing due', (int) $order->get_meta('_tazella_remaining_minor') === 0);
$notes = wc_get_order_notes(['order_id' => $splitId]);
$noteText = implode(' | ', array_map(static fn ($note) => $note->content, $notes));
check('the cancellation note says the money went back', strpos($noteText, 'returned to the card') !== false, $noteText);

// The guard is not split-tender specific: any captured order left pending by a
// failed request is protected the same way.
mock_reset();
$gateway = gateway();
clear_notices();
$order = make_order();
[$result, $order] = pay($order, $gateway, 'SBX-GOOD');
$order = $forcePastCron($order);
$capturedId = $order->get_id();
check('the cron considers the fully captured order unpaid', $cronEligible($capturedId), 'order ' . $capturedId);
wc_cancel_unpaid_orders();
$order = wc_get_order($capturedId);
check(
    'a fully captured order is never cancelled as unpaid',
    $order->get_status() !== 'cancelled' && $order->get_meta('_tazella_status') === 'captured',
    'status=' . $order->get_status()
);
check('the fully captured order records the blocked cancellation', $order->get_meta('_tazella_cancel_blocked') === 'yes');

// An unpaid order whose hold was never captured must still be cleaned up.
mock_reset();
clear_notices();
$order = make_order();
mock_call('/__test/fail-next-capture');
pay($order, $gateway, 'SBX-GOOD');
$order = wc_get_order($order->get_id());
check('the fixture holds an uncaptured reservation', $order->get_meta('_tazella_status') === 'active');
$order = $forcePastCron($order);
$holdOnlyId = $order->get_id();
wc_cancel_unpaid_orders();
$order = wc_get_order($holdOnlyId);
check(
    'the cron still cancels an unpaid order with no capture',
    $order->get_status() === 'cancelled',
    'status=' . $order->get_status()
);
check('cancelling that order releases the uncaptured hold', $order->get_meta('_tazella_status') === 'released');

update_option('woocommerce_hold_stock_minutes', $heldStockMinutes);
update_option('woocommerce_manage_stock', $manageStock);

WP_CLI::log('— HPOS ———————————————————————————————————————————————');

$pluginBasename = plugin_basename(TAZELLA_WC_PLUGIN_FILE);
$declarations = [];
foreach (['custom_order_tables', 'cart_checkout_blocks'] as $feature) {
    $info = Automattic\WooCommerce\Utilities\FeaturesUtil::get_compatible_plugins_for_feature($feature);
    $declarations[$feature] = [
        'compatible' => in_array($pluginBasename, $info['compatible'] ?? [], true),
        'incompatible' => in_array($pluginBasename, $info['incompatible'] ?? [], true),
    ];
}
check(
    'declared compatible with custom_order_tables (HPOS)',
    $declarations['custom_order_tables']['compatible'] && !$declarations['custom_order_tables']['incompatible'],
    $pluginBasename
);
check(
    'declared compatible with cart_checkout_blocks',
    $declarations['cart_checkout_blocks']['compatible'] && !$declarations['cart_checkout_blocks']['incompatible'],
    $pluginBasename
);

$hpos = get_option('woocommerce_custom_orders_table_enabled') === 'yes';
WP_CLI::log('HPOS enabled: ' . ($hpos ? 'yes' : 'no'));
if ($hpos) {
    check(
        'HPOS: orders are stored in the HPOS tables',
        wc_get_container()->get(Automattic\WooCommerce\Internal\DataStores\Orders\CustomOrdersTableController::class)->custom_orders_table_usage_is_enabled()
    );
    mock_reset();
    clear_notices();
    $order = make_order();
    [$result, $order] = pay($order, $gateway, 'SBX-GOOD');
    check('HPOS: capture succeeds', ($result['result'] ?? '') === 'success' && $order->get_meta('_tazella_status') === 'captured');
    $refund = wc_create_refund([
        'order_id' => $order->get_id(),
        'amount' => 25,
        'reason' => 'hpos refund',
        'refund_payment' => true,
    ]);
    check('HPOS: refund succeeds', !is_wp_error($refund), is_wp_error($refund) ? $refund->get_error_message() : '');
    $state = mock_state();
    check('HPOS: capture and refund reached the gateway', count($state['redemptions'] ?? []) === 1 && count($state['refunds'] ?? []) === 1);
}

WP_CLI::log('— PHP notices ———————————————————————————————————————');

$debugLog = WP_CONTENT_DIR . '/debug.log';
$pluginNotices = '';
if (file_exists($debugLog)) {
    $lines = file($debugLog, FILE_IGNORE_NEW_LINES);
    foreach ($lines as $line) {
        if (stripos($line, 'tazella') !== false && preg_match('/PHP (Fatal error|Warning|Notice|Deprecated)/i', $line)) {
            $pluginNotices .= $line . "\n";
        }
    }
}
check('no PHP notice, warning or fatal from the plugin', $pluginNotices === '', trim($pluginNotices));

WP_CLI::log('');
$summary = $GLOBALS['tazella_results'];
WP_CLI::log(sprintf('Result: %d passed, %d failed', $summary['pass'], $summary['fail']));
if ($summary['fail'] > 0) {
    WP_CLI::log('Failures:');
    foreach ($summary['failures'] as $failure) {
        WP_CLI::log('  - ' . $failure);
    }
    WP_CLI::halt(1);
}
WP_CLI::success('All checklist assertions passed.');
