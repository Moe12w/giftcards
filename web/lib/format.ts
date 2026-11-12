import type { Locale } from '@/lib/i18n';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { labelFor } from '@/lib/i18n/labels';

/** Arabic uses Arabic-Indic digits and its own month names. */
function dateLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-QA' : 'en-QA';
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale = 'en',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(dateLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: Locale = 'en',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(dateLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function relativeTime(
  value: string | Date | null | undefined,
  locale: Locale = 'en',
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const copy = pick(common, locale);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return copy.time.justNow;
  if (minutes < 60) return fill(copy.time.minutesAgo, { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return fill(copy.time.hoursAgo, { count: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return fill(copy.time.daysAgo, { count: days });
  return formatDate(date, locale);
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Turns a stored value into a readable name, in the given language. */
export function titleCase(value: string, locale: Locale = 'en'): string {
  return labelFor(value, locale);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
