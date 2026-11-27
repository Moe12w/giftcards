<?php
/**
 * Plugin Name: Tazella Gift Cards
 * Description: Accept Tazella gift cards as a WooCommerce payment method through the Tazella integration gateway.
 * Version: 0.1.0
 * Author: Tazella
 * Text Domain: tazella-gift-cards
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 *
 * No API key, signing secret or card code is ever exposed in browser assets.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TAZELLA_WC_PLUGIN_FILE', __FILE__);

require_once __DIR__ . '/src/Tazella/Exception.php';
require_once __DIR__ . '/src/Tazella/Client.php';

if (class_exists('WC_Payment_Gateway')) {
    require_once __DIR__ . '/src/Gateway.php';
}

if (class_exists('Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType')) {
    require_once __DIR__ . '/src/Blocks.php';

    add_action(
        'woocommerce_blocks_payment_method_type_registration',
        function ($registry) {
            $registry->register(new Tazella_Blocks_Payment_Method());
        }
    );
}

function tazella_gift_cards_load_textdomain()
{
    load_plugin_textdomain(
        'tazella-gift-cards',
        false,
        dirname(plugin_basename(__FILE__)) . '/languages'
    );
}
add_action('plugins_loaded', 'tazella_gift_cards_load_textdomain');

function tazella_gift_cards_add_gateway($methods)
{
    $methods[] = 'Tazella_WooCommerce_Gateway';
    return $methods;
}
add_filter('woocommerce_payment_gateways', 'tazella_gift_cards_add_gateway');

function tazella_gift_cards_missing_woocommerce_notice()
{
    if (!class_exists('WooCommerce')) {
        echo '<div class="notice notice-warning"><p>'
            . esc_html__('Tazella Gift Cards requires WooCommerce to be active.', 'tazella-gift-cards')
            . '</p></div>';
    }
}
add_action('admin_notices', 'tazella_gift_cards_missing_woocommerce_notice');

function tazella_gift_cards_settings_link($links)
{
    $url = admin_url('admin.php?page=wc-settings&tab=checkout&section=tazella_gift_cards');
    $links[] = '<a href="' . esc_url($url) . '">' . esc_html__('Settings', 'tazella-gift-cards') . '</a>';
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'tazella_gift_cards_settings_link');

register_activation_hook(__FILE__, function () {
    // Nothing is written on activation. Credentials are configured in the
    // WooCommerce payment settings by an administrator and stored by WordPress.
});
