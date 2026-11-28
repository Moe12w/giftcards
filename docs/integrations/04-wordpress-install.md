# WordPress / WooCommerce: install and go-live checklist

This is the vendor-facing runbook for the Tazella Gift Cards plugin. It is the
same flow described on `/plug-in-integrations#wordpress`.

## 1. Where the ZIP comes from

| Who | Step |
|---|---|
| Tazella | `node scripts/package-wordpress-plugin.mjs` (or `npm run package:wordpress`) |
| Tazella | Commit `web/public/downloads/tazella-gift-cards.zip` |
| Vendor | Download it from `https://<site>/downloads/tazella-gift-cards.zip`, or from the button on `/plug-in-integrations` |

The script builds both the versioned archive in `packages/wordpress/` and the
public copy in `web/public/downloads/`. It fails if the plugin header version and
`composer.json` version disagree, so the download can never lag the source
silently. Never hand a vendor a ZIP built from an older checkout.

## 2. What the vendor needs before installing

1. A Tazella vendor account with a **verified** store mapping on the
   `wordpress` platform. Support creates and verifies the mapping; a store ID the
   vendor types in is not proof of ownership.
2. A key issued from **Vendor dashboard → Settings → WordPress payment keys**.
   The API key and signing secret are shown exactly once, for one environment
   (sandbox or production) and one mapping.
3. A WooCommerce store on HTTPS with a currency that matches the credential
   (QAR today). No conversion is performed.

## 3. Install

1. Plugins → Add New → Upload Plugin → choose the ZIP → **Install Now**.
2. Activate **Tazella Gift Cards**.
3. WooCommerce → Settings → Payments → **Tazella gift cards**.
4. Paste the API key and signing secret.
5. Set **Environment** to the environment the key was issued for.
6. Leave **Platform code** as `wordpress` and **External vendor ID** empty.
7. Save. The page must show **Connection verified: wordpress (sandbox, platform
   active)**. If it does not, the message names the failure:
   - `UNAUTHORIZED` — key, secret or environment do not match the credential.
   - `PLATFORM_NOT_ACTIVE` — Tazella support has suspended the platform/credential.
   - `MAPPING_NOT_ACTIVE` — the store mapping is not active yet.
8. Enable the payment method.
9. Place a sandbox order and pay with a sandbox card code.

## 4. Go-live verification (Tazella side)

Run these against a real WordPress install before telling a vendor "production":

- [ ] Plugin activates with WooCommerce active and no PHP notice.
- [ ] Payment method is hidden when credentials are empty or the currency differs.
- [ ] Classic checkout: card field renders, a bad code is rejected in the
      checkout form, a good code completes the order.
- [ ] Blocks checkout: card field renders, empty code blocks submission, a good
      code completes the order.
- [ ] Order meta ends with `_tazella_status = captured`, a reservation reference,
      a redemption UUID, and **no `_tazella_card_code`**.
- [ ] Order total equals `_tazella_applied_minor` (no partial payment marked paid).
- [ ] Cancelling a pending order releases the hold.
- [ ] Refunding from WooCommerce succeeds and writes a reversal in Tazella
      (`integration_refund` with the redemption UUID).
- [ ] Two refunds of the same amount on one order create **two** reversals.
- [ ] HPOS enabled: no incompatibility warning; orders still capture and refund.
- [ ] Disconnect the network mid-checkout, retry: no second hold or redemption
      (stable idempotency keys).
- [ ] Guessing codes: after the configured number of failed lookups from one
      client, further attempts are refused locally with `RATE_LIMITED` and never
      reach the gateway; a second client is unaffected; a success clears the
      counter.
- [ ] Abandoned checkout: a hold whose expiry has passed is released by the
      hourly sweep with an order note; unexpired holds and captured orders are
      untouched, and a second sweep releases nothing.
- [ ] Split tender (if enabled): a card below the total captures its available
      balance, leaves the order **on hold** with `_tazella_remaining_minor`, shows
      the remainder to the customer, and is not reported as `order.paid`.
- [ ] Split tender refunds are capped at the captured amount.
- [ ] An order the card has already captured is never cancelled by
      WooCommerce's unpaid-order cron: the order is noted and left for a human
      to resolve. If an administrator cancels it anyway, the captured amount is
      returned to the card (`_tazella_status = reversed`) and nothing is left
      due; an order with only an uncaptured hold is still cancelled and the hold
      released.
- [ ] Debug log contains error codes and request IDs only — never secrets or card
      codes.

### 4.1 How this checklist was executed locally

