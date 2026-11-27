# Tazella Gift Cards for WordPress / WooCommerce

Early infrastructure (`0.1.0`). This package contains:

- `src/Tazella/Client.php` — a PHP SDK for the Tazella integration gateway. It
  owns the platform credential, signs every request and enforces idempotency.
- `src/Gateway.php` — a `WC_Payment_Gateway` implementation.
- `tazella-gift-cards.php` — the WordPress plugin bootstrap.

It has **not** been run against a WordPress/WooCommerce install or a live Tazella
sandbox. Treat it as a reviewed scaffold, not a certified plugin.

## Trust boundary

```text
Browser (card code only)
   → WooCommerce plugin REST/AJAX (your server)
      → Tazella\GiftCards\Client (holds API key + signing secret, signs requests)
         → Tazella gateway → Postgres RPCs
```

No credential, signing secret, full card code or buyer identity is placed in
browser JavaScript. The checkout field only collects the card code.

## Requirements

- WordPress with WooCommerce active.
- PHP 7.4 or newer.
- A Tazella platform credential for the `wordpress` platform code, plus a
  **verified** external vendor/branch mapping created by Tazella. A store ID
  typed into settings is not proof of ownership.
- The same currency configured in WooCommerce and in Tazella. No conversion is
  performed; a mismatched currency is rejected.

## Install

1. Copy `tazella-gift-cards/` into `wp-content/plugins/`.
2. Activate **Tazella Gift Cards** in WordPress.
3. Go to **WooCommerce → Settings → Payments → Tazella gift cards**.
4. Set environment (`sandbox` first), site URL, platform code, API key, signing
   secret, verified external vendor ID/branch ID, and currency.
5. Enable the method and run a sandbox order.

Credentials are stored by WordPress in the options table, in the payment
gateway settings. Restrict access to that settings page to administrators and
keep backups encrypted.

For sites that prefer not to store the plaintext in `wp_options`, define these
constants in `wp-config.php` (environment variables with the same names also
work). A constant takes precedence over the settings page:

```php
define('TAZELLA_WC_API_KEY', 'tz_live_...');
define('TAZELLA_WC_SIGNING_SECRET', '...');
define('TAZELLA_WC_PLATFORM_CODE', 'wordpress');
define('TAZELLA_WC_ENVIRONMENT', 'sandbox');
define('TAZELLA_WC_VENDOR_ID', 'verified-store-id');
define('TAZELLA_WC_BRANCH_ID', 'verified-store-id-01');
define('TAZELLA_WC_CURRENCY', 'QAR');
```

The gateway settings page runs a `/health` check with the configured key and
shows whether the connection is valid.

## Payment lifecycle in WooCommerce

1. `validate` checks the card against the mapped business before the order is
   charged.
2. `reserve` creates a short-lived hold for the eligible amount. WooCommerce
   order meta stores the reservation reference and applied amount.
3. WooCommerce's own checkout submission is the verified payment event for
   this self-hosted gateway. `capture` then writes the redemption and ledger
   entry and calls `$order->payment_complete()`.
4. Cancelling an uncaptured order calls `release`. A captured order can never
   be released.
5. A WooCommerce refund calls the audited `refund` endpoint with the stored
   redemption ID. Uncertain states become reconciliation cases in Tazella.
6. `order.paid` and `order.refunded` events are reported for reconciliation and
   deduplicated by `event_id` in the gateway.

External redemptions never create orders, invoices or fulfilment inside
Tazella. WooCommerce remains the order system for the store.

## SDK usage outside WordPress

```php
use Tazella\GiftCards\Client;

$client = new Client(
    'https://tazella.com.qa',
    'wordpress',
    'sandbox',
    $apiKey,
    $signingSecret
);

$card = $client->validate([
    'external_vendor_id' => 'verified-store-id',
    'card_code' => 'GFT-AB12CD34EF',
    'currency' => 'QAR',
]);
```

`Client` uses WordPress HTTP functions when available and cURL otherwise. A
custom `HttpClient` implementation can be injected for tests. Errors are
`TazellaException` with `errorCode()`, `requestId()`, `httpStatus()` and a safe
display message.

## Building the installable ZIP

```bash
node scripts/package-wordpress-plugin.mjs
```

This writes `packages/wordpress/tazella-gift-cards-<version>.zip`, ready for
WordPress → Plugins → Add new → Upload plugin. The generated ZIP is gitignored.

## Tests

The PHP client tests require PHPUnit and Composer (not present in this repo):

```bash
composer install
vendor/bin/phpunit
```

They cover HMAC signing, idempotency header handling, body sanitisation and
safe error mapping. No WordPress runtime is required for those tests.

## Known gaps

- No end-to-end run against WooCommerce or a Tazella sandbox.
- No WooCommerce Blocks (`Store API`) checkout integration; the classic
  shortcode checkout is covered.
- No subscriptions, partial captures above reservations, or multi-currency
  stores.
- No activation-time capability check against the Tazella platform registry.
- No compiled distribution or WordPress.org release.
