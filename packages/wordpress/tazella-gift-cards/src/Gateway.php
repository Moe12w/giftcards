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
    /** @var bool Guards against duplicate hook registration. */
    private static $hooks_registered = false;

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
        $this->supports = ['products', 'refunds'];

        $this->init_form_fields();
        $this->init_settings();

        $this->title = $this->get_option('title', __('Tazella gift card', 'tazella-gift-cards'));
        $this->description = $this->get_option('description', '');
        $this->enabled = $this->get_option('enabled', 'no');

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);

        if (self::$hooks_registered) {
            return;
        }
        self::$hooks_registered = true;

        add_action('woocommerce_store_api_checkout_update_order_from_request', [$this, 'capture_block_card_code'], 10, 2);
        add_filter('woocommerce_cancel_unpaid_order', [$this, 'keep_captured_orders_from_cancellation'], 10, 2);
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
                'description' => __(
                    'Must match the environment the key was issued for. Sandbox credentials cannot reach production data.',
                    'tazella-gift-cards'
                ),
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
                'description' => __('Leave as wordpress unless Tazella gave you a different code.', 'tazella-gift-cards'),
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
                'title' => __('External vendor ID (optional)', 'tazella-gift-cards'),
                'type' => 'text',
                'description' => __(
                    'Leave empty. The verified store is resolved from your key. Only fill this if Tazella support asks you to.',
                    'tazella-gift-cards'
                ),
            ],
            'external_branch_id' => [
                'title' => __('External branch ID (optional)', 'tazella-gift-cards'),
                'type' => 'text',
                'default' => '',
            ],
            'currency' => [
                'title' => __('Currency', 'tazella-gift-cards'),
                'type' => 'text',
                'default' => 'QAR',
                'description' => __(
                    'Orders in any other currency are rejected. No conversion is performed.',
                    'tazella-gift-cards'
                ),
            ],
            'ttl_seconds' => [
                'title' => __('Hold lifetime (seconds)', 'tazella-gift-cards'),
                'type' => 'number',
                'default' => '600',
            ],
            'partial_payments' => [
                'title' => __('Split tender', 'tazella-gift-cards'),
                'type' => 'checkbox',
                'label' => __('Accept the card\'s available balance and leave the remainder due on the order', 'tazella-gift-cards'),
                'default' => 'no',
                'description' => __(
                    'When off, the card must cover the whole order. When on, an order the card cannot cover is captured for the available balance, left on hold, and the remainder is collected by the store.',
                    'tazella-gift-cards'
                ),
            ],
            'max_attempts' => [
                'title' => __('Card attempts per client', 'tazella-gift-cards'),
                'type' => 'number',
                'default' => '10',
                'description' => __(
                    'Reject this many failed card lookups from one client before pausing further attempts. Set 0 to disable. Guessing card codes is otherwise unlimited.',
                    'tazella-gift-cards'
                ),
            ],
            'attempt_window_minutes' => [
                'title' => __('Attempt cooldown (minutes)', 'tazella-gift-cards'),
                'type' => 'number',
                'default' => '15',
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
            $environment = isset($health['environment']) ? (string) $health['environment'] : '';
            $status = isset($health['platform']['status']) ? (string) $health['platform']['status'] : '';

            echo '<div class="notice notice-success inline"><p>'
                . esc_html(sprintf(
                    /* translators: 1: platform code, 2: environment, 3: platform status */
                    __('Connection verified: %1$s (%2$s, platform %3$s).', 'tazella-gift-cards'),
                    $code !== '' ? $code : '—',
                    $environment !== '' ? $environment : '—',
                    $status !== '' ? $status : '—'
                ))
                . '</p></div>';
        } catch (TazellaException $error) {
            $this->log('health ' . $error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
            echo '<div class="notice notice-error inline"><p>'
                . esc_html(sprintf(
                    /* translators: 1: error code, 2: HTTP status */
                    __('Connection check failed: %1$s (HTTP %2$s). Check the key, signing secret, platform code and environment.', 'tazella-gift-cards'),
                    $error->errorCode(),
                    $error->httpStatus() !== null ? (string) $error->httpStatus() : '—'
                ))
                . '</p></div>';
        } catch (Throwable $error) {
            echo '<div class="notice notice-error inline"><p>'
                . esc_html__('Connection check failed unexpectedly. See the WooCommerce logs.', 'tazella-gift-cards')
                . '</p></div>';
        }
    }

    /**
     * Hide the method unless it can actually work: credentials, a usable
     * currency, and the store currency matching the configured one. Showing it
     * and failing at submit is a worse experience than hiding it.
     */
    public function is_available()
    {
        if (!parent::is_available()) {
            return false;
        }
        if (!$this->has_credentials()) {
            return false;
        }

        $configured = strtoupper(trim($this->setting('currency', 'TAZELLA_WC_CURRENCY')));
        $store = function_exists('get_woocommerce_currency')
            ? strtoupper((string) get_woocommerce_currency())
            : $configured;

        return $configured !== '' && $store === $configured;
    }

    /**
     * Hooks are registered by whichever instance WooCommerce built first, and
     * that instance keeps the settings it was constructed with. A settings
     * save in the same process (or any code that builds a gateway early) would
     * therefore leave release/report running against stale or empty
     * credentials. Resolve the live gateway for hook work.
     */
    private static function live_gateway()
    {
        if (function_exists('WC') && WC()->payment_gateways()) {
            $gateways = WC()->payment_gateways()->payment_gateways();
            $gateway = isset($gateways['tazella_gift_cards']) ? $gateways['tazella_gift_cards'] : null;
            if ($gateway instanceof self) {
                return $gateway;
            }
        }

        return null;
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

    /**
     * A card code is a bearer instrument and `validate` answers whether a guess
     * exists. Without a local counter, a checkout page doubles as an unlimited
     * oracle. Attempts are counted per client address, not per card, so one
     * visitor's failures cannot lock a legitimate card holder out.
     */
    private function client_ip()
    {
        $ip = '';
        if (class_exists('WC_Geolocation')) {
            $ip = (string) WC_Geolocation::get_ip_address();
        }
        if ($ip === '' && isset($_SERVER['REMOTE_ADDR'])) {
            $ip = (string) wp_unslash($_SERVER['REMOTE_ADDR']);
        }

        return (string) apply_filters('tazella_gift_cards_client_ip', $ip);
    }

    private function attempt_key()
    {
        return 'tazella_gc_attempts_' . md5($this->client_ip());
    }

    private function attempt_state()
    {
        $state = get_transient($this->attempt_key());
        if (!is_array($state)) {
            return ['failures' => 0, 'blocked_until' => 0];
        }

        return array_merge(['failures' => 0, 'blocked_until' => 0], $state);
    }

    private function attempt_window()
    {
        return max(1, (int) $this->get_option('attempt_window_minutes', '15')) * MINUTE_IN_SECONDS;
    }

    private function assert_not_throttled()
    {
        if ((int) $this->get_option('max_attempts', '10') <= 0) {
            return;
        }

        $state = $this->attempt_state();
        if ((int) $state['blocked_until'] > time()) {
            throw new TazellaException(
                'RATE_LIMITED',
                TazellaException::publicMessage('RATE_LIMITED'),
                true
            );
        }
    }

    private function register_failed_attempt()
    {
        $max = (int) $this->get_option('max_attempts', '10');
        if ($max <= 0) {
            return;
        }

        $state = $this->attempt_state();
        $state['failures'] = (int) $state['failures'] + 1;
        if ($state['failures'] >= $max) {
            $state['blocked_until'] = time() + $this->attempt_window();
        }
        set_transient($this->attempt_key(), $state, $this->attempt_window());

        $this->log('attempt failures=' . $state['failures']
            . ' blocked=' . ($state['blocked_until'] > time() ? 'yes' : 'no'));
    }

    private function clear_attempts()
    {
        delete_transient($this->attempt_key());
    }

    private function allow_partial_payments()
    {
        return $this->get_option('partial_payments', 'no') === 'yes';
    }

    /**
     * Whether the card has already been charged for (part of) this order. Such
     * an order can no longer be treated as unpaid: cancelling it would take the
     * money and leave the customer with nothing.
     */
    private function has_captured_amount($order)
    {
        if ((int) $order->get_meta('_tazella_applied_minor') > 0) {
            return true;
        }

        return in_array(
            (string) $order->get_meta('_tazella_status'),
            ['captured', 'partially_captured', 'reversed', 'refund_required'],
            true
        );
    }

    private function client()
    {
        return new Client(
            $this->setting('base_url', 'TAZELLA_WC_BASE_URL') ?: 'https://tazella.com.qa',
            $this->setting('platform_code', 'TAZELLA_WC_PLATFORM_CODE') ?: 'wordpress',
            $this->setting('environment', 'TAZELLA_WC_ENVIRONMENT') ?: 'sandbox',
            $this->setting('api_key', 'TAZELLA_WC_API_KEY'),
            $this->setting('signing_secret', 'TAZELLA_WC_SIGNING_SECRET')
        );
    }

    /**
     * The validate endpoint reports a lowercase reason such as `not_found`.
     * Translate it into the gateway error code so the customer sees the same
     * wording as the marketplace uses.
     */
    private function reasonToCode($reason)
    {
        switch (strtolower((string) $reason)) {
            case 'not_found':
            case 'wrong_business':
                return 'CARD_NOT_FOUND';
            case 'not_monetary':
            case 'inactive':
                return 'CARD_INACTIVE';
            case 'expired':
                return 'CARD_EXPIRED';
            case 'currency_mismatch':
                return 'CURRENCY_MISMATCH';
            case 'no_balance':
                return 'INSUFFICIENT_BALANCE';
            default:
                return 'CARD_INACTIVE';
        }
    }

    /** Tazella minor units are hundredths of the currency unit. */
    private function minor($amount)
    {
        return (int) round(((float) wc_format_decimal($amount)) * 100);
    }

    private function vendorRequest()
    {
        $request = [];
        $vendor = $this->setting('external_vendor_id', 'TAZELLA_WC_VENDOR_ID');
        $branch = $this->setting('external_branch_id', 'TAZELLA_WC_BRANCH_ID');

        if ($vendor !== '') {
            $request['external_vendor_id'] = $vendor;
        }
        if ($branch !== '') {
            $request['external_branch_id'] = $branch;
        }

        return $request;
    }

    private function log($message)
    {
        if ($this->get_option('debug', 'no') !== 'yes') {
            return;
        }

        if (function_exists('wc_get_logger')) {
            wc_get_logger()->warning($message, ['source' => 'tazella-gift-cards']);
            return;
        }

        error_log('[tazella-gift-cards] ' . $message);
    }

    public function payment_fields()
    {
        $value = isset($_POST['tazella_card_code'])
            ? sanitize_text_field(wp_unslash($_POST['tazella_card_code']))
            : '';

        if ($this->description !== '') {
            echo '<p class="tazella-gift-card-description">' . esc_html($this->description) . '</p>';
        }

        echo '<div class="tazella-gift-card-fields">';
        echo '<label for="tazella_card_code">' . esc_html__('Gift card code', 'tazella-gift-cards') . '</label> ';
        echo '<input type="text" id="tazella_card_code" name="tazella_card_code" value="' . esc_attr($value) . '" autocomplete="off" autocapitalize="characters" spellcheck="false" dir="ltr" maxlength="64" placeholder="GFT-XXXXXXXXXX" />';
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
            if (!is_array($item) || !isset($item['key'], $item['value'])) {
                continue;
            }
            if ($item['key'] !== 'tazella_card_code') {
                continue;
            }

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
        $configured = strtoupper(trim($this->setting('currency', 'TAZELLA_WC_CURRENCY')));
        $orderMinor = $this->minor($order->get_total());

        if ($code === '' || $orderMinor <= 0) {
            wc_add_notice(__('This order cannot be paid with a gift card.', 'tazella-gift-cards'), 'error');
            return ['result' => 'failure'];
        }
        if ($currency !== $configured) {
            wc_add_notice(TazellaException::publicMessage('CURRENCY_MISMATCH'), 'error');
            return ['result' => 'failure'];
        }

        $client = $this->client();
        $vendor = $this->vendorRequest();
        $allowPartial = $this->allow_partial_payments();

        try {
            $this->assert_not_throttled();

            $validation = $client->validate(array_merge($vendor, [
                'card_code' => $code,
                'currency' => $currency,
            ]));

            if (empty($validation['valid'])) {
                $reason = isset($validation['reason']) ? (string) $validation['reason'] : '';
                $code = $this->reasonToCode($reason);
                throw new TazellaException($code, TazellaException::publicMessage($code), false);
            }

            $available = isset($validation['available_minor']) ? (int) $validation['available_minor'] : 0;

            // Without split tender this gateway must cover the whole total:
            // taking a partial amount and marking the order paid would leave the
            // store unpaid for the difference. With split tender the reserve step
            // asks only for the covered part and the order stays on hold.
            if ($available < $orderMinor && !$allowPartial) {
                throw new TazellaException(
                    'INSUFFICIENT_BALANCE',
                    TazellaException::publicMessage('INSUFFICIENT_BALANCE'),
                    false
                );
            }

            $ttl = max(60, (int) $this->get_option('ttl_seconds', '600'));
            $reservation = $client->reserve(array_merge($vendor, [
                'external_order_id' => 'woo_' . $order->get_id(),
                'card_code' => $code,
                'order_amount_minor' => $orderMinor,
                // In split-tender mode the hold asks only for what the card can
                // cover; otherwise it asks for the full total and the gateway
                // decides whether the balance is sufficient.
                'requested_amount_minor' => $allowPartial ? min($orderMinor, $available) : $orderMinor,
                'currency' => $currency,
                'ttl_seconds' => $ttl,
                'idempotency_key' => Client::stableKey('reserve:woo:' . $order->get_id() . ':' . $code),
            ]));

            $reference = isset($reservation['reservation_reference'])
                ? (string) $reservation['reservation_reference']
                : '';
            $applied = isset($reservation['applied_amount_minor'])
                ? (int) $reservation['applied_amount_minor']
                : 0;

            if ($reference === '' || $applied <= 0) {
                throw new TazellaException(
                    'INTERNAL_ERROR',
                    TazellaException::publicMessage('INTERNAL_ERROR'),
                    false
                );
            }

            $order->update_meta_data('_tazella_reservation_reference', $reference);

            // Record when the hold lapses so an abandoned checkout can be swept
            // up instead of leaving the customer's balance reserved.
            $expiresAt = isset($reservation['expires_at'])
                ? strtotime((string) $reservation['expires_at'])
                : false;
            $order->update_meta_data(
                '_tazella_hold_expires_at',
                $expiresAt ? (int) $expiresAt : time() + $ttl
            );

            // A hold smaller than the order total must never silently become a
            // paid order. Either release it, or — when split tender is enabled —
            // capture the covered amount and leave the rest due.
            $partial = $applied < $orderMinor;
            if ($partial && !$allowPartial) {
                try {
                    $client->release($reference, array_merge($vendor, [
                        'reason' => 'woocommerce_underpaid',
                        'idempotency_key' => Client::stableKey('release-underpaid:woo:' . $order->get_id()),
                    ]));
                } catch (Throwable $releaseError) {
                    $this->log('release-after-underpay ' . $releaseError->getMessage());
                }

                throw new TazellaException(
                    'INSUFFICIENT_BALANCE',
                    TazellaException::publicMessage('INSUFFICIENT_BALANCE'),
                    false
                );
            }

            $order->update_meta_data('_tazella_status', 'active');
            $order->update_meta_data(
                '_tazella_card_masked',
                isset($reservation['card']['masked_code']) ? (string) $reservation['card']['masked_code'] : ''
            );
            $order->save_meta_data();

            // WooCommerce's checkout submission is the verified payment event
            // for this self-hosted gateway. Capture only the confirmed amount.
            $capturedMinor = $partial ? $applied : $orderMinor;
            $capture = $client->capture($reference, array_merge($vendor, [
                'external_payment_reference' => 'woo_' . $order->get_id(),
                'confirmed_order_amount_minor' => $capturedMinor,
                'currency' => $currency,
                'idempotency_key' => Client::stableKey('capture:woo:' . $order->get_id()),
            ]));

            if (isset($capture['status']) && (string) $capture['status'] === 'reconciliation') {
                throw new TazellaException(
                    'RECONCILIATION_REQUIRED',
                    TazellaException::publicMessage('RECONCILIATION_REQUIRED'),
                    false
                );
            }

            if (($capture['status'] ?? '') !== 'captured') {
                throw new TazellaException(
                    'RECONCILIATION_REQUIRED',
                    TazellaException::publicMessage('RECONCILIATION_REQUIRED'),
                    false
                );
            }

            // The refund endpoint takes the redemption UUID, not the readable
            // reference. Storing the reference here broke every refund.
            $redemptionId = isset($capture['redemption_id']) ? (string) $capture['redemption_id'] : '';
            $redemptionReference = isset($capture['redemption_reference'])
                ? (string) $capture['redemption_reference']
                : '';

            $order->update_meta_data('_tazella_applied_minor', $capturedMinor);
            $order->update_meta_data('_tazella_redemption_id', $redemptionId);
            $order->update_meta_data('_tazella_redemption_reference', $redemptionReference);
            $order->update_meta_data('_tazella_status', $partial ? 'partially_captured' : 'captured');
            // The card code is a bearer instrument: once it is spent, do not
            // keep the plaintext on the order.
            $order->delete_meta_data('_tazella_card_code');
            $order->save_meta_data();
            $this->clear_attempts();

            $redemptionLabel = $redemptionReference !== '' ? $redemptionReference : $redemptionId;

            if ($partial) {
                $remainingMinor = $orderMinor - $capturedMinor;
                $order->update_meta_data('_tazella_remaining_minor', $remainingMinor);
                $order->save_meta_data();

                $order->add_order_note(sprintf(
                    /* translators: 1: gift-card amount, 2: order total, 3: amount still due, 4: redemption reference */
                    __('Tazella gift card covered %1$s of %2$s. %3$s is still due; the order was left on hold. Redemption: %4$s', 'tazella-gift-cards'),
                    wc_price($capturedMinor / 100, ['currency' => $currency]),
                    wc_price($orderMinor / 100, ['currency' => $currency]),
                    wc_price($remainingMinor / 100, ['currency' => $currency]),
                    $redemptionLabel
                ));

                wc_add_notice(sprintf(
                    /* translators: 1: gift-card amount, 2: amount still due */
                    __('Gift card applied: %1$s. %2$s is still due; the store will contact you to collect it.', 'tazella-gift-cards'),
                    wc_price($capturedMinor / 100, ['currency' => $currency]),
                    wc_price($remainingMinor / 100, ['currency' => $currency])
                ), 'notice');

                // Not payment_complete(): the order is not paid in full, so it
                // must stay visible as awaiting the remaining balance.
                $order->update_status('on-hold', __('Partially paid with a Tazella gift card; the remaining balance is still due.', 'tazella-gift-cards'));
                $order->save();

                return [
                    'result' => 'success',
                    'redirect' => $this->get_return_url($order),
                ];
            }

            $order->add_order_note(sprintf(
                /* translators: 1: amount in minor units, 2: redemption reference */
                __('Tazella gift card applied: %1$d minor units. Redemption: %2$s', 'tazella-gift-cards'),
                $capturedMinor,
                $redemptionLabel
            ));
            $order->payment_complete($redemptionLabel);

            // Reporting is best-effort and must never undo a completed payment.
            $this->report_event($order, 'order.paid', $client, $orderMinor, $currency);

            return [
                'result' => 'success',
                'redirect' => $this->get_return_url($order),
            ];
        } catch (TazellaException $error) {
            $this->log($error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
            // Only lookups that betray a guessed code count toward the limit; a
            // genuine but underfunded card is not an attack.
            if (in_array($error->errorCode(), ['CARD_NOT_FOUND', 'CARD_INACTIVE', 'CARD_EXPIRED', 'CARD_WRONG_BUSINESS'], true)) {
                $this->register_failed_attempt();
            }
            $order->update_status('failed', sprintf(
                /* translators: 1: error code, 2: request id */
                __('Tazella gift card payment failed: %1$s (request %2$s)', 'tazella-gift-cards'),
                $error->errorCode(),
                $error->requestId() ?? '—'
            ));
            wc_add_notice($error->getMessage(), 'error');
            return ['result' => 'failure'];
        } catch (Throwable $error) {
            $this->log('unexpected ' . $error->getMessage());
            $order->update_status('failed', __('Tazella gift card payment failed unexpectedly.', 'tazella-gift-cards'));
            wc_add_notice(
                TazellaException::publicMessage('INTERNAL_ERROR'),
                'error'
            );
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
            return new WP_Error(
                'tazella_refund_unavailable',
                __('This order has no recorded Tazella redemption to reverse.', 'tazella-gift-cards')
            );
        }

        // A split-tender order is worth more than the card covered, so the
        // default refund must never exceed the captured amount.
        $capturedMinor = (int) $order->get_meta('_tazella_applied_minor');
        $amountMinor = $amount === null
            ? ($capturedMinor > 0 ? $capturedMinor : $this->minor($order->get_total()))
            : $this->minor($amount);
        if ($capturedMinor > 0 && $amountMinor > $capturedMinor) {
            return new WP_Error(
                'tazella_refund_exceeds_capture',
                __('The refund is larger than the amount this gift card paid.', 'tazella-gift-cards')
            );
        }
        if ($amountMinor <= 0) {
            return new WP_Error(
                'tazella_refund_invalid_amount',
                __('Enter a refund amount greater than zero.', 'tazella-gift-cards')
            );
        }

        // The refund object already exists when this runs, so the count
        // distinguishes two identical partial refunds on the same order.
        $refundCount = method_exists($order, 'get_refunds') ? count($order->get_refunds()) : 1;

        try {
            $refund = $this->client()->refund($redemptionId, array_merge($this->vendorRequest(), [
                'amount_minor' => $amountMinor,
                'reason' => $reason !== '' ? sanitize_text_field($reason) : 'woocommerce_refund',
                'idempotency_key' => Client::stableKey(
                    'refund:' . $redemptionId . ':' . $amountMinor . ':' . $refundCount
                ),
            ]));

            $order->update_meta_data(
                '_tazella_refunded_minor',
                isset($refund['refunded_total_minor'])
                    ? (int) $refund['refunded_total_minor']
                    : $amountMinor
            );
            $order->save_meta_data();
            $order->add_order_note(sprintf(
                /* translators: %d: refunded amount in minor units */
                __('Tazella gift-card reversal completed: %d minor units.', 'tazella-gift-cards'),
                $amountMinor
            ));

            $this->report_event(
                $order,
                'order.refunded',
                $this->client(),
                $amountMinor,
                strtoupper($order->get_currency())
            );

            return true;
        } catch (TazellaException $error) {
            $this->log('refund ' . $error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
            return new WP_Error(
                'tazella_refund_failed',
                $error->getMessage(),
                ['request_id' => $error->requestId(), 'code' => $error->errorCode()]
            );
        } catch (Throwable $error) {
            $this->log('refund unexpected ' . $error->getMessage());
            return new WP_Error(
                'tazella_refund_failed',
                TazellaException::publicMessage('INTERNAL_ERROR')
            );
        }
    }

    /**
     * Release holds whose checkout never finished. When a customer closes the
     * tab after the hold is taken, the balance stays reserved at Tazella until
     * the reservation lapses; nobody releases it and the vendor's support queue
     * inherits the complaint. Only orders that were never captured are swept,
     * and a release always uses the deterministic key so a retry is harmless.
     */
    public static function sweep_expired_holds($limit = 50)
    {
        $gateway = self::live_gateway();
        if (!$gateway || !$gateway->has_credentials()) {
            return 0;
        }

        $orders = wc_get_orders([
            'limit' => max(1, (int) $limit),
            'status' => ['pending', 'failed', 'on-hold', 'cancelled', 'checkout-draft'],
            'orderby' => 'date',
            'order' => 'ASC',
            'meta_query' => [
                ['key' => '_tazella_status', 'value' => 'active'],
                ['key' => '_tazella_hold_expires_at', 'value' => time(), 'compare' => '<', 'type' => 'NUMERIC'],
            ],
        ]);

        $released = 0;
        foreach ($orders as $order) {
            if (!is_object($order) || !method_exists($order, 'get_meta')) {
                continue;
            }
            if ((string) $order->get_payment_method() !== $gateway->id) {
                continue;
            }

            $reference = (string) $order->get_meta('_tazella_reservation_reference');
            if ($reference === '') {
                continue;
            }

            try {
                $gateway->client()->release($reference, array_merge($gateway->vendorRequest(), [
                    'reason' => 'woocommerce_hold_expired',
                    'idempotency_key' => Client::stableKey('sweep-release:woo:' . $order->get_id()),
                ]));
                $order->update_meta_data('_tazella_status', 'released');
                $order->save_meta_data();
                $order->add_order_note(__(
                    'Tazella gift-card hold expired and was released automatically.',
                    'tazella-gift-cards'
                ));
                $released++;
            } catch (TazellaException $error) {
                // A hold that was captured meanwhile is not ours to release.
                $gateway->log('sweep ' . $error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
            } catch (Throwable $error) {
                $gateway->log('sweep unexpected ' . $error->getMessage());
            }
        }

        return $released;
    }

    /**
     * WooCommerce cancels unpaid orders on a schedule. A split-tender order may
     * be pending for a moment after its card capture (a fatal in the checkout
     * request, a slow status write), and the cron would then cancel an order
     * the customer has already paid for. Never let that happen: leave the order
     * for a human to resolve instead, and say so on the order.
     */
    public function keep_captured_orders_from_cancellation($should_cancel, $order)
    {
        if (!$should_cancel || !is_object($order) || !method_exists($order, 'get_meta')) {
            return $should_cancel;
        }
        if ((string) $order->get_payment_method() !== $this->id) {
            return $should_cancel;
        }
        if (!$this->has_captured_amount($order)) {
            return $should_cancel;
        }

        if ((string) $order->get_meta('_tazella_cancel_blocked') !== 'yes') {
            $order->update_meta_data('_tazella_cancel_blocked', 'yes');
            $order->save_meta_data();
            $order->add_order_note(__(
                'WooCommerce did not cancel this unpaid order automatically: a Tazella gift card has already captured part of its total. Collect the remaining balance, or cancel the order and reverse the card payment.',
                'tazella-gift-cards'
            ));
        }

        $this->log('unpaid-cancel blocked order=' . $order->get_id()
            . ' applied=' . (int) $order->get_meta('_tazella_applied_minor'));

        return false;
    }

    public function maybe_release_on_cancel($order_id)
    {
        $gateway = self::live_gateway() ?: $this;
        $order = wc_get_order($order_id);
        if (!$order || !$gateway->has_credentials()) {
            return;
        }
        if ((string) $order->get_payment_method() !== $gateway->id) {
            return;
        }

        // Cancelling a captured order must not leave the card charged. Return
        // whatever part of the capture has not been refunded yet; a hold that
        // was never captured is released below instead.
        if ($gateway->has_captured_amount($order)) {
            $gateway->reverse_cancelled_capture($order);
            return;
        }

        $reference = (string) $order->get_meta('_tazella_reservation_reference');
        $status = (string) $order->get_meta('_tazella_status');
        if ($reference === '' || $status !== 'active') {
            return;
        }

        try {
            $gateway->client()->release($reference, array_merge($gateway->vendorRequest(), [
                'reason' => 'woocommerce_order_cancelled',
                'idempotency_key' => Client::stableKey('release:woo:' . $order->get_id()),
            ]));
            $order->update_meta_data('_tazella_status', 'released');
            $order->save_meta_data();
        } catch (TazellaException $error) {
            // A captured reservation cannot be released; leave it recorded.
            $gateway->log('release ' . $error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
        }
    }

    /**
     * An order cancelled after the card was charged is refunded in full through
     * the audited reversal endpoint. If the reversal cannot be made, the order
     * is left flagged for a human rather than silently keeping the money.
     */
    private function reverse_cancelled_capture($order)
    {
        if ((string) $order->get_meta('_tazella_status') === 'reversed') {
            return;
        }

        $applied = (int) $order->get_meta('_tazella_applied_minor');
        $alreadyRefunded = (int) $order->get_meta('_tazella_refunded_minor');
        $outstanding = $applied - $alreadyRefunded;
        if ($outstanding <= 0) {
            return;
        }

        $redemptionId = (string) $order->get_meta('_tazella_redemption_id');
        if ($redemptionId === '') {
            $order->update_meta_data('_tazella_status', 'refund_required');
            $order->save_meta_data();
            $order->add_order_note(__(
                'This order was cancelled after a Tazella gift card was charged, but no redemption was recorded. Refund the card in Tazella.',
                'tazella-gift-cards'
            ));
            $this->log('cancel-refund missing-redemption order=' . $order->get_id());
            return;
        }

        try {
            $refund = $this->client()->refund($redemptionId, array_merge($this->vendorRequest(), [
                'amount_minor' => $outstanding,
                'reason' => 'woocommerce_order_cancelled',
                'idempotency_key' => Client::stableKey('cancel-refund:' . $redemptionId . ':' . $outstanding),
            ]));

            $order->update_meta_data(
                '_tazella_refunded_minor',
                isset($refund['refunded_total_minor'])
                    ? (int) $refund['refunded_total_minor']
                    : $applied
            );
            $order->update_meta_data('_tazella_status', 'reversed');
            $order->update_meta_data('_tazella_remaining_minor', 0);
            $order->save_meta_data();

            $order->add_order_note(sprintf(
                /* translators: 1: refunded amount, 2: currency, 3: redemption reference or id */
                __('Order cancelled after the Tazella gift card captured %1$s. That amount was returned to the card. Reversal: %2$s', 'tazella-gift-cards'),
                wc_price($outstanding / 100, ['currency' => $order->get_currency()]),
                (string) $order->get_meta('_tazella_redemption_reference') !== ''
                    ? (string) $order->get_meta('_tazella_redemption_reference')
                    : $redemptionId
            ));
            $this->log('cancel-refund order=' . $order->get_id() . ' amount=' . $outstanding);
        } catch (TazellaException $error) {
            $order->update_meta_data('_tazella_status', 'refund_required');
            $order->save_meta_data();
            $order->add_order_note(sprintf(
                /* translators: 1: error code, 2: amount still to refund, 3: request id */
                __('The Tazella gift-card reversal for this cancelled order failed: %1$s. Refund %2$s manually (request %3$s).', 'tazella-gift-cards'),
                $error->errorCode(),
                wc_price($outstanding / 100, ['currency' => $order->get_currency()]),
                $error->requestId() ?? '—'
            ));
            $this->log('cancel-refund ' . $error->errorCode() . ' ' . ($error->requestId() ?? 'no-request-id'));
        } catch (Throwable $error) {
            $order->update_meta_data('_tazella_status', 'refund_required');
            $order->save_meta_data();
            $order->add_order_note(sprintf(
                /* translators: %s: amount still to refund */
                __('The Tazella gift-card reversal for this cancelled order failed unexpectedly. Refund %s manually in Tazella.', 'tazella-gift-cards'),
                wc_price($outstanding / 100, ['currency' => $order->get_currency()])
            ));
            $this->log('cancel-refund unexpected ' . $error->getMessage());
        }
    }

    public function maybe_report_refunded($order_id)
    {
        $gateway = self::live_gateway() ?: $this;
        $order = wc_get_order($order_id);
        if (!$order || !$gateway->has_credentials() || (string) $order->get_meta('_tazella_redemption_id') === '') {
            return;
        }
        if ((string) $order->get_payment_method() !== $gateway->id) {
            return;
        }

        $gateway->report_event(
            $order,
            'order.refunded',
            $gateway->client(),
            $this->minor($order->get_total()),
            strtoupper($order->get_currency())
        );
    }

    /**
     * Reconciliation events are informative. A failure here must never turn a
     * captured payment or a completed refund into a failure.
     */
    private function report_event($order, $type, Client $client, $amountMinor, $currency)
    {
        try {
            $client->orderEvent([
                'event_id' => 'woo_' . $order->get_id() . '_' . $type,
                'event_type' => $type,
                'external_order_id' => 'woo_' . $order->get_id(),
                'reservation_reference' => (string) $order->get_meta('_tazella_reservation_reference'),
                'amount_minor' => $amountMinor,
                'currency' => $currency,
                'occurred_at' => gmdate('c'),
                'idempotency_key' => Client::stableKey('event:' . $order->get_id() . ':' . $type),
            ]);
        } catch (Throwable $error) {
            $this->log('event ' . $type . ' ' . $error->getMessage());
        }
    }

    public function thankyou_page($order_id)
    {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        $applied = (int) $order->get_meta('_tazella_applied_minor');
        if ($applied > 0) {
            echo '<p class="woocommerce-order-overview">' . wp_kses_post(sprintf(
                /* translators: %s: formatted gift-card amount */
                __('Paid with Tazella gift card: %s', 'tazella-gift-cards'),
                wc_price($applied / 100, ['currency' => $order->get_currency()])
            )) . '</p>';

            $remaining = (int) $order->get_meta('_tazella_remaining_minor');
            if ($remaining > 0) {
                echo '<p class="woocommerce-order-overview">' . wp_kses_post(sprintf(
                    /* translators: %s: formatted amount still due */
                    __('Still due, to be collected by the store: %s', 'tazella-gift-cards'),
                    wc_price($remaining / 100, ['currency' => $order->get_currency()])
                )) . '</p>';
            }
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
                /* translators: %s: masked card code */
                __('Tazella gift card: %s', 'tazella-gift-cards'),
                $masked
            )) . '</p>';
        }
    }
}
