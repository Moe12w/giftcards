<?php
/**
 * Plugin Name: Tazella Gift Cards
 * Description: Accept Tazella gift cards as a WooCommerce payment method through the Tazella integration gateway.
 * Version: 0.2.0
 * Author: Tazella
 * Author URI: https://tazella.com.qa
 * Plugin URI: https://tazella.com.qa/en/plug-in-integrations
 * Text Domain: tazella-gift-cards
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 * WC tested up to: 10.0
 * Requires Plugins: woocommerce
 *
 * No API key, signing secret or card code is ever exposed in browser assets.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TAZELLA_WC_PLUGIN_FILE', __FILE__);
define('TAZELLA_WC_PLUGIN_VERSION', '0.2.0');

require_once __DIR__ . '/src/Tazella/Exception.php';
require_once __DIR__ . '/src/Tazella/Client.php';

/**
 * WordPress loads plugins in folder order, so `tazella-gift-cards` is included
 * before `woocommerce`. Checking class_exists('WC_Payment_Gateway') at include
 * time is therefore always false and the gateway would silently never load.
 * WooCommerce's own `woocommerce_loaded` action is the correct hook.
 */
function tazella_gift_cards_register_gateway()
{
    require_once __DIR__ . '/src/Gateway.php';
    add_filter('woocommerce_payment_gateways', 'tazella_gift_cards_add_gateway');
}
add_action('woocommerce_loaded', 'tazella_gift_cards_register_gateway');

/**
 * WooCommerce Blocks registers its payment methods on `woocommerce_blocks_loaded`.
 * The integration class only exists once that package has loaded.
 */
function tazella_gift_cards_register_blocks()
{
    if (!class_exists('Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType')) {
        return;
    }

    require_once __DIR__ . '/src/Blocks.php';

    add_action(
        'woocommerce_blocks_payment_method_type_registration',
        function ($registry) {
            $registry->register(new Tazella_Blocks_Payment_Method());
        }
    );
}
add_action('woocommerce_blocks_loaded', 'tazella_gift_cards_register_blocks');

/**
 * Declare compatibility with HPOS and the Blocks checkout. Without this,
 * WooCommerce shows the plugin as "incompatible" when High-Performance Order
 * Storage is enabled and may refuse to load it.
 */
function tazella_gift_cards_declare_compatibility()
{
    if (!class_exists('Automattic\WooCommerce\Utilities\FeaturesUtil')) {
        return;
    }

    Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
        'custom_order_tables',
        __FILE__,
        true
    );
    Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
        'cart_checkout_blocks',
        __FILE__,
        true
    );
}
add_action('before_woocommerce_init', 'tazella_gift_cards_declare_compatibility');

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
    if (!in_array('Tazella_WooCommerce_Gateway', $methods, true)) {
        $methods[] = 'Tazella_WooCommerce_Gateway';
    }
    return $methods;
}

function tazella_gift_cards_missing_woocommerce_notice()
{
    if (class_exists('WooCommerce')) {
        return;
    }

    echo '<div class="notice notice-warning"><p>'
        . esc_html__('Tazella Gift Cards requires WooCommerce to be active.', 'tazella-gift-cards')
        . '</p></div>';
}
add_action('admin_notices', 'tazella_gift_cards_missing_woocommerce_notice');

function tazella_gift_cards_settings_link($links)
{
    $url = admin_url('admin.php?page=wc-settings&tab=checkout&section=tazella_gift_cards');
    $links[] = '<a href="' . esc_url($url) . '">' . esc_html__('Settings', 'tazella-gift-cards') . '</a>';
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'tazella_gift_cards_settings_link');

/**
 * Sweep holds left behind by abandoned checkouts. Hourly is enough: holds live
 * for minutes, so a released one costs the customer at most an hour of blocked
 * balance on a checkout they never finished.
 */
function tazella_gift_cards_schedule_hold_sweep()
{
    if (!wp_next_scheduled('tazella_gift_cards_sweep_holds')) {
        wp_schedule_event(time() + 300, 'hourly', 'tazella_gift_cards_sweep_holds');
    }
}
add_action('init', 'tazella_gift_cards_schedule_hold_sweep');

function tazella_gift_cards_run_hold_sweep()
{
    if (
        class_exists('Tazella_WooCommerce_Gateway')
        && method_exists('Tazella_WooCommerce_Gateway', 'sweep_expired_holds')
    ) {
        Tazella_WooCommerce_Gateway::sweep_expired_holds();
    }
}
add_action('tazella_gift_cards_sweep_holds', 'tazella_gift_cards_run_hold_sweep');

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('tazella_gift_cards_sweep_holds');
});

register_activation_hook(__FILE__, function () {
    // Nothing is written on activation. Credentials are configured in the
    // WooCommerce payment settings by an administrator and stored by WordPress.
    if (version_compare(PHP_VERSION, '7.4', '<')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(
            esc_html__('Tazella Gift Cards requires PHP 7.4 or newer.', 'tazella-gift-cards'),
            esc_html__('Plugin activation failed', 'tazella-gift-cards'),
            ['back_link' => true]
        );
    }
});
