import { describe, expect, it } from 'vitest';
import { resolveTone, TONES } from './tone';

describe('resolveTone', () => {
  it('keeps the tones the app can paint', () => {
    for (const tone of TONES) {
      expect(resolveTone(tone)).toBe(tone);
    }
  });

  it('maps the dashboard palette names onto the app tones', () => {
    expect(resolveTone('mint')).toBe('teal');
    expect(resolveTone('coral')).toBe('pink');
    expect(resolveTone('MINT')).toBe('teal');
  });

  it('falls back instead of returning something the app cannot paint', () => {
    expect(resolveTone('coffee')).toBe('lavender');
    expect(resolveTone('')).toBe('lavender');
    expect(resolveTone(null)).toBe('lavender');
    expect(resolveTone(undefined)).toBe('lavender');
    expect(resolveTone('coffee', 'gold')).toBe('gold');
  });

  it('always returns a tone the app knows', () => {
    for (const value of ['mint', 'coral', 'teal', 'nonsense', '', null]) {
      expect(TONES).toContain(resolveTone(value));
    }
  });
});
