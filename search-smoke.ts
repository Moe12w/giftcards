// Temporary smoke test for the new fuzzy bilingual search. Not part of the app.
import { normalizeSearchText, tokenizeSearch, fuzzyTokenScore, searchScore, searchOffers } from './src/lib/search.ts';
import { offerBusinessName } from './src/lib/catalog.ts';
import type { Offer } from './src/lib/types.ts';

function offer(o: Partial<Offer> & Pick<Offer, 'id' | 'title' | 'min_amount_minor' | 'max_amount_minor' | 'preset_amounts_minor' | 'valid_until' | 'is_active' | 'created_at'>): Offer {
  return {
    vendor_id: null,
    title: o.title,
    title_ar: o.title_ar ?? null,
    description: o.description ?? null,
    image_url: null,
    max_amount_minor: o.max_amount_minor,
    preset_amounts_minor: o.preset_amounts_minor,
    valid_until: o.valid_until,
    is_active: o.is_active,
    created_at: o.created_at,
    min_amount_minor: o.min_amount_minor,
    ...o,
  } as Offer;
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} → got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
}

check('normalize strips accents/diacritics/punctuation', normalizeSearchText(' Spa  Décor! '), 'spa decor');
check('tokenize splits', tokenizeSearch('  Hello   World  '), ['hello', 'world']);
check('tokenize arabic keeps letters', tokenizeSearch('قهوة'), ['قهوة']);
check('fuzzy exact', fuzzyTokenScore('spa', 'spa'), 1);
check('fuzzy typo tolerated', fuzzyTokenScore('spq', 'spa') > 0, true);
check('fuzzy no match', fuzzyTokenScore('zzzz', 'spa'), 0);
check('multi-token requires all', searchScore('spa couples', [{ weight: 10, text: 'spa' }, { weight: 6, text: 'couples' }]) > 0, true);
check('multi-token no match', searchScore('zzzz spa', [{ weight: 10, text: 'spa' }]), 0);

const offers: Offer[] = [
  offer({ id: 'a', title: 'Sahara Spa Day', description: 'Relaxing massage package for couples', min_amount_minor: 5000, max_amount_minor: 8000, preset_amounts_minor: [5000, 8000], valid_until: null, is_active: true, created_at: '', category: 'wellness', occasions: ['anniversary'] }),
  offer({ id: 'b', title: 'Arabic Coffee House', title_ar: 'قهوة عربية', description: 'Traditional coffee tasting', min_amount_minor: 1000, max_amount_minor: 3000, preset_amounts_minor: [1000, 3000], valid_until: null, is_active: true, created_at: '', category: 'coffee' }),
  offer({ id: 'c', title: 'Birthday Cake at Sweet Spot', description: 'Custom cake for birthdays', min_amount_minor: 800, max_amount_minor: 2500, preset_amounts_minor: [800, 2500], valid_until: null, is_active: true, created_at: '', category: 'desserts', occasions: ['birthday'] }),
];

check('exact query finds coffee by title', searchOffers(offers, 'arabic coffee').map((o) => o.id), ['b']);
check('typo query finds spa', searchOffers(offers, 'sahara spa').map((o) => o.id), ['a']);
check('arabic query finds arabic coffee', searchOffers(offers, 'قهوة', 'ar').map((o) => o.id), ['b']);
check('intent query ranks spa first', searchOffers(offers, 'spa couples').map((o) => o.id), ['a']);
check('empty query returns all', searchOffers(offers, '').length, 3);
check('no match returns empty', searchOffers(offers, 'zzzznotathing').length, 0);

console.log(failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} SMOKE CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
