<?php
/**
 * WooCommerce payment gateway for Tazella gift cards.
 *
 * The browser never sees the Tazella API key or signing secret. WooCommerce's
 * own checkout submission is the verified payment event for this self-hosted
 * gateway: we reserve, then capture in process_payment using the confirmed
 * WooCommerce order amount. Cancellations release uncaptured holds; refunds
 * call the audited reversal endpoint.
 */

use Tazella\GiftCards\Client;
use Tazella\GiftCards\TazellaException;

class Tazella_WooCommerce_Gateway extends WC_Payment_Gateway
{
    public function __construct()
    {
        $this->id = 'tazella_gift_cards';
        $this->icon = '';
        $this->has_fields = true;
        $this->method_title = __('Tazella gift cards', 'tazella-gift-cards');
        $this->method_description = __(
            'Accept Tazella gift cards as a payment method. Requires a verified platform credential and mapping.',
            'tazella-gift-cards'
        );

        $this->init_form_fields();
        $this->init_settings();

        $this->title = $this->get_option('title', __('Tazella gift card', 'tazella-gift-cards'));
        $this->description = $this->get_option('description', '');
        $this->enabled = $this->get_option('enabled', 'no');

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
        add_action('woocommerce_store_api_checkout_update_order_from_request', [$this, 'capture_block_card_code'], 10, 2);
        add_action('woocommerce_order_status_cancelled', [$this, 'maybe_release_on_cancel'], 10, 1);
        add_action('woocommerce_order_status_refunded', [$this, 'maybe_report_refunded'], 10, 1);
        add_action('woocommerce_thankyou_' . $this->id, [$this, 'thankyou_page'], 10, 1);
        add_filter('woocommerce_order_details_after_order_table', [$this, 'show_card_on_order'], 10, 1);
    }

    public function init_form_fields()
    {
        $this->form_fields = [
            'enabled' => [
                'title' => __('Enable/Disable', 'tazella-gift-cards'),
                'type' => 'checkbox',
                'label' => __('Enable Tazella gift cards', 'tazella-gift-cards'),
                'default' => 'no',
            ],
            'title' => [
                'title' => __('Title', 'tazella-gift-cards'),
                'type' => 'text',
                'default' => __('Tazella gift card', 'tazella-gift-cards'),
            ],
            'description' => [
                'title' => __('Description', 'tazella-gift-cards'),
                'type' => 'textarea',
                'default' => __('Pay with a Tazella gift card.', 'tazella-gift-cards'),
            ],
            'environment' => [
                'title' => __('Environment', 'tazella-gift-cards'),
                'type' => 'select',
                'options' => [
                    'sandbox' => __('Sandbox', 'tazella-gift-cards'),
                    'production' => __('Production', 'tazella-gift-cards'),
                ],
                'default' => 'sandbox',
                'description' => __('Sandbox credentials cannot reach production data.', 'tazella-gift-cards'),
            ],
            'base_url' => [
                'title' => __('Site URL', 'tazella-gift-cards'),
                'type' => 'url',
                'default' => 'https://tazella.com.qa',
                'description' => __('The Tazella deployment that issued the credential.', 'tazella-gift-cards'),
            ],
            'platform_code' => [
                'title' => __('Platform code', 'tazella-gift-cards'),
                'type' => 'text',
                'default' => 'wordpress',
            ],
            'api_key' => [
                'title' => __('API key', 'tazella-gift-cards'),
                'type' => 'password',
                'description' => __('Server-side only. Never shown to customers.', 'tazella-gift-cards'),
            ],
            'signing_secret' => [
                'title' => __('Signing secret', 'tazella-gift-cards'),
                'type' => 'password',
                'description' => __('Server-side only. Used for HMAC request signatures.', 'tazella-gift-cards'),
            ],
            'external_vendor_id' => [
                'title' => __('External vendor ID', 'tazella-gift-cards'),
                'type' => 'text',
                'description' => __('The verified ID Tazella mapped to this store.', 'tazella-gift-cards'),
            ],
            'external_branch_id' => [
                'title' => __('External branch ID', 'tazella-gift-cards'),
                'type' => 'text',
                'default' => '',
            ],
            'currency' => [
                'title' => __('Currency', 'tazella-gift-cards'),
                'type' => 'text',
                'default' => 'QAR',
                'description' => __('Orders in any other currency are rejected. No conversion is performed.', 'tazella-gift-cards'),
            ],
            'ttl_seconds' => [
                'title' => __('Hold lifetime (seconds)', 'tazella-gift-cards'),
                'type' => 'number',
                'default' => '600',
            ],
            'debug' => [
                'title' => __('Debug log', 'tazella-gift-cards'),
                'type' => 'checkbox',
                'label' => __('Log error codes and request IDs (never secrets or card codes).', 'tazella-gift-cards'),
                'default' => 'no',
            ],
        ];
    }

