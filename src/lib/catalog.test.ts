import { describe, expect, it } from 'vitest';

import { offersForCollection } from './catalog';
import type { Offer } from './types';

function gift(id: string, options: { category?: string; occasions?: string[] } = {}): Offer {
  return {
    id,
    title: id,
    title_ar: null,
    category: options.category,
    occasions: options.occasions ?? [],
    fulfilment_type: 'monetary',
    rating: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    min_amount_minor: 10000,
    max_amount_minor: 10000,
    preset_amounts_minor: [10000],
    status: 'published',
  } as unknown as Offer;
}

describe('offersForCollection', () => {
  it('includes a gift explicitly placed in For her even outside the usual categories', () => {
    const results = offersForCollection([gift('flowers', { occasions: ['for-her'] })], 'for-her');
    expect(results.map((offer) => offer.id)).toEqual(['flowers']);
  });

  it('includes a gift explicitly placed in For him even outside the usual categories', () => {
    const results = offersForCollection([gift('spa', { occasions: ['for-him'] })], 'for-him');
    expect(results.map((offer) => offer.id)).toEqual(['spa']);
  });

  it('keeps gifts out of collections they were not placed in', () => {
    const results = offersForCollection([gift('spa', { category: 'wellness' })], 'for-him');
    expect(results).toEqual([]);
  });

  it('still places an occasion-tagged gift in its collection page', () => {
    const results = offersForCollection([gift('cake', { occasions: ['birthday'] })], 'birthday');
    expect(results.map((offer) => offer.id)).toEqual(['cake']);
  });
});