`packages/wordpress/tazella-gift-cards/tests/sandbox/` turns §4 into executable
assertions against a real WordPress + WooCommerce store and a stand-in for the
gateway (`mock-gateway.mjs`, which mirrors `web/lib/integrations/gateway.ts`:
HMAC signature, 300 s skew, idempotency replay, envelope and error codes).

```bash
node packages/wordpress/tazella-gift-cards/tests/sandbox/mock-gateway.mjs &
PHP=/path/to/php WORK=/tmp/tazella-wp \
  bash packages/wordpress/tazella-gift-cards/tests/sandbox/setup-wordpress.sh
/path/to/wp wp --path=/tmp/tazella-wp/wordpress \
  eval-file packages/wordpress/tazella-gift-cards/tests/sandbox/checklist.php

# Blocks checkout over the Store API: full payment, then split tender
PHP=/path/to/php -S 127.0.0.1:8088 -t /tmp/tazella-wp/wordpress &
/path/to/wp wp --path=/tmp/tazella-wp/wordpress \
  eval-file packages/wordpress/tazella-gift-cards/tests/sandbox/prepare-store-api.php
SITE_URL=http://127.0.0.1:8088 PRODUCT_ID=<printed id> REST_ROUTE=1 \
  node packages/wordpress/tazella-gift-cards/tests/sandbox/store-api-checkout.mjs
```

Results from the last recorded run (0.2.1 — the 0.2.2 changes have not been
re-run against the sandbox harness in this environment):

| Configuration | Assertions |
|---|---|
| WordPress 7.1.5, WooCommerce 11.3.1, PHP 8.3.32, MariaDB 10.11.9, HPOS on (`0.2.2`) | 138 passed |
| Same, clean install with HPOS off (`0.2.2`, orders in `wp_posts`, no `wp_wc_orders` table) | 134 passed |
| Blocks checkout through the Store API (HPOS on), full payment and split tender | 20 passed |

The `0.2.0` run added the throttle, hold-sweep and split-tender sections;
`0.2.1` added the cancellation-after-capture section (the real
`wc_cancel_unpaid_orders()` cron, manual cancellation reversal, and an
uncaptured hold still being cleaned up) and the split-tender case through the
Blocks checkout. `0.2.2` adds the branded checkout panel and fixes the currency
fallback, reconciliation order status, timeout-after-capture handling and
refund idempotency key; re-run the checklist before shipping a build. The HPOS-off case is now covered on a clean install built with
`woocommerce_custom_orders_table_enabled=no` set before WooCommerce was
activated: 134/134, which is the HPOS-on total minus its four HPOS-only
assertions, with all 23 orders stored as `shop_order` posts. Reaching that
green first required three checklist fixes: pin the store currency (a fresh
store defaults to USD, but the gateway is QAR-gated), refresh the gateway
instance WooCommerce built before any settings existed so the sweep and refund
hooks see credentials, and backdate `post_modified`/`post_modified_gmt`
directly because legacy storage rewrites `date_modified` on every save. The
checklist also now pins `partial_payments` to `no` in its defaults, so a second
run does not inherit split tender from the cancellation section.

Two defects were found and fixed by that run and are worth knowing about when
re-testing:

- `Blocks.php` declared `$settings` as `private`, which conflicts with
  `AbstractPaymentMethodType::$settings` and fataled the site on activation with
  WooCommerce 11.
- Release/report hooks were bound to whichever gateway instance WooCommerce
  constructed first, so a settings change in the same process could leave
  cancellation release running with empty credentials. Hook work now resolves
  the live gateway.

WooCommerce 11 also renamed the `wc_create_refund()` argument `api_refund` to
`refund_payment`; refund tests must pass the new key or the gateway is never
called.

Not covered by the local run: the production gateway and its Postgres RPCs, a
live Tazella sandbox card, the browser-side `blocks.js` validation, and the
vendor dashboard key issuance.

## 5. Known limitations

- With split tender off (the default) one gift card must cover the whole order;
  the order fails rather than being marked partly paid.
- With split tender on, the gift card's share is captured and the order is left
  on hold for the remainder. WooCommerce still cannot charge a second live
  payment method in the same checkout, so the balance is collected by the store.
- WooCommerce's unpaid-order cron is blocked for any order the card has already
  captured; those orders stay pending until someone collects the remainder or
  cancels them (which reverses the card capture automatically).
- The attempt counter is per client address, so a distributed guessing campaign
  is throttled per address rather than globally.
- No subscriptions, no multi-currency, no WordPress.org release.
- The plugin is verified against a local WordPress + WooCommerce install with a
  stand-in gateway (§4.1), not yet against the production gateway or a live
  vendor store.