    public function admin_options()
    {
        parent::admin_options();

        if (!$this->has_credentials()) {
            echo '<div class="notice notice-warning inline"><p>'
                . esc_html__('Add an API key and signing secret, or define TAZELLA_WC_API_KEY and TAZELLA_WC_SIGNING_SECRET in wp-config.php.', 'tazella-gift-cards')
                . '</p></div>';
            return;
        }

        try {
            $health = $this->client()->health();
            $code = isset($health['platform']['code']) ? (string) $health['platform']['code'] : '';
            echo '<div class="notice notice-success inline"><p>'
                . esc_html(sprintf(
                    /* translators: %s: platform code */
                    __('Connection verified: %s (%s).', 'tazella-gift-cards'),
                    $code,
                    $this->setting('environment', 'TAZELLA_WC_ENVIRONMENT') ?: 'sandbox'
                ))
                . '</p></div>';
        } catch (TazellaException $error) {
            echo '<div class="notice notice-error inline"><p>'
                . esc_html(sprintf(
                    /* translators: %s: error code */
                    __('Connection check failed: %s. Check the key, secret, platform code and environment.', 'tazella-gift-cards'),
                    $error->errorCode()
                ))
                . '</p></div>';
        }
    }

    public function is_available()
    {
        if (!parent::is_available()) {
            return false;
        }

        return $this->has_credentials()
            && $this->setting('external_vendor_id', 'TAZELLA_WC_VENDOR_ID') !== ''
            && $this->setting('currency', 'TAZELLA_WC_CURRENCY') !== '';
    }

    private function has_credentials()
    {
        return $this->setting('api_key', 'TAZELLA_WC_API_KEY') !== ''
            && $this->setting('signing_secret', 'TAZELLA_WC_SIGNING_SECRET') !== '';
    }

    /**
     * Credentials can be supplied as PHP constants in wp-config.php or as
     * environment variables. When present they take precedence over the
     * settings page, so the plaintext never has to live in wp_options.
     */
    private function setting($key, $constant = null)
    {
        if ($constant && defined($constant)) {
            return (string) constant($constant);
        }
        if ($constant) {
            $fromEnv = getenv($constant);
            if ($fromEnv !== false && $fromEnv !== '') {
                return (string) $fromEnv;
            }
        }
        return (string) $this->get_option($key, '');
    }

    private function client()
    {
        return new Client(
            $this->setting('base_url', 'TAZELLA_WC_BASE_URL') ?: 'https://tazella.com.qa',
            $this->setting('platform_code', 'TAZELLA_WC_PLATFORM_CODE') ?: 'wordpress',
            $this->setting('environment', 'TAZELLA_WC_ENVIRONMENT') === 'production' ? 'production' : 'sandbox',
            $this->setting('api_key', 'TAZELLA_WC_API_KEY'),
            $this->setting('signing_secret', 'TAZELLA_WC_SIGNING_SECRET')
        );
    }

    private function minor($amount)
    {
        return (int) round(((float) wc_format_decimal($amount)) * 100);
    }

    private function vendorRequest()
    {
        return [
            'external_vendor_id' => $this->setting('external_vendor_id', 'TAZELLA_WC_VENDOR_ID'),
            'external_branch_id' => $this->setting('external_branch_id', 'TAZELLA_WC_BRANCH_ID'),
        ];
    }

    private function log($message)
    {
        if ($this->get_option('debug', 'no') === 'yes') {
            error_log('[tazella-gift-cards] ' . $message);
        }
    }

    public function payment_fields()
    {
        echo '<div class="tazella-gift-card-fields">';
        echo '<label for="tazella_card_code">' . esc_html__('Gift card code', 'tazella-gift-cards') . '</label> ';
        echo '<input type="text" id="tazella_card_code" name="tazella_card_code" autocomplete="off" dir="auto" placeholder="GFT-XXXXXXXXXX" />';
        echo '<p class="description">' . esc_html__('The amount is confirmed by Tazella before payment.', 'tazella-gift-cards') . '</p>';
        echo '</div>';
    }

    public function validate_fields()
    {
        $code = isset($_POST['tazella_card_code'])
            ? sanitize_text_field(wp_unslash($_POST['tazella_card_code']))
            : '';
        if ($code === '') {
            wc_add_notice(__('Enter a gift card code.', 'tazella-gift-cards'), 'error');
            return false;
        }
        return true;
    }

