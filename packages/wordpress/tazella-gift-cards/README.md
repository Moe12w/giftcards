# Tazella Gift Cards for WordPress / WooCommerce

Early infrastructure (`0.1.0`). This package contains:

- `src/Tazella/Client.php` — a PHP SDK for the Tazella integration gateway. It
  owns the platform credential, signs every request and enforces idempotency.
- `src/Gateway.php` — a `WC_Payment_Gateway` implementation (classic checkout).
- `src/Blocks.php` + `assets/js/blocks.js` — WooCommerce Blocks checkout support.
- `tazella-gift-cards.php` — the WordPress plugin bootstrap.

Status: **runs end to end on a real WordPress 7.1.5 + WooCommerce 11.3.1 install,
against a stand-in gateway** (see [Tests](#tests)). It has not been run against
the production Tazella gateway or a live vendor store yet, so treat it as
sandbox-verified, not production-certified.

## Where the ZIP comes from

The installable archive is built from this folder:

```bash
node scripts/package-wordpress-plugin.mjs   # or: npm run package:wordpress
```

It writes two files:

| Path | Purpose |
|---|---|
| `packages/wordpress/tazella-gift-cards-<version>.zip` | versioned archive |
| `web/public/downloads/tazella-gift-cards.zip` | the public download link used on `/plug-in-integrations` |

The script is dependency-free (it writes the ZIP itself) and refuses to build if
the plugin header `Version:` and `composer.json` `version` disagree. The web copy
is committed so the download link works on any host, including static deployments
where `packages/` is not shipped. Re-run the script whenever the plugin changes.

## Trust boundary

```text
Browser (card code only)
   → WooCommerce plugin REST/AJAX (your server)
      → Tazella\GiftCards\Client (holds API key + signing secret, signs requests)
         → Tazella gateway → Postgres RPCs
```

No credential, signing secret, full card code or buyer identity is placed in
browser JavaScript. The checkout field only collects the card code, and the code
is removed from order meta once the card is captured.

Both checkout styles are supported:

- **Classic shortcode checkout** — the card field is rendered by `payment_fields()`.
- **WooCommerce Blocks / Store API** — `src/Blocks.php` registers the method and
  `assets/js/blocks.js` collects the card code. The code is passed as
  `payment_data` and stored in order meta by
  `woocommerce_store_api_checkout_update_order_from_request`; `process_payment`
  reads it from either source.

## Requirements

- WordPress 6.4+ with WooCommerce 8.0+ active.
- PHP 7.4 or newer, with the `curl` or WordPress HTTP API available.
- HTTPS on the store domain.
- A Tazella platform credential for the `wordpress` platform code, plus a
  **verified** external vendor mapping created by Tazella. A store ID typed into
  settings is not proof of ownership.
- The same currency configured in WooCommerce and in Tazella. No conversion is
  performed; a mismatched currency is rejected and the method hides itself.

## Install

1. Download `tazella-gift-cards.zip` from `/plug-in-integrations` (or build it
   with the script above). **Do not unzip it.**
2. In WordPress open **Plugins → Add New → Upload Plugin**, choose the ZIP and
   click **Install Now**.
3. Activate **Tazella Gift Cards**.
4. Go to **WooCommerce → Settings → Payments → Tazella gift cards**.
5. Paste the **API key** and **signing secret** issued in the vendor dashboard,
   set **Environment** to the environment the key was issued for, and save.
6. The settings page runs a `/health` call. It must say **Connection verified**
   before you enable the method.
7. Enable the method and place a sandbox order.

The verified store is resolved from the key (`mapping_id` on the credential), so
the **External vendor ID** field is optional and should stay empty. Fill it only
if Tazella support asks; if supplied, it must match the mapping the key is bound
to or the request is rejected with `FORBIDDEN_SCOPE`.

Credentials are stored by WordPress in the options table, in the payment gateway
settings. Restrict access to that settings page to administrators and keep
backups encrypted.

For sites that prefer not to store the plaintext in `wp_options`, define these
constants in `wp-config.php` (environment variables with the same names also
work). A constant takes precedence over the settings page:

```php
define('TAZELLA_WC_API_KEY', 'tz_sandbox_...');
define('TAZELLA_WC_SIGNING_SECRET', '...');
```

Optional overrides: `TAZELLA_WC_BASE_URL`, `TAZELLA_WC_ENVIRONMENT`,
`TAZELLA_WC_PLATFORM_CODE`, `TAZELLA_WC_VENDOR_ID`, `TAZELLA_WC_BRANCH_ID`,
`TAZELLA_WC_CURRENCY`.

## Payment lifecycle in WooCommerce

1. `validate` checks the card against the mapped business before the order is
   charged.
2. If the available balance is lower than the order total, the payment fails
   before a hold is taken. This gateway is the only method for the order, so a
   partial gift-card payment is never marked paid.
3. `reserve` creates a short-lived hold for the exact order total. If the hold
   comes back smaller than the total, it is released and the payment fails.
4. WooCommerce's own checkout submission is the verified payment event for this
   self-hosted gateway. `capture` writes the redemption and ledger entry, then
   `$order->payment_complete()` runs.
5. Cancelling an uncaptured order calls `release`. A captured order is never
   released.
6. A WooCommerce refund calls the audited `refund` endpoint with the redemption
   UUID returned by capture.
7. `order.paid` and `order.refunded` events are reported for reconciliation. A
   failing report is logged and never changes the payment result.

Idempotency keys are derived from the order and operation (`Client::stableKey`),
so a retried checkout replays the original response instead of taking a second
hold.

External redemptions never create orders, invoices or fulfilment inside Tazella.
WooCommerce remains the order system for the store.

## Hooks and compatibility

- Loads on `woocommerce_loaded`; Blocks on `woocommerce_blocks_loaded`.
- Declares compatibility with HPOS (`custom_order_tables`) and
  `cart_checkout_blocks`.
- `supports` includes `products` and `refunds`.

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
    'card_code' => 'GFT-AB12CD34EF',
    'currency' => 'QAR',
]);
```

`Client` uses WordPress HTTP functions when available and cURL otherwise. A
custom `HttpClient` implementation can be injected for tests. Errors are
`TazellaException` with `errorCode()`, `requestId()`, `httpStatus()` and a safe
display message.

## Tests

### Unit tests (PHP client)

The PHP client tests require PHPUnit and Composer (not present in this repo):

```bash
composer install
vendor/bin/phpunit
```

They cover HMAC signing, idempotency header handling, body sanitisation and
safe error mapping. No WordPress runtime is required for those tests.

### Local WordPress end-to-end harness

`tests/sandbox/` runs this plugin inside a real WordPress + WooCommerce store,
against a stand-in for the Tazella gateway. It needs PHP 7.4+ with `mysqli`,
MySQL or MariaDB, and Node 18+ for the mock.

| File | Purpose |
|---|---|
| `mock-gateway.mjs` | Dependency-free `/api/integrations/v1/*` stand-in: bearer auth, HMAC signature and skew window, idempotency replay/conflict, validate, reserve, capture, release, refund and order events, in the same envelope as `web/lib/integrations/gateway.ts`. Test-only control routes live under `/__test/`. |
| `setup-wordpress.sh` | Downloads WordPress + WooCommerce, writes `wp-config.php`, installs the plugin **from the packaged ZIP**, and points the gateway at the mock. |
| `checklist.php` | The go-live checklist as assertions, run with `wp eval-file`. |
| `store-api-checkout.mjs` | A real Blocks checkout over the WooCommerce Store API (`cart` → `add-item` → `checkout` with `payment_data`). |

```bash
# 1. start the stand-in gateway (127.0.0.1:9099)
node tests/sandbox/mock-gateway.mjs &

# 2. create the store (127.0.0.1:8088) and install the plugin ZIP
PHP=/path/to/php WORK=/tmp/tazella-wp bash tests/sandbox/setup-wordpress.sh

# 3. run the checklist inside WordPress
/path/to/wp wp --path=/tmp/tazella-wp/wordpress eval-file tests/sandbox/checklist.php

# 4. exercise the Blocks checkout over HTTP
PHP=/path/to/php -S 127.0.0.1:8088 -t /tmp/tazella-wp/wordpress &
SITE_URL=http://127.0.0.1:8088 PRODUCT_ID=<published product id> REST_ROUTE=1 \
  node tests/sandbox/store-api-checkout.mjs
```

`checklist.php` covers: registration, availability gating (no credentials, wrong
currency), the `/health` connection notice, the classic checkout field and its
empty-code rejection, `CARD_NOT_FOUND` / `CARD_EXPIRED` / `INSUFFICIENT_BALANCE`
handling, refusal of a hold smaller than the order total (plus release), a
successful capture with its order meta and transaction id, retry safety after a
capture transport failure (one hold, one redemption), release on cancellation,
refunds by redemption UUID including two identical partial refunds, `order.paid`
/ `order.refunded` events, log hygiene (no key, secret or card code), Blocks
registration, HPOS compatibility declarations and an HPOS capture/refund cycle,
and a clean `debug.log`.

Last run in this repository's sandbox:

| Setup | Result |
|---|---|
| WordPress 7.1.5, WooCommerce 11.3.1, PHP 8.3.32, MariaDB 10.11.9, HPOS **off** | 84/84 assertions |
| Same, fresh install with HPOS **on** | 88/88 assertions |
| Blocks checkout over the Store API (HPOS on) | 12/12 assertions |

What it still does not cover: the production gateway and its Postgres RPCs, a
live Tazella sandbox card, the browser-side `blocks.js` validation in a real
browser, and the vendor dashboard that issues the key.

## Known gaps

- Not yet run against the production Tazella gateway or a live vendor store.
- No subscriptions, partial gift-card payments, or multi-currency stores.
- No activation-time capability check against the Tazella platform registry.
- No WordPress.org release; distribution is the ZIP link above.
