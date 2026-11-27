#!/usr/bin/env bash
# Creates a throwaway WordPress + WooCommerce store for testing the plugin.
#
#   PHP=/path/to/php WORK=/tmp/tazella-wp ./setup-wordpress.sh
#
# Downloads WordPress and WooCommerce from wordpress.org when they are not
# already in $WORK, installs the plugin from the packaged ZIP, and points the
# gateway at the mock gateway (mock-gateway.mjs) on 127.0.0.1:9099.
set -euo pipefail

WORK=${WORK:-/tmp/tazella-wp}
PHP=${PHP:-php}
SITE_PORT=${SITE_PORT:-8088}
DB_PORT=${DB_PORT:-3307}
DB_NAME=${DB_NAME:-wp}
DB_USER=${DB_USER:-wp}
DB_PASS=${DB_PASS:-wppass}
SITE_URL="http://127.0.0.1:${SITE_PORT}"
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)
PLUGIN_ZIP=${PLUGIN_ZIP:-$REPO_ROOT/web/public/downloads/tazella-gift-cards.zip}
WP_DIR="$WORK/wordpress"
WP="$PHP $WORK/wp-cli.phar --path=$WP_DIR"

mkdir -p "$WORK/logs"

if [ ! -f "$WORK/wp-cli.phar" ]; then
  echo "==> downloading wp-cli"
  curl -fsSL -o "$WORK/wp-cli.phar" https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
fi

if [ ! -d "$WP_DIR" ]; then
  echo "==> downloading WordPress"
  curl -fsSL -o "$WORK/wordpress.zip" https://wordpress.org/latest.zip
  unzip -q -o "$WORK/wordpress.zip" -d "$WORK"
fi

if [ ! -d "$WP_DIR/wp-content/plugins/woocommerce" ]; then
  echo "==> downloading WooCommerce"
  curl -fsSL -o "$WORK/woocommerce.zip" "https://downloads.wordpress.org/plugin/woocommerce.latest-stable.zip"
  unzip -q -o "$WORK/woocommerce.zip" -d "$WP_DIR/wp-content/plugins"
fi

if [ ! -f "$WP_DIR/wp-config.php" ]; then
  echo "==> writing wp-config.php"
  $WP config create \
    --dbname="$DB_NAME" --dbuser="$DB_USER" --dbpass="$DB_PASS" \
    --dbhost="127.0.0.1:${DB_PORT}" --dbcharset=utf8mb4 --skip-check \
    --extra-php <<'PHP'
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
define('DISALLOW_FILE_MODS', false);
PHP
fi

if ! $WP core is-installed 2>/dev/null; then
  echo "==> installing WordPress on $SITE_URL"
  $WP core install \
    --url="$SITE_URL" --title="Tazella plugin sandbox" \
    --admin_user=admin --admin_password=adminpass --admin_email=admin@example.test \
    --skip-email
fi

$WP option update siteurl "$SITE_URL" >/dev/null
$WP option update home "$SITE_URL" >/dev/null
$WP rewrite structure '/%postname%/' --hard >/dev/null 2>&1 || true
$WP plugin activate woocommerce >/dev/null 2>&1 || true
$WP option update woocommerce_store_address "Test Street 1" >/dev/null
$WP option update woocommerce_default_country "QA" >/dev/null
$WP option update woocommerce_currency "QAR" >/dev/null
$WP option update woocommerce_calc_taxes "no" >/dev/null

echo "==> installing the plugin ZIP: $PLUGIN_ZIP"
$WP plugin install "$PLUGIN_ZIP" --force --activate >/dev/null
$WP plugin list --status=active --field=name | tr '\n' ' '
echo

echo "==> configuring the gateway"
$WP option update woocommerce_tazella_gift_cards_settings --format=json <<'JSON'
{
  "enabled": "yes",
  "title": "Tazella gift card",
  "description": "Pay with a Tazella gift card.",
  "environment": "sandbox",
  "base_url": "http://127.0.0.1:9099",
  "platform_code": "wordpress",
  "api_key": "tz_sandbox_wp_mock_key",
  "signing_secret": "wp_mock_secret",
  "external_vendor_id": "",
  "external_branch_id": "",
  "currency": "QAR",
  "ttl_seconds": "600",
  "debug": "yes"
}
JSON

echo "==> done. Start the site with:"
echo "    $PHP -S 127.0.0.1:${SITE_PORT} -t \"$WP_DIR\""
