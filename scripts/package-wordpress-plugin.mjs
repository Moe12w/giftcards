/**
 * Builds a versioned ZIP for the WooCommerce plugin.
 *
 *   node scripts/package-wordpress-plugin.mjs
 *
 * Output: packages/wordpress/tazella-gift-cards-<version>.zip
 * The ZIP root contains the plugin folder, so it can be uploaded directly in
 * WordPress → Plugins → Add new → Upload plugin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const pluginDir = path.resolve('packages/wordpress/tazella-gift-cards');
const version = JSON.parse(fs.readFileSync(path.join(pluginDir, 'composer.json'), 'utf8')).version;
const pluginSlug = 'tazella-gift-cards';

function collect(dir, relative = '') {
  const entries = {};
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['tests', 'node_modules', '.git'].includes(item.name)) continue;
    const full = path.join(dir, item.name);
    const rel = relative ? `${relative}/${item.name}` : item.name;
    if (item.isDirectory()) {
      Object.assign(entries, collect(full, rel));
    } else if (/\.(php|json|md|txt|xml|js|css|pot)$/i.test(item.name)) {
      entries[`${pluginSlug}/${rel}`] = fs.readFileSync(full);
    }
  }
  return entries;
}

const zip = zipSync(collect(pluginDir), { level: 6 });
const output = path.resolve(`packages/wordpress/${pluginSlug}-${version}.zip`);
fs.writeFileSync(output, zip);
console.log(`Wrote ${path.relative(process.cwd(), output)} (${zip.length} bytes)`);
