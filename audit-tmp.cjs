// Audit helper: navigation reference check + i18n key check for the Expo app.
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/User/Desktop/gift-card-marketplace';
const APP = path.join(ROOT, 'app');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
  }
  return out;
}

// ---- Collect Expo Router route paths from app/ ----
const routes = new Set();
function addRoute(rel) {
  // rel like /(customer)/(tabs)/profile.tsx or claim/[token]/qr.tsx
  let r = rel.replace(/\\/g, '/');
  r = r.replace(/\.tsx?$/, '').replace(/\.jsx?$/, '');
  r = r.replace(/\/index$/, '') || '';
  routes.add('/' + r);
  // Also register the group-stripped variant: /(customer)/x -> /x is NOT how expo works;
  // hrefs keep group segments. Keep raw form.
}
function scanRoutes(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_layout') || entry.name.startsWith('+')) continue;
    const r = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
        scanRoutes(path.join(dir, entry.name), r); // keep group in path
      } else {
        scanRoutes(path.join(dir, entry.name), r);
      }
    } else {
      addRoute(r);
    }
  }
}
scanRoutes(APP);
// root index
routes.add('/');

// ---- Find navigation references ----
const files = [...walk(APP), ...walk(SRC)];
const pushRe = /(?:router\.(?:push|replace|dismissTo)|Href\.from)\(\s*(['"`])([^'"`]+)\1/g;
const linkRe = /<Link[^>]*href=\{\s*(['"`])([^'"`]+)\1\s*\}/g;
const hrefAttrRe = /href=\{\s*(['"`])([^'"`]+)\1\s*\}/g;
const dead = [];
const allRefs = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  let m;
  const regexes = [pushRe, hrefAttrRe];
  for (const re of regexes) {
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      const target = m[2];
      if (target.startsWith('http') || target.startsWith('mailto') || target.startsWith('tel')) continue;
      if (!target.startsWith('/')) continue; // dynamic/relative
      const line = text.slice(0, m.index).split('\n').length;
      allRefs.push({ file: f, line, target });
    }
  }
}
// Check which targets exist (group-aware): normalize by trying exact, and with '/index' stripped already handled
const routeList = [...routes];
for (const ref of allRefs) {
  const t = ref.target;
  const ok = routeList.some((r) => r === t || r === t.replace(/\/index$/, '') || t.replace(/\/index$/, '') === r);
  if (!ok) {
    // try matching dynamic segments loosely: replace [id] etc.
    const looseOk = routeList.some((r) => {
      const a = r.split('/').filter(Boolean).map((s, i) => (s.startsWith('[') ? '*' : s));
      const b = t.split('/').filter(Boolean).map((s) => s);
      if (a.length !== b.length) return false;
      // groups like (customer) exist in both or not
      return a.every((s, i) => s === '*' || s === b[i]);
    });
    if (!looseOk) dead.push(ref);
  }
}
console.log('=== DEAD NAV TARGETS (app + src) ===');
for (const d of dead) console.log(`${path.relative(ROOT, d.file)}:${d.line} -> ${d.target}`);
console.log(`(${dead.length} dead of ${allRefs.length} refs)`);

// ---- i18n key check ----
const en = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n/en.json'), 'utf8'));
function hasKey(k) {
  const parts = k.split('.');
  let node = en;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return false;
  }
  return true;
}
const keyRe = /\bt\(\s*(['"`])([a-zA-Z0-9_.]+)\1/g;
const missing = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  // only files that import useTranslation/i18n roughly
  let m;
  keyRe.lastIndex = 0;
  while ((m = keyRe.exec(text))) {
    const k = m[2];
    if (!hasKey(k)) {
      const line = text.slice(0, m.index).split('\n').length;
      missing.push({ file: f, line, k });
    }
  }
}
console.log('\n=== MISSING i18n KEYS (t(...) not in en.json) ===');
const seen = new Set();
for (const x of missing) {
  const id = path.relative(ROOT, x.file) + ':' + x.k;
  if (seen.has(id)) continue;
  seen.add(id);
  console.log(`${path.relative(ROOT, x.file)}:${x.line} -> t('${x.k}')`);
}
console.log(`(${seen.size} missing)`);

// ---- stub markers ----
console.log('\n=== STUB MARKERS ===');
const markerRe = /(TODO|FIXME|HACK|placeholder|PLACEHOLDER|coming soon|Coming soon|not implemented|Not implemented|mock|demo data|fake)/;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (markerRe.test(l)) console.log(`${path.relative(ROOT, f)}:${i + 1}: ${l.trim().slice(0, 120)}`);
  });
}
