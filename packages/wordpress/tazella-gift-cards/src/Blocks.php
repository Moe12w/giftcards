<?php
/**
 * WooCommerce Blocks (Store API) registration for the Tazella payment method.
 *
 * Loaded only when WooCommerce Blocks is active. The browser bundle contains no
 * credential: it only collects the card code and passes it through Store API
 * payment_data, which the gateway reads from order meta.
 */

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

final class Tazella_Blocks_Payment_Method extends AbstractPaymentMethodType
{
    protected $name = 'tazella_gift_cards';

    /**
     * @var array
     */
    private $settings = [];

    public function initialize()
    {
        $this->settings = get_option('woocommerce_tazella_gift_cards_settings', []);
    }

    public function is_active()
    {
        return !empty($this->settings['enabled']) && 'yes' === $this->settings['enabled'];
    }

    public function get_payment_method_script_handles()
    {
        $file = dirname(__DIR__) . '/assets/js/blocks.js';
        wp_register_script(
            'tazella-blocks-integration',
            plugins_url('assets/js/blocks.js', TAZELLA_WC_PLUGIN_FILE),
            [],
            file_exists($file) ? (string) filemtime($file) : '0.1.0',
            true
        );

        return ['tazella-blocks-integration'];
    }

    public function get_payment_method_data()
    {
        return [
            'title' => isset($this->settings['title']) ? (string) $this->settings['title'] : 'Tazella gift card',
            'description' => isset($this->settings['description']) ? (string) $this->settings['description'] : '',
            'supports' => $this->get_supported_features(),
        ];
    }
}
