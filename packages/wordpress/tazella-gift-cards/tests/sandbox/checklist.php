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
        'debug' => 'yes',
    ], $overrides);
    update_option('woocommerce_tazella_gift_cards_settings', $settings);
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

$gateway = gateway();
check('available with credentials and matching currency', $gateway->is_available() === true);

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