    /** Store API (Blocks checkout) passes the card code in payment_data. */
    public function capture_block_card_code($order, $request)
    {
        if (!is_object($order) || !method_exists($order, 'get_payment_method')) {
            return;
        }
        if ($order->get_payment_method() !== $this->id || !method_exists($request, 'get_param')) {
            return;
        }

        $paymentData = $request->get_param('payment_data');
        if (!is_array($paymentData)) {
            return;
        }

        foreach ($paymentData as $item) {
            if (!is_array($item) || !isset($item['key'], $item['value'])) continue;
            if ($item['key'] !== 'tazella_card_code') continue;

            $order->update_meta_data('_tazella_card_code', sanitize_text_field(wp_unslash($item['value'])));
            $order->save_meta_data();
            return;
        }
    }

    public function process_payment($order_id)
    {
        $order = wc_get_order($order_id);
        if (!$order) {
            return ['result' => 'failure'];
        }

        $code = isset($_POST['tazella_card_code'])
            ? sanitize_text_field(wp_unslash($_POST['tazella_card_code']))
            : (string) $order->get_meta('_tazella_card_code');
        $code = sanitize_text_field($code);
        $currency = strtoupper($order->get_currency());
        $configured = strtoupper($this->setting('currency', 'TAZELLA_WC_CURRENCY'));
        $orderMinor = $this->minor($order->get_total());

        if ($code === '' || $currency !== $configured || $orderMinor <= 0) {
            wc_add_notice(__('This order cannot be paid with a gift card.', 'tazella-gift-cards'), 'error');
            return ['result' => 'failure'];
        }

        $client = $this->client();
        $vendor = $this->vendorRequest();

        try {
            $validation = $client->validate(array_merge($vendor, [
                'card_code' => $code,
                'currency' => $currency,
            ]));

            if (empty($validation['valid'])) {
                $reason = isset($validation['reason']) ? (string) $validation['reason'] : '';
                $message = TazellaException::publicMessage($reason);
                throw new TazellaException($reason ?: 'CARD_INACTIVE', $message, false);
            }

            $available = (int) ($validation['available_minor'] ?? 0);
            $requested = min($available, $orderMinor);

            $reservation = $client->reserve(array_merge($vendor, [
                'external_order_id' => (string) $order->get_id(),
                'card_code' => $code,
                'order_amount_minor' => $orderMinor,
                'requested_amount_minor' => $requested,
                'currency' => $currency,
                'ttl_seconds' => (int) $this->get_option('ttl_seconds', '600'),
                'idempotency_key' => Client::idempotencyKey('reserve_' . $order->get_id()),
            ]));

            $reference = isset($reservation['reservation_reference']) ? (string) $reservation['reservation_reference'] : '';
            $applied = (int) ($reservation['applied_amount_minor'] ?? 0);
            if ($reference === '' || $applied <= 0) {
                throw new TazellaException('INTERNAL_ERROR', TazellaException::publicMessage('INTERNAL_ERROR'), false);
            }

            $order->update_meta_data('_tazella_reservation_reference', $reference);
            $order->update_meta_data('_tazella_applied_minor', $applied);
            $order->update_meta_data('_tazella_status', 'active');
            $order->update_meta_data('_tazella_card_masked', isset($reservation['card']['masked_code']) ? (string) $reservation['card']['masked_code'] : '');
            $order->save_meta_data();

            // WooCommerce's checkout submission is the verified payment event
            // for this self-hosted gateway. Capture only the confirmed total.
            $capture = $client->capture($reference, array_merge($vendor, [
                'external_payment_reference' => 'woo_' . $order->get_id(),
                'confirmed_order_amount_minor' => $orderMinor,
                'currency' => $currency,
                'idempotency_key' => Client::idempotencyKey('capture_' . $order->get_id()),
            ]));

            if (($capture['status'] ?? '') !== 'captured') {
                throw new TazellaException(
                    'RECONCILIATION_REQUIRED',
                    TazellaException::publicMessage('RECONCILIATION_REQUIRED'),
                    false
                );
            }

            $redemptionId = isset($capture['redemption_reference']) ? (string) $capture['redemption_reference'] : '';
            $order->update_meta_data('_tazella_redemption_id', $redemptionId);
            $order->update_meta_data('_tazella_status', 'captured');
            $order->save_meta_data();
            $order->add_order_note(sprintf(
                __('Tazella gift card applied: %d minor units. Redemption: %s', 'tazella-gift-cards'),
                $applied,
                $redemptionId
            ));
            $order->payment_complete($redemptionId);

            $this->report_event($order, 'order.paid', $client, $orderMinor, $currency);

            return [
                'result' => 'success',
                'redirect' => $this->get_return_url($order),
            ];
        } catch (TazellaException $error) {
            $this->log($error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
            $order->update_status('failed', sprintf(
                __('Tazella gift card payment failed: %s', 'tazella-gift-cards'),
                $error->errorCode()
            ));
            wc_add_notice($error->getMessage(), 'error');
            return ['result' => 'failure'];
        }
    }

    public function process_refund($order_id, $amount = null, $reason = '')
    {
        $order = wc_get_order($order_id);
        if (!$order) {
            return false;
        }

        $redemptionId = (string) $order->get_meta('_tazella_redemption_id');
        if ($redemptionId === '' || !$this->has_credentials()) {
            return false;
        }

        $amountMinor = $amount === null
            ? $this->minor($order->get_total())
            : $this->minor($amount);
        if ($amountMinor <= 0) {
            return false;
        }

        try {
            $refund = $this->client()->refund($redemptionId, array_merge($this->vendorRequest(), [
                'amount_minor' => $amountMinor,
                'reason' => $reason !== '' ? sanitize_text_field($reason) : 'woocommerce_refund',
                'idempotency_key' => Client::idempotencyKey('refund_' . $order->get_id() . '_' . $amountMinor),
            ]));

            $order->update_meta_data('_tazella_refunded_minor', (int) ($refund['refunded_total_minor'] ?? $amountMinor));
            $order->save_meta_data();
            $order->add_order_note(sprintf(
                __('Tazella gift-card reversal completed: %d minor units.', 'tazella-gift-cards'),
                $amountMinor
            ));
            $this->report_event($order, 'order.refunded', $this->client(), $amountMinor, strtoupper($order->get_currency()));
            return true;
        } catch (TazellaException $error) {
            $this->log('refund ' . $error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
            return function_exists('is_wp_error') && class_exists('WP_Error')
                ? new WP_Error('tazella_refund_failed', $error->getMessage())
                : false;
        }
    }

    public function maybe_release_on_cancel($order_id)
    {
        $order = wc_get_order($order_id);
        if (!$order || !$this->has_credentials()) {
            return;
        }

        $reference = (string) $order->get_meta('_tazella_reservation_reference');
        $status = (string) $order->get_meta('_tazella_status');
        if ($reference === '' || $status !== 'active') {
            return;
        }

        try {
            $this->client()->release($reference, array_merge($this->vendorRequest(), [
                'reason' => 'woocommerce_order_cancelled',
                'idempotency_key' => Client::idempotencyKey('release_' . $order->get_id()),
            ]));
            $order->update_meta_data('_tazella_status', 'released');
            $order->save_meta_data();
        } catch (TazellaException $error) {
            // A captured reservation cannot be released; leave it recorded.
            $this->log('release ' . $error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
        }
    }

    public function maybe_report_refunded($order_id)
    {
        $order = wc_get_order($order_id);
        if (!$order || !$this->has_credentials() || (string) $order->get_meta('_tazella_redemption_id') === '') {
            return;
        }

        try {
            $this->report_event(
                $order,
                'order.refunded',
                $this->client(),
                $this->minor($order->get_total()),
                strtoupper($order->get_currency())
            );
        } catch (TazellaException $error) {
            $this->log('event ' . $error->errorCode());
        }
    }

    private function report_event($order, $type, Client $client, $amountMinor, $currency)
    {
        $client->orderEvent([
            'event_id' => 'woo_' . $order->get_id() . '_' . $type,
            'event_type' => $type,
            'external_order_id' => (string) $order->get_id(),
            'reservation_reference' => (string) $order->get_meta('_tazella_reservation_reference'),
            'amount_minor' => $amountMinor,
            'currency' => $currency,
            'occurred_at' => gmdate('c'),
            'idempotency_key' => Client::idempotencyKey('event_' . $order->get_id() . '_' . $type),
        ]);
    }

    public function thankyou_page($order_id)
    {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        $applied = (int) $order->get_meta('_tazella_applied_minor');
        if ($applied > 0) {
            echo '<p class="woocommerce-order-overview">' . esc_html(sprintf(
                __('Paid with Tazella gift card: %s', 'tazella-gift-cards'),
                wc_price($applied / 100)
            )) . '</p>';
        }
    }

    public function show_card_on_order($order)
    {
        if (!is_object($order) || !method_exists($order, 'get_meta')) {
            return;
        }
        $masked = (string) $order->get_meta('_tazella_card_masked');
        if ($masked !== '') {
            echo '<p class="tazella-gift-card-summary">' . esc_html(sprintf(
                __('Tazella gift card: %s', 'tazella-gift-cards'),
                $masked
            )) . '</p>';
        }
    }
}
