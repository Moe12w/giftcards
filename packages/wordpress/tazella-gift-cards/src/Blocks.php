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
     * Same visibility as AbstractPaymentMethodType::$settings. Declaring it
     * private fatals on activation ("Access level ... must be protected").
     *
     * @var array
     */
    protected $settings = [];

    public function initialize()
    {
        $settings = get_option('woocommerce_tazella_gift_cards_settings', []);
        $this->settings = is_array($settings) ? $settings : [];
    }

    public function is_active()
    {
        if (empty($this->settings['enabled']) || 'yes' !== $this->settings['enabled']) {
            return false;
        }

        // Same rule as the gateway: without credentials the method would only
        // fail at submit, so keep it out of the block checkout entirely.
        $key = $this->credential('api_key', 'TAZELLA_WC_API_KEY');
        $secret = $this->credential('signing_secret', 'TAZELLA_WC_SIGNING_SECRET');
        if ($key === '' || $secret === '') {
            return false;
        }

        // Match the gateway: a currency mismatch would only fail at submit.
        $configured = strtoupper($this->credential('currency', 'TAZELLA_WC_CURRENCY'));
        $store = function_exists('get_woocommerce_currency')
            ? strtoupper((string) get_woocommerce_currency())
            : $configured;

        return $configured !== '' && $store === $configured;
    }

    private function credential($key, $constant)
    {
        if (defined($constant)) {
            return (string) constant($constant);
        }

        $fromEnv = getenv($constant);
        if ($fromEnv !== false && $fromEnv !== '') {
            return (string) $fromEnv;
        }

        return isset($this->settings[$key]) ? (string) $this->settings[$key] : '';
    }

    public function get_payment_method_script_handles()
    {
        $file = dirname(__DIR__) . '/assets/js/blocks.js';
        wp_register_script(
            'tazella-blocks-integration',
            plugins_url('assets/js/blocks.js', TAZELLA_WC_PLUGIN_FILE),
            ['wc-blocks-registry', 'wp-element', 'wp-i18n'],
            file_exists($file) ? (string) filemtime($file) : TAZELLA_WC_PLUGIN_VERSION,
            true
        );

        return ['tazella-blocks-integration'];
    }

    public function get_payment_method_data()
    {
        return [
            'title' => isset($this->settings['title']) ? (string) $this->settings['title'] : 'Tazella gift card',
            'description' => isset($this->settings['description']) ? (string) $this->settings['description'] : '',
            'currency' => function_exists('get_woocommerce_currency') ? (string) get_woocommerce_currency() : '',
            'supports' => $this->get_supported_features(),
        ];
    }
}
