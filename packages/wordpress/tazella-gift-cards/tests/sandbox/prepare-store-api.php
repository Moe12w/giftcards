<?php
/**
 * Prepares the sandbox store for tests/sandbox/store-api-checkout.mjs.
 *
 *   wp eval-file tests/sandbox/prepare-store-api.php
 *
 * Writes the gateway settings the mock gateway expects, enables split tender,
 * makes sure a published 150.00 QAR product exists, and prints the id the
 * Blocks test should add to its cart:
 *
 *   PRODUCT_ID=123
 *
 * The file is idempotent: the product is looked up by SKU, and the settings are
 * merged over whatever the store already has.
 */

if (!class_exists('WooCommerce')) {
    WP_CLI::error('WooCommerce must be active.');
}

$settings = get_option('woocommerce_tazella_gift_cards_settings', []);
$settings = array_merge(is_array($settings) ? $settings : [], [
    'enabled' => 'yes',
    'environment' => 'sandbox',
    'base_url' => 'http://127.0.0.1:9099',
    'platform_code' => 'wordpress',
    'api_key' => 'tz_sandbox_wp_mock_key',
    'signing_secret' => 'wp_mock_secret',
    'currency' => 'QAR',
    'external_vendor_id' => '',
    'external_branch_id' => '',
    'partial_payments' => 'yes',
    'debug' => 'yes',
]);
update_option('woocommerce_tazella_gift_cards_settings', $settings);
update_option('woocommerce_currency', 'QAR');

$productId = (int) wc_get_product_id_by_sku('TAZELLA-SANDBOX-150');
if ($productId <= 0) {
    $product = new WC_Product_Simple();
    $product->set_name('Sandbox gift-card product');
    $product->set_sku('TAZELLA-SANDBOX-150');
    $product->set_regular_price('150.00');
    $product->set_price('150.00');
    $product->set_status('publish');
    $product->set_catalog_visibility('hidden');
    $product->save();
    $productId = (int) $product->get_id();
} else {
    $product = wc_get_product($productId);
    $product->set_regular_price('150.00');
    $product->set_price('150.00');
    $product->set_status('publish');
    $product->save();
}

WP_CLI::log('PRODUCT_ID=' . $productId);
