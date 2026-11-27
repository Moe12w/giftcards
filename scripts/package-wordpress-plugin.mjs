/**
 * Builds the installable WooCommerce plugin ZIP.
 *
 *   node scripts/package-wordpress-plugin.mjs
 *
 * Outputs:
 *   packages/wordpress/tazella-gift-cards-<version>.zip   (archive)
 *   web/public/downloads/tazella-gift-cards.zip           (served link for vendors)
 *
 * The ZIP root contains the plugin folder, so the file can be uploaded directly
 * in WordPress → Plugins → Add new → Upload plugin.
 *
 * No dependencies: the archive is written with the ZIP "store" method, which
 * WordPress and every OS unzip without complaint. That keeps this script
 * runnable before `npm install`.
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const pluginSlug = 'tazella-gift-cards';
const pluginDir = path.join(repoRoot, 'packages/wordpress', pluginSlug);
const composer = JSON.parse(fs.readFileSync(path.join(pluginDir, 'composer.json'), 'utf8'));
const version = composer.version;
const mainFile = fs.readFileSync(path.join(pluginDir, `${pluginSlug}.php`), 'utf8');
const headerVersion = /^\s*\*\s*Version:\s*(\S+)/m.exec(mainFile)?.[1];

if (!version) {
  console.error('composer.json is missing a version.');
  process.exit(1);
}
if (headerVersion !== version) {
  console.error(
    `Version mismatch: plugin header says ${headerVersion ?? '(none)'} but composer.json says ${version}.`,
  );
  process.exit(1);
}

const SKIP_DIRS = new Set(['tests', 'node_modules', '.git', '.github', 'vendor']);
const INCLUDED = /\.(php|json|md|txt|xml|js|css|pot|po|mo|png|jpg|jpeg|svg)$/i;

function collect(dir, relative = '') {
  const entries = {};
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(item.name) || item.name === '.DS_Store') continue;
    const full = path.join(dir, item.name);
    const rel = relative ? `${relative}/${item.name}` : item.name;
    if (item.isDirectory()) {
      Object.assign(entries, collect(full, rel));
    } else if (INCLUDED.test(item.name)) {
      entries[`${pluginSlug}/${rel}`] = fs.readFileSync(full);
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Minimal ZIP writer (store method, no compression)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function buildZip(files) {
  const now = dosDateTime(new Date());
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const [name, data] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const checksum = crc32(data);
    const size = data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuffer, data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(now.time, 12);
    header.writeUInt16LE(now.day, 14);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(size, 20);
    header.writeUInt32LE(size, 24);
    header.writeUInt16LE(nameBuffer.length, 28);
    header.writeUInt32LE(offset, 42);

    central.push(header, nameBuffer);
    offset += local.length + nameBuffer.length + size;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, centralBuffer, end]);
}

const files = collect(pluginDir);
if (!Object.keys(files).some((name) => name.endsWith(`/${pluginSlug}.php`))) {
  console.error('The plugin bootstrap file is missing from the archive.');
  process.exit(1);
}

const zip = buildZip(files);

const versioned = path.join(repoRoot, 'packages/wordpress', `${pluginSlug}-${version}.zip`);
fs.writeFileSync(versioned, zip);

const publicDir = path.join(repoRoot, 'web/public/downloads');
fs.mkdirSync(publicDir, { recursive: true });
const downloadable = path.join(publicDir, `${pluginSlug}.zip`);
fs.writeFileSync(downloadable, zip);

console.log(`Wrote ${path.relative(repoRoot, versioned)} (${zip.length} bytes)`);
console.log(`Wrote ${path.relative(repoRoot, downloadable)} (vendor download link)`);
console.log(`Files: ${Object.keys(files).length}, version ${version}`);
