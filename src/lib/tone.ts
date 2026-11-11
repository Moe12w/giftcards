// src/lib/tone.ts
import type { AccentTone } from './types';

/**
 * The five accent tones the app can paint.
 *
 * A vendor can pick the colour of a gift in the dashboard, so the value that
 * comes back from the database is a plain string and could be anything. Every
 * tone that reaches the app goes through here, so an unknown colour can never
 * take a screen down.
 */
export const TONES: AccentTone[] = ['teal', 'pink', 'lavender', 'gold', 'sky'];

const ALIASES: Record<string, AccentTone> = {
  mint: 'teal',
  teal: 'teal',
  green: 'teal',
  coral: 'pink',
  pink: 'pink',
  red: 'pink',
  purple: 'lavender',
  violet: 'lavender',
  lavender: 'lavender',
  cream: 'gold',
  gold: 'gold',
  yellow: 'gold',
  blue: 'sky',
  sky: 'sky',
  surface: 'lavender',
};

export function resolveTone(
  tone: string | null | undefined,
  fallback: AccentTone = 'lavender',
): AccentTone {
  if (!tone) return fallback;
  const key = tone.trim().toLowerCase();
  if (!key) return fallback;
  return ALIASES[key] ?? fallback;
}
